import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startBot } from "../bot/index";
import { getDb } from "../db";
import { products, productCategories } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Dynamic sitemap.xml
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const db = await getDb();
      const baseUrl = process.env.SITE_URL || "https://kovkavdvorik.ru";
      const staticPages = [
        { loc: "/", priority: "1.0", changefreq: "weekly" },
        { loc: "/catalog", priority: "0.9", changefreq: "weekly" },
        { loc: "/delivery", priority: "0.7", changefreq: "monthly" },
        { loc: "/about", priority: "0.6", changefreq: "monthly" },
        { loc: "/contacts", priority: "0.6", changefreq: "monthly" },
      ];

      let productUrls: string[] = [];
      let categoryUrls: string[] = [];

      if (db) {
        const activeProducts = await db.select({ slug: products.slug, updatedAt: products.updatedAt })
          .from(products).where(eq(products.isActive, true));
        productUrls = activeProducts
          .filter(p => p.slug)
          .map(p => `  <url>\n    <loc>${baseUrl}/product/${p.slug}</loc>\n    <lastmod>${p.updatedAt.toISOString().split("T")[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`);

        const categories = await db.select({ slug: productCategories.slug })
          .from(productCategories).where(eq(productCategories.isActive, true));
        categoryUrls = categories.map(c =>
          `  <url>\n    <loc>${baseUrl}/catalog/${c.slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
        );
      }

      const staticEntries = staticPages.map(p =>
        `  <url>\n    <loc>${baseUrl}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
      );

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticEntries, ...categoryUrls, ...productUrls].join("\n")}\n</urlset>`;
      res.set("Content-Type", "application/xml");
      res.send(xml);
    } catch (error) {
      console.error("Failed to generate sitemap:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Start Telegram bot (non-blocking)
  startBot().catch((err) => {
    console.error("[Bot] Failed to start Telegram bot:", err);
  });
}

startServer().catch(console.error);
