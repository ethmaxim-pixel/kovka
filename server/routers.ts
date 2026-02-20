import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  orders,
  orderItems,
  contactRequests,
  siteContent,
  customers,
  customerInteractions,
  products,
  productCategories,
  businessSettings,
  financeCategories,
  transactions,
  financeAccounts,
  stockMovements,
  customerRatings,
} from "../drizzle/schema";
import { and, or, asc, inArray, gte, lte } from "drizzle-orm";
import { desc, sql, eq, like } from "drizzle-orm";
import { ENV } from "./_core/env";
import { slugify } from "./utils/slugify";
import { notifyAdmins } from "./bot/index";
import { syncKnowledgeBase } from "./bot/qdrant";

// Helper: resolve finance account by payment method
async function getAccountByPaymentMethod(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, paymentMethod: string): Promise<number | null> {
  const nameMap: Record<string, string> = {
    cash: "Наличные",
    card: "Расчётный счёт",
    transfer: "Карта",
  };
  const targetName = nameMap[paymentMethod];
  if (!targetName) return null;

  const account = await db.select().from(financeAccounts)
    .where(and(eq(financeAccounts.name, targetName), eq(financeAccounts.isActive, true)))
    .limit(1);
  return account[0]?.id || null;
}

// Number to Russian words for invoice
function numberToWordsRu(amount: number): string {
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  const intPart = Math.floor(amount);
  const kopPart = Math.round((amount - intPart) * 100);

  if (intPart === 0) return `Ноль рублей ${String(kopPart).padStart(2, "0")} копеек`;

  function convert(n: number, feminine = false): string {
    if (n === 0) return "";
    const parts: string[] = [];
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (h > 0) parts.push(hundreds[h]);
    if (t === 1) {
      parts.push(teens[u]);
    } else {
      if (t > 1) parts.push(tens[t]);
      if (u > 0) {
        if (feminine && u === 1) parts.push("одна");
        else if (feminine && u === 2) parts.push("две");
        else parts.push(units[u]);
      }
    }
    return parts.join(" ");
  }

  function pluralize(n: number, one: string, two: string, five: string): string {
    const abs = Math.abs(n) % 100;
    if (abs >= 11 && abs <= 19) return five;
    const last = abs % 10;
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return two;
    return five;
  }

  const result: string[] = [];

  const millions = Math.floor(intPart / 1000000);
  const thousands = Math.floor((intPart % 1000000) / 1000);
  const rest = intPart % 1000;

  if (millions > 0) {
    result.push(convert(millions) + " " + pluralize(millions, "миллион", "миллиона", "миллионов"));
  }
  if (thousands > 0) {
    result.push(convert(thousands, true) + " " + pluralize(thousands, "тысяча", "тысячи", "тысяч"));
  }
  if (rest > 0) {
    result.push(convert(rest));
  }

  const rubWord = pluralize(intPart, "рубль", "рубля", "рублей");
  const text = result.join(" ").replace(/\s+/g, " ").trim();
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);

  return `${capitalized} ${rubWord} ${String(kopPart).padStart(2, "0")} копеек`;
}

// Debounced Qdrant sync - avoids multiple syncs on rapid CRUD operations
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function triggerQdrantSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncKnowledgeBase()
      .then((r) => console.log(`[Auto-sync] Qdrant synced: ${r.synced} points`))
      .catch((e) => console.error("[Auto-sync] Qdrant sync failed:", e));
  }, 2000);
}

// Function to send message to Telegram (all admins via bot)
async function sendTelegramMessage(message: string): Promise<boolean> {
  try {
    // Try sending via bot instance first (to all admins)
    await notifyAdmins(message);
    return true;
  } catch {
    // Fallback to direct API call
    if (!ENV.telegramBotToken || !ENV.telegramChatId) {
      console.warn("Telegram credentials not configured");
      return false;
    }

    try {
      for (const adminId of ENV.telegramAdminIds) {
        await fetch(
          `https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminId,
              text: message,
              parse_mode: "HTML",
            }),
          }
        );
      }
      return true;
    } catch (error) {
      console.error("Failed to send Telegram message:", error);
      return false;
    }
  }
}

// Order item schema
const orderItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  article: z.string(),
  category: z.string().optional(),
  price: z.number(),
  quantity: z.number(),
  image: z.string().optional(),
});

// Phone validation regex - accepts formats: +7999..., 8999..., (999) 999-99-99, etc.
const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,18}$/;

// Order schema
const orderSchema = z.object({
  name: z.string().min(1, "Имя обязательно").max(100, "Имя слишком длинное"),
  phone: z.string().regex(phoneRegex, "Некорректный номер телефона"),
  comment: z.string().max(1000, "Комментарий слишком длинный").optional(),
  items: z.array(orderItemSchema).min(1, "Корзина пуста"),
  total: z.number().positive("Сумма должна быть положительной"),
});

// Contact form schema
const contactFormSchema = z.object({
  name: z.string().min(1, "Имя обязательно").max(100, "Имя слишком длинное"),
  phone: z.string().regex(phoneRegex, "Некорректный номер телефона"),
  message: z.string().max(2000, "Сообщение слишком длинное").optional(),
});

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    adminLogin: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input }) => {
        if (input.username !== ENV.adminUsername || input.password !== ENV.adminPassword) {
          const { TRPCError } = await import("@trpc/server");
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный логин или пароль" });
        }
        const { SignJWT } = await import("jose");
        const secret = new TextEncoder().encode(ENV.adminJwtSecret);
        const token = await new SignJWT({ role: "admin", sub: input.username })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("100y")
          .sign(secret);
        return { token };
      }),
    adminVerify: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        try {
          const { jwtVerify } = await import("jose");
          const secret = new TextEncoder().encode(ENV.adminJwtSecret);
          const { payload } = await jwtVerify(input.token, secret);
          return { valid: true, username: payload.sub as string };
        } catch {
          return { valid: false, username: null };
        }
      }),
  }),

  // Contact form router for handling contact requests
  contact: router({
    submit: publicProcedure
      .input(contactFormSchema)
      .mutation(async ({ input }) => {
        const { name, phone, message } = input;

        // Save to database
        const db = await getDb();
        if (db) {
          try {
            await db.insert(contactRequests).values({
              name,
              phone,
              message: message || null,
            });
          } catch (error) {
            console.error("Failed to save contact request to DB:", error);
          }
        }

        // Create Telegram message for contact form
        const telegramMessage = `📩 <b>НОВАЯ ЗАЯВКА!</b>

👤 <b>Имя:</b> ${name}
📞 <b>Телефон:</b> ${phone}
${message ? `💬 <b>Сообщение:</b> ${message}\n` : ""}
📅 Дата: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

        // Send to Telegram
        const sent = await sendTelegramMessage(telegramMessage);

        if (!sent) {
          console.error("Failed to send contact form to Telegram");
        }

        return {
          success: true,
          message: "Заявка успешно отправлена",
        };
      }),
  }),

  // Order router for handling orders and Telegram notifications
  order: router({
    submit: publicProcedure
      .input(orderSchema)
      .mutation(async ({ input }) => {
        const { name, phone, comment, items, total } = input;

        // Save to database
        const db = await getDb();
        let orderId: number | null = null;
        
        if (db) {
          try {
            // Insert order
            const orderResult = await db.insert(orders).values({
              customerName: name,
              customerPhone: phone,
              comment: comment || null,
              status: "processing",
              totalAmount: total.toString(),
              itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
            });
            
            orderId = Number(orderResult[0].insertId);
            
            // Insert order items
            if (orderId) {
              for (const item of items) {
                await db.insert(orderItems).values({
                  orderId,
                  productName: item.name,
                  productArticle: item.article,
                  productCategory: item.category || null,
                  quantity: item.quantity,
                  price: item.price.toString(),
                  totalPrice: (item.price * item.quantity).toString(),
                });
              }
            }
          } catch (error) {
            console.error("Failed to save order to DB:", error);
          }
        }

        // Format order items for Telegram message
        const itemsList = items
          .map(
            (item, index) =>
              `${index + 1}. <b>${item.name}</b>\n   Артикул: ${item.article}\n   Цена: ${item.price.toLocaleString("ru-RU")} ₽\n   Кол-во: ${item.quantity} шт.\n   Сумма: ${(item.price * item.quantity).toLocaleString("ru-RU")} ₽`
          )
          .join("\n\n");

        // Create Telegram message
        const message = `🛒 <b>НОВЫЙ ЗАКАЗ${orderId ? ` #${orderId}` : ""}!</b>

👤 <b>Клиент:</b> ${name}
📞 <b>Телефон:</b> ${phone}
${comment ? `💬 <b>Комментарий:</b> ${comment}\n` : ""}
📦 <b>Товары:</b>

${itemsList}

💰 <b>ИТОГО: ${total.toLocaleString("ru-RU")} ₽</b>

📅 Дата: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

        // Send to Telegram
        const sent = await sendTelegramMessage(message);

        if (!sent) {
          console.error("Failed to send order to Telegram");
        }

        return {
          success: true,
          message: "Заказ успешно оформлен",
          orderId,
        };
      }),
  }),

  // Statistics router for admin panel
  stats: router({
    // Get dashboard summary
    summary: adminProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        source: z.enum(["all", "website", "offline"]).optional().default("all"),
      }).optional())
      .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return {
          totalOrders: 0,
          totalRevenue: 0,
          totalItems: 0,
          newOrders: 0,
          completedOrders: 0,
          avgCheck: 0,
          contactRequests: 0,
          newCustomers: 0,
        };
      }

      try {
        const conditions: ReturnType<typeof sql>[] = [];
        if (input?.dateFrom) {
          conditions.push(sql`createdAt >= ${new Date(input.dateFrom)}`);
        }
        if (input?.dateTo) {
          const to = new Date(input.dateTo);
          to.setHours(23, 59, 59, 999);
          conditions.push(sql`createdAt <= ${to}`);
        }
        if (input?.source && input.source !== "all") {
          conditions.push(sql`source = ${input.source}`);
        }
        const dateWhere = conditions.length > 0
          ? sql.join(conditions, sql` AND `)
          : sql`1=1`;

        // Get total orders count
        const totalOrdersResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(orders)
          .where(dateWhere);
        const totalOrders = totalOrdersResult[0]?.count || 0;

        // Get total revenue
        const totalRevenueResult = await db
          .select({ sum: sql<string>`COALESCE(SUM(totalAmount), 0)` })
          .from(orders)
          .where(dateWhere);
        const totalRevenue = parseFloat(totalRevenueResult[0]?.sum || "0");

        // Get total items sold
        const totalItemsResult = await db
          .select({ sum: sql<number>`COALESCE(SUM(itemsCount), 0)` })
          .from(orders)
          .where(dateWhere);
        const totalItems = totalItemsResult[0]?.sum || 0;

        // Get active orders (status = 'processing')
        const newOrdersResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(orders)
          .where(sql`status = 'processing' AND ${dateWhere}`);
        const newOrders = newOrdersResult[0]?.count || 0;

        // Get completed orders (status = 'completed')
        const completedOrdersResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(orders)
          .where(sql`status = 'completed' AND ${dateWhere}`);
        const completedOrders = completedOrdersResult[0]?.count || 0;

        // Avg check
        const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Get contact requests count (not filtered by source)
        const crConditions: ReturnType<typeof sql>[] = [];
        if (input?.dateFrom) {
          crConditions.push(sql`createdAt >= ${new Date(input.dateFrom)}`);
        }
        if (input?.dateTo) {
          const to = new Date(input.dateTo);
          to.setHours(23, 59, 59, 999);
          crConditions.push(sql`createdAt <= ${to}`);
        }
        const crWhere = crConditions.length > 0
          ? sql.join(crConditions, sql` AND `)
          : sql`1=1`;

        const contactRequestsResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(contactRequests)
          .where(crWhere);
        const contactRequestsCount = contactRequestsResult[0]?.count || 0;

        // Get new customers (processed contact requests in period)
        const newCustomersResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(contactRequests)
          .where(sql`status = 'processed' AND ${crWhere}`);
        const newCustomers = newCustomersResult[0]?.count || 0;

        return {
          totalOrders,
          totalRevenue,
          totalItems,
          newOrders,
          completedOrders,
          avgCheck,
          contactRequests: contactRequestsCount,
          newCustomers,
        };
      } catch (error) {
        console.error("Failed to get stats summary:", error);
        return {
          totalOrders: 0,
          totalRevenue: 0,
          totalItems: 0,
          newOrders: 0,
          completedOrders: 0,
          avgCheck: 0,
          contactRequests: 0,
          newCustomers: 0,
        };
      }
    }),

    // Get recent orders
    recentOrders: adminProcedure
      .input(z.object({ limit: z.number().optional().default(10) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          const result = await db
            .select()
            .from(orders)
            .orderBy(desc(orders.createdAt))
            .limit(input.limit);
          return result;
        } catch (error) {
          console.error("Failed to get recent orders:", error);
          return [];
        }
      }),

    // Get popular products
    popularProducts: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        source: z.enum(["all", "website", "offline"]).optional().default("all"),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          const conditions: ReturnType<typeof sql>[] = [];
          if (input.dateFrom) {
            conditions.push(sql`${orders.createdAt} >= ${new Date(input.dateFrom)}`);
          }
          if (input.dateTo) {
            const to = new Date(input.dateTo);
            to.setHours(23, 59, 59, 999);
            conditions.push(sql`${orders.createdAt} <= ${to}`);
          }
          if (input.source !== "all") {
            conditions.push(sql`${orders.source} = ${input.source}`);
          }
          const whereClause = conditions.length > 0
            ? sql.join(conditions, sql` AND `)
            : sql`1=1`;

          const result = await db
            .select({
              productName: orderItems.productName,
              productArticle: orderItems.productArticle,
              productCategory: orderItems.productCategory,
              totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
              totalRevenue: sql<string>`SUM(${orderItems.totalPrice})`,
              ordersCount: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
            })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .where(whereClause)
            .groupBy(orderItems.productArticle, orderItems.productName, orderItems.productCategory)
            .orderBy(desc(sql`SUM(${orderItems.quantity})`))
            .limit(input.limit);
          return result;
        } catch (error) {
          console.error("Failed to get popular products:", error);
          return [];
        }
      }),

    // Get sales by period
    salesByPeriod: adminProcedure
      .input(z.object({
        period: z.enum(["day", "week", "month", "year"]).default("month"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        source: z.enum(["all", "website", "offline"]).optional().default("all"),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          const dateFormat = "%d.%m";

          const conditions: ReturnType<typeof sql>[] = [];
          if (input.dateFrom) {
            conditions.push(sql`createdAt >= ${new Date(input.dateFrom)}`);
          }
          if (input.dateTo) {
            const to = new Date(input.dateTo);
            to.setHours(23, 59, 59, 999);
            conditions.push(sql`createdAt <= ${to}`);
          }
          if (input.source !== "all") {
            conditions.push(sql`source = ${input.source}`);
          }
          const dateWhere = conditions.length > 0
            ? sql.join(conditions, sql` AND `)
            : sql`1=1`;

          const result = await db
            .select({
              date: sql<string>`DATE_FORMAT(createdAt, ${dateFormat})`,
              ordersCount: sql<number>`COUNT(*)`,
              revenue: sql<string>`SUM(totalAmount)`,
              itemsCount: sql<number>`SUM(itemsCount)`,
            })
            .from(orders)
            .where(dateWhere)
            .groupBy(sql`DATE_FORMAT(createdAt, ${dateFormat})`)
            .orderBy(sql`MIN(createdAt)`);

          return result;
        } catch (error) {
          console.error("Failed to get sales by period:", error);
          return [];
        }
      }),

    // Get sales by category
    salesByCategory: adminProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        source: z.enum(["all", "website", "offline"]).optional().default("all"),
      }).optional())
      .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const conditions: ReturnType<typeof sql>[] = [];
        if (input?.dateFrom) {
          conditions.push(sql`${orders.createdAt} >= ${new Date(input.dateFrom)}`);
        }
        if (input?.dateTo) {
          const to = new Date(input.dateTo);
          to.setHours(23, 59, 59, 999);
          conditions.push(sql`${orders.createdAt} <= ${to}`);
        }
        if (input?.source && input.source !== "all") {
          conditions.push(sql`${orders.source} = ${input.source}`);
        }
        const whereClause = conditions.length > 0
          ? sql.join(conditions, sql` AND `)
          : sql`1=1`;

        const result = await db
          .select({
            category: sql<string>`COALESCE(${orderItems.productCategory}, 'Без категории')`,
            totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
            totalRevenue: sql<string>`SUM(${orderItems.totalPrice})`,
            productsCount: sql<number>`COUNT(DISTINCT ${orderItems.productArticle})`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(whereClause)
          .groupBy(orderItems.productCategory)
          .orderBy(desc(sql`SUM(${orderItems.totalPrice})`));
        return result;
      } catch (error) {
        console.error("Failed to get sales by category:", error);
        return [];
      }
    }),

    // Get all orders with pagination
    allOrders: adminProcedure
      .input(z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20),
        status: z.enum(["all", "processing", "completed", "cancelled"]).optional().default("all"),
        source: z.enum(["all", "website", "offline"]).optional().default("all"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { orders: [], total: 0 };

        try {
          const offset = (input.page - 1) * input.limit;

          const conditions: ReturnType<typeof sql>[] = [];
          if (input.status !== "all") {
            conditions.push(sql`status = ${input.status}`);
          }
          if (input.source !== "all") {
            conditions.push(sql`source = ${input.source}`);
          }
          if (input.dateFrom) {
            conditions.push(sql`createdAt >= ${new Date(input.dateFrom)}`);
          }
          if (input.dateTo) {
            const to = new Date(input.dateTo);
            to.setHours(23, 59, 59, 999);
            conditions.push(sql`createdAt <= ${to}`);
          }
          const whereClause = conditions.length > 0
            ? sql.join(conditions, sql` AND `)
            : undefined;

          let query = db.select().from(orders);
          if (whereClause) {
            query = query.where(whereClause) as typeof query;
          }

          const result = await query
            .orderBy(desc(orders.createdAt))
            .limit(input.limit)
            .offset(offset);

          // Get total count
          let countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(orders);
          if (whereClause) {
            countQuery = countQuery.where(whereClause) as typeof countQuery;
          }
          const countResult = await countQuery;
          const total = countResult[0]?.count || 0;

          return { orders: result, total };
        } catch (error) {
          console.error("Failed to get all orders:", error);
          return { orders: [], total: 0 };
        }
      }),

    // Get order details with items
    orderDetails: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        try {
          const orderResult = await db
            .select()
            .from(orders)
            .where(eq(orders.id, input.orderId))
            .limit(1);

          if (orderResult.length === 0) return null;

          const items = await db
            .select({
              id: orderItems.id,
              orderId: orderItems.orderId,
              productName: orderItems.productName,
              productArticle: orderItems.productArticle,
              productCategory: orderItems.productCategory,
              quantity: orderItems.quantity,
              price: orderItems.price,
              totalPrice: orderItems.totalPrice,
              createdAt: orderItems.createdAt,
              productImages: products.images,
            })
            .from(orderItems)
            .leftJoin(products, or(
              eq(orderItems.productArticle, products.article),
              eq(sql`CAST(SUBSTRING(${orderItems.productArticle}, 5) AS UNSIGNED)`, products.id)
            ))
            .where(eq(orderItems.orderId, input.orderId));

          return {
            ...orderResult[0],
            items,
          };
        } catch (error) {
          console.error("Failed to get order details:", error);
          return null;
        }
      }),

    // Get orders count by status
    ordersByStatus: adminProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        source: z.enum(["all", "website", "offline"]).optional().default("all"),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { new: 0, processing: 0, completed: 0, cancelled: 0 };

        try {
          const conditions: ReturnType<typeof sql>[] = [];
          if (input?.dateFrom) {
            conditions.push(sql`createdAt >= ${new Date(input.dateFrom)}`);
          }
          if (input?.dateTo) {
            const to = new Date(input.dateTo);
            to.setHours(23, 59, 59, 999);
            conditions.push(sql`createdAt <= ${to}`);
          }
          if (input?.source && input.source !== "all") {
            conditions.push(sql`source = ${input.source}`);
          }
          const dateWhere = conditions.length > 0
            ? sql.join(conditions, sql` AND `)
            : sql`1=1`;

          const result = await db
            .select({
              status: orders.status,
              count: sql<number>`COUNT(*)`,
            })
            .from(orders)
            .where(dateWhere)
            .groupBy(orders.status);

          const counts = { new: 0, processing: 0, completed: 0, cancelled: 0 };
          for (const row of result) {
            if (row.status in counts) {
              counts[row.status as keyof typeof counts] = row.count;
            }
          }
          return counts;
        } catch (error) {
          console.error("Failed to get orders by status:", error);
          return { new: 0, processing: 0, completed: 0, cancelled: 0 };
        }
      }),

    // Update order status
    updateOrderStatus: adminProcedure
      .input(z.object({
        orderId: z.number(),
        status: z.enum(["processing", "completed", "cancelled"]),
        cancelReason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("База данных недоступна");
        }

        try {
          // Get order data before update
          const orderData = await db
            .select()
            .from(orders)
            .where(eq(orders.id, input.orderId))
            .limit(1);

          const order = orderData[0];
          if (!order) {
            throw new Error("Заказ не найден");
          }

          // Update order status (and cancel reason if cancelling)
          const updateData: any = { status: input.status };
          if (input.status === "cancelled" && input.cancelReason) {
            updateData.comment = input.cancelReason;
          }
          await db
            .update(orders)
            .set(updateData)
            .where(eq(orders.id, input.orderId));

          // If status changed to "completed", create automatic income transaction
          if (input.status === "completed" && order.status !== "completed") {
            // Find or get the "Продажи" category
            let salesCategoryId: number | null = null;
            const salesCategory = await db
              .select()
              .from(financeCategories)
              .where(and(eq(financeCategories.name, "Продажи"), eq(financeCategories.type, "income")))
              .limit(1);

            if (salesCategory[0]) {
              salesCategoryId = salesCategory[0].id;
            }

            // Get customer ID if exists
            let customerId: number | null = null;
            const customer = await db
              .select()
              .from(customers)
              .where(eq(customers.phone, order.customerPhone))
              .limit(1);

            if (customer[0]) {
              customerId = customer[0].id;

              // Update customer stats
              await db.update(customers).set({
                totalOrders: sql`totalOrders + 1`,
                totalSpent: sql`totalSpent + ${order.totalAmount}`,
                lastOrderAt: new Date(),
              }).where(eq(customers.id, customerId));
            }

            // Create automatic transaction
            await db.insert(transactions).values({
              type: "income",
              categoryId: salesCategoryId,
              amount: order.totalAmount,
              description: `Заказ #${order.id} - ${order.customerName}`,
              orderId: order.id,
              customerId,
              date: new Date(),
              paymentMethod: "cash",
              isAutomatic: true,
              metadata: { orderStatus: input.status },
            });
          }

          return { success: true };
        } catch (error) {
          console.error("Failed to update order status:", error);
          throw new Error("Не удалось обновить статус заказа");
        }
      }),

    // Create manual order (admin creates order for phone/walk-in customer)
    createManualOrder: adminProcedure
      .input(z.object({
        customerName: z.string().min(1),
        customerPhone: z.string().min(1),
        comment: z.string().optional(),
        items: z.array(z.object({
          productName: z.string(),
          productArticle: z.string(),
          productCategory: z.string().optional(),
          quantity: z.number().min(1),
          price: z.string(),
        })).min(1),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        try {
          const totalAmount = input.items.reduce(
            (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
          ).toFixed(2);
          const itemsCount = input.items.reduce((sum, item) => sum + item.quantity, 0);

          // Find or create customer
          let customerId: number | null = null;
          const phone = input.customerPhone.trim();
          if (phone) {
            const existing = await db
              .select()
              .from(customers)
              .where(eq(customers.phone, phone))
              .limit(1);

            if (existing[0]) {
              customerId = existing[0].id;
            } else {
              const inserted = await db.insert(customers).values({
                phone,
                name: input.customerName.trim() || null,
                source: "phone",
                segment: "new",
              });
              customerId = Number(inserted[0].insertId);
            }
          }

          // Create order with source=offline, status=processing
          const orderResult = await db.insert(orders).values({
            customerName: input.customerName.trim(),
            customerPhone: phone || "—",
            comment: input.comment || null,
            status: "processing",
            totalAmount,
            itemsCount,
            source: "offline",
            customerId,
            paymentMethod: "cash",
          });
          const orderId = Number(orderResult[0].insertId);

          // Create order items
          await db.insert(orderItems).values(
            input.items.map((item) => ({
              orderId,
              productName: item.productName,
              productArticle: item.productArticle,
              productCategory: item.productCategory || null,
              quantity: item.quantity,
              price: item.price,
              totalPrice: (parseFloat(item.price) * item.quantity).toFixed(2),
            }))
          );

          return { success: true, orderId };
        } catch (error) {
          console.error("Failed to create manual order:", error);
          throw new Error("Не удалось создать заказ");
        }
      }),

    // Generate invoice HTML
    generateInvoice: adminProcedure
      .input(z.object({
        orderId: z.number(),
        buyerName: z.string().min(1),
        buyerInn: z.string().optional(),
        buyerKpp: z.string().optional(),
        buyerAddress: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        // Load order + items
        const orderData = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
        const order = orderData[0];
        if (!order) throw new Error("Заказ не найден");

        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));

        // Load IP requisites from settings
        const reqSetting = await db.select().from(businessSettings)
          .where(eq(businessSettings.key, "ip_requisites")).limit(1);

        const defaultReq = {
          fullName: "ИП РУЧКИН МАКСИМ АЛЕКСАНДРОВИЧ",
          inn: "345914013615",
          ogrn: "323940100192443",
          account: "40802810209400328837",
          bankName: "ПАО \"Банк ПСБ\" г. Ярославль",
          bik: "044525555",
          corrAccount: "30101810400000000555",
          phone: "+79591306531",
          address: "",
        };

        let req = defaultReq;
        if (reqSetting[0]) {
          try { req = { ...defaultReq, ...JSON.parse(reqSetting[0].value) }; } catch {}
        }

        const now = new Date();
        const invoiceNumber = `СЧ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${order.id}`;
        const invoiceDate = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) + " г.";

        const totalAmount = parseFloat(order.totalAmount);
        const totalWords = numberToWordsRu(totalAmount);

        const itemsRows = items.map((item, i) => `
          <tr>
            <td style="border:1px solid #333;padding:6px 8px;text-align:center">${i + 1}</td>
            <td style="border:1px solid #333;padding:6px 8px">${item.productName}</td>
            <td style="border:1px solid #333;padding:6px 8px;text-align:center">шт.</td>
            <td style="border:1px solid #333;padding:6px 8px;text-align:center">${item.quantity}</td>
            <td style="border:1px solid #333;padding:6px 8px;text-align:right">${parseFloat(item.price).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</td>
            <td style="border:1px solid #333;padding:6px 8px;text-align:right">${parseFloat(item.totalPrice).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</td>
          </tr>`).join("");

        const buyerInnKpp = [input.buyerInn, input.buyerKpp].filter(Boolean).join(" / ");

        const invoiceHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Счёт ${invoiceNumber}</title>
<style>
  @page { margin: 15mm; size: A4; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #333; margin: 0; padding: 20px; }
  .invoice-container { max-width: 780px; margin: 0 auto; }
  .bank-section { border: 2px solid #333; margin-bottom: 0; }
  .bank-section td { padding: 4px 8px; font-size: 12px; vertical-align: top; }
  .bank-section .label { color: #666; font-size: 10px; }
  .invoice-title { text-align: center; font-size: 18px; font-weight: bold; margin: 24px 0 4px; }
  .invoice-date { text-align: center; font-size: 13px; margin-bottom: 20px; color: #555; }
  .party-section { margin-bottom: 16px; }
  .party-section .label { font-weight: bold; display: inline; }
  .items-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .items-table th { border: 1px solid #333; padding: 6px 8px; background: #f5f5f5; font-size: 12px; text-align: center; }
  .total-section { text-align: right; margin: 12px 0; font-size: 14px; }
  .total-words { margin: 12px 0; font-weight: bold; font-size: 13px; }
  .sign-section { margin-top: 40px; display: flex; justify-content: space-between; align-items: end; }
  .sign-line { border-bottom: 1px solid #333; width: 200px; display: inline-block; margin: 0 8px; }
  .no-vat { color: #666; font-size: 12px; margin: 4px 0; text-align: right; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="invoice-container">

  <!-- Bank details header -->
  <table class="bank-section" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse">
    <tr>
      <td style="border:1px solid #333;width:55%;padding:4px 8px" rowspan="2">
        <div class="label">Банк получателя</div>
        <div style="font-weight:bold">${req.bankName}</div>
      </td>
      <td style="border:1px solid #333;padding:4px 8px">
        <div class="label">БИК</div>
        <div>${req.bik}</div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:4px 8px">
        <div class="label">К/с</div>
        <div>${req.corrAccount}</div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:4px 8px" rowspan="2">
        <div class="label">Получатель</div>
        <div style="font-weight:bold">${req.fullName}</div>
      </td>
      <td style="border:1px solid #333;padding:4px 8px">
        <div class="label">ИНН</div>
        <div>${req.inn}</div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:4px 8px">
        <div class="label">Р/с</div>
        <div>${req.account}</div>
      </td>
    </tr>
  </table>

  <!-- Invoice title -->
  <div class="invoice-title">СЧЁТ НА ОПЛАТУ № ${invoiceNumber}</div>
  <div class="invoice-date">от ${invoiceDate}</div>

  <!-- Parties -->
  <div class="party-section">
    <span class="label">Поставщик:</span> ${req.fullName}, ИНН ${req.inn}, ОГРН ${req.ogrn}${req.phone ? ", тел. " + req.phone : ""}${req.address ? ", " + req.address : ""}
  </div>
  <div class="party-section">
    <span class="label">Покупатель:</span> ${input.buyerName}${buyerInnKpp ? ", ИНН/КПП " + buyerInnKpp : ""}${input.buyerAddress ? ", " + input.buyerAddress : ""}
  </div>

  <!-- Items table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:5%">№</th>
        <th>Наименование товара</th>
        <th style="width:8%">Ед.</th>
        <th style="width:8%">Кол-во</th>
        <th style="width:14%">Цена, ₽</th>
        <th style="width:14%">Сумма, ₽</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="total-section">
    <strong>Итого: ${totalAmount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽</strong>
  </div>
  <div class="no-vat">Без НДС</div>
  <div class="total-words">
    Всего к оплате: ${totalWords}
  </div>

  <!-- QR Code for payment -->
  <div style="margin-top:30px;display:flex;align-items:flex-start;gap:20px;border-top:1px solid #ddd;padding-top:20px">
    <div id="qr-code" style="min-width:150px;min-height:150px"></div>
    <div style="font-size:11px;color:#666;line-height:1.5">
      <div style="font-weight:bold;font-size:12px;color:#333;margin-bottom:4px">QR-код для оплаты</div>
      <div>Получатель: ${req.fullName}</div>
      <div>Р/с: ${req.account}</div>
      <div>Банк: ${req.bankName}</div>
      <div>БИК: ${req.bik}</div>
      <div>Сумма: ${totalAmount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽</div>
      <div>Назначение: Оплата по счёту ${invoiceNumber}</div>
    </div>
  </div>

  <!-- Signature -->
  <div class="sign-section">
    <div>
      <span style="font-weight:bold">Индивидуальный предприниматель</span>
      <span class="sign-line"></span>
      <span>${req.fullName.replace("ИП ", "").split(" ").map((w, i) => i === 0 ? w : w[0] + ".").join(" ")}</span>
    </div>
  </div>

</div>
<script>
// Minimal QR Code generator (QR Code Model 2, alphanumeric)
(function(){
var d=document.getElementById("qr-code");
if(!d)return;
var text="ST00012|Name=${req.fullName.replace(/"/g, "")}|PersonalAcc=${req.account}|BankName=${req.bankName.replace(/"/g, "")}|BIC=${req.bik}|CorrespAcc=${req.corrAccount}|PayeeINN=${req.inn}|Sum=${Math.round(totalAmount * 100)}|Purpose=Оплата по счёту ${invoiceNumber}";
var img=new Image();
img.src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data="+encodeURIComponent(text);
img.alt="QR";
img.style.width="150px";
img.style.height="150px";
img.onerror=function(){d.innerHTML='<div style="width:150px;height:150px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:11px;color:#999">QR недоступен</div>'};
d.appendChild(img);
})();
</script>
</body>
</html>`;

        // Save invoice to order metadata
        const existingMeta = (order as any).metadata || {};
        await db.update(orders).set({
          isLegalEntity: true,
          metadata: {
            ...existingMeta,
            invoice: {
              number: invoiceNumber,
              date: invoiceDate,
              buyerName: input.buyerName,
              buyerInn: input.buyerInn,
              buyerKpp: input.buyerKpp,
              buyerAddress: input.buyerAddress,
              html: invoiceHtml,
            },
          },
        }).where(eq(orders.id, input.orderId));

        return { invoiceHtml, invoiceNumber, invoiceDate };
      }),

    // Generate act of completed works
    generateAct: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        const orderData = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
        const order = orderData[0];
        if (!order) throw new Error("Заказ не найден");
        if (order.status !== "completed") throw new Error("Заказ ещё не завершён");

        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
        const meta = (order as any).metadata || {};
        const invoice = meta.invoice;

        // Load requisites
        const reqSetting = await db.select().from(businessSettings)
          .where(eq(businessSettings.key, "ip_requisites")).limit(1);
        const defaultReq = {
          fullName: "ИП РУЧКИН МАКСИМ АЛЕКСАНДРОВИЧ",
          inn: "345914013615",
          ogrn: "323940100192443",
          account: "40802810209400328837",
          bankName: "ПАО \"Банк ПСБ\" г. Ярославль",
          bik: "044525555",
          corrAccount: "30101810400000000555",
          phone: "+79591306531",
          address: "",
        };
        let req = defaultReq;
        if (reqSetting[0]) {
          try { req = { ...defaultReq, ...JSON.parse(reqSetting[0].value) }; } catch {}
        }

        const now = new Date();
        const actNumber = invoice?.number ? invoice.number.replace("СЧ-", "АКТ-") : `АКТ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${order.id}`;
        const actDate = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) + " г.";
        const totalAmount = parseFloat(order.totalAmount);
        const totalWords = numberToWordsRu(totalAmount);
        const buyerName = invoice?.buyerName || order.customerName;
        const buyerInnKpp = [invoice?.buyerInn, invoice?.buyerKpp].filter(Boolean).join(" / ");

        const itemsRows = items.map((item, i) => `
          <tr>
            <td style="border:1px solid #333;padding:6px 8px;text-align:center">${i + 1}</td>
            <td style="border:1px solid #333;padding:6px 8px">${item.productName}</td>
            <td style="border:1px solid #333;padding:6px 8px;text-align:center">шт.</td>
            <td style="border:1px solid #333;padding:6px 8px;text-align:center">${item.quantity}</td>
            <td style="border:1px solid #333;padding:6px 8px;text-align:right">${parseFloat(item.price).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</td>
            <td style="border:1px solid #333;padding:6px 8px;text-align:right">${parseFloat(item.totalPrice).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</td>
          </tr>`).join("");

        const actHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Акт ${actNumber}</title>
<style>
  @page { margin: 15mm; size: A4; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #333; margin: 0; padding: 20px; }
  .act-container { max-width: 780px; margin: 0 auto; }
  .act-title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0 4px; }
  .act-date { text-align: center; font-size: 13px; margin-bottom: 20px; color: #555; }
  .party-section { margin-bottom: 10px; line-height: 1.6; }
  .party-section .label { font-weight: bold; }
  .items-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .items-table th { border: 1px solid #333; padding: 6px 8px; background: #f5f5f5; font-size: 12px; text-align: center; }
  .total-section { text-align: right; margin: 12px 0; font-size: 14px; }
  .total-words { margin: 8px 0; font-weight: bold; font-size: 13px; }
  .no-vat { color: #666; font-size: 12px; text-align: right; }
  .sign-block { margin-top: 30px; display: flex; justify-content: space-between; gap: 40px; }
  .sign-col { flex: 1; }
  .sign-col h4 { font-size: 13px; margin: 0 0 24px; color: #333; border-bottom: 1px solid #333; padding-bottom: 4px; }
  .sign-line { display: flex; align-items: flex-end; gap: 8px; margin-top: 20px; }
  .sign-dash { border-bottom: 1px solid #333; flex: 1; min-width: 120px; }
  .no-claims { margin: 20px 0; font-size: 13px; line-height: 1.6; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="act-container">

  <div class="act-title">АКТ № ${actNumber}</div>
  <div class="act-date">выполненных работ (оказанных услуг) от ${actDate}</div>

  ${invoice?.number ? `<div style="font-size:12px;color:#666;text-align:center;margin-bottom:16px">к счёту № ${invoice.number}</div>` : ""}

  <div class="party-section">
    <span class="label">Исполнитель:</span> ${req.fullName}, ИНН ${req.inn}${req.phone ? ", тел. " + req.phone : ""}${req.address ? ", " + req.address : ""}
  </div>
  <div class="party-section">
    <span class="label">Заказчик:</span> ${buyerName}${buyerInnKpp ? ", ИНН/КПП " + buyerInnKpp : ""}${invoice?.buyerAddress ? ", " + invoice.buyerAddress : ""}
  </div>

  <div class="party-section" style="margin-top:16px">
    Исполнитель выполнил, а Заказчик принял следующие работы (услуги):
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width:5%">№</th>
        <th>Наименование работ (услуг)</th>
        <th style="width:8%">Ед.</th>
        <th style="width:8%">Кол-во</th>
        <th style="width:14%">Цена, ₽</th>
        <th style="width:14%">Сумма, ₽</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="total-section">
    <strong>Итого: ${totalAmount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽</strong>
  </div>
  <div class="no-vat">Без НДС</div>
  <div class="total-words">
    Всего оказано услуг на сумму: ${totalWords}
  </div>

  <div class="no-claims">
    Вышеперечисленные работы (услуги) выполнены полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.
  </div>

  <div class="sign-block">
    <div class="sign-col">
      <h4>Исполнитель</h4>
      <div>${req.fullName}</div>
      <div class="sign-line">
        <span class="sign-dash"></span>
        <span>/ ${req.fullName.replace("ИП ", "").split(" ").map((w, i) => i === 0 ? w : w[0] + ".").join(" ")} /</span>
      </div>
    </div>
    <div class="sign-col">
      <h4>Заказчик</h4>
      <div>${buyerName}</div>
      <div class="sign-line">
        <span class="sign-dash"></span>
        <span>/                    /</span>
      </div>
    </div>
  </div>

</div>
</body>
</html>`;

        // Save act to order metadata
        await db.update(orders).set({
          metadata: {
            ...meta,
            act: {
              number: actNumber,
              date: actDate,
              html: actHtml,
            },
          },
        }).where(eq(orders.id, input.orderId));

        return { actHtml, actNumber, actDate };
      }),

    // Delete order
    deleteOrder: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        try {
          // Delete order items first
          await db.delete(orderItems).where(eq(orderItems.orderId, input.orderId));
          // Delete the order
          await db.delete(orders).where(eq(orders.id, input.orderId));
          return { success: true };
        } catch (error) {
          console.error("Failed to delete order:", error);
          throw new Error("Не удалось удалить заказ");
        }
      }),

    // Get contact requests
    contactRequests: adminProcedure
      .input(z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { requests: [], total: 0 };

        try {
          const offset = (input.page - 1) * input.limit;
          
          const result = await db
            .select()
            .from(contactRequests)
            .orderBy(desc(contactRequests.createdAt))
            .limit(input.limit)
            .offset(offset);

          const countResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(contactRequests);
          const total = countResult[0]?.count || 0;

          return { requests: result, total };
        } catch (error) {
          console.error("Failed to get contact requests:", error);
          return { requests: [], total: 0 };
        }
      }),

    // Update contact request status
    updateRequestStatus: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["new", "processed"]) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");
        await db.update(contactRequests).set({ status: input.status }).where(eq(contactRequests.id, input.id));
        return { success: true };
      }),

    // Delete contact request
    deleteRequest: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");
        await db.delete(contactRequests).where(eq(contactRequests.id, input.id));
        return { success: true };
      }),

    // Notification badge counts
    notificationCounts: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { newOrders: 0, newRequests: 0 };
      try {
        const ordersCount = await db.select({ count: sql<number>`COUNT(*)` }).from(orders)
          .where(eq(orders.status, "processing"));
        const requestsCount = await db.select({ count: sql<number>`COUNT(*)` }).from(contactRequests)
          .where(eq(contactRequests.status, "new"));
        return {
          newOrders: ordersCount[0]?.count || 0,
          newRequests: requestsCount[0]?.count || 0,
        };
      } catch {
        return { newOrders: 0, newRequests: 0 };
      }
    }),
  }),

  // Site content management router
  content: router({
    // Get all content (public)
    getAll: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];

      try {
        const result = await db.select().from(siteContent);
        return result;
      } catch (error) {
        console.error("Failed to get all content:", error);
        return [];
      }
    }),

    // Get content by page (public)
    getByPage: publicProcedure
      .input(z.object({ page: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          const result = await db
            .select()
            .from(siteContent)
            .where(eq(siteContent.page, input.page));
          return result;
        } catch (error) {
          console.error("Failed to get content by page:", error);
          return [];
        }
      }),

    // Get single content by key (public)
    getByKey: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        try {
          const result = await db
            .select()
            .from(siteContent)
            .where(eq(siteContent.key, input.key))
            .limit(1);
          return result[0] || null;
        } catch (error) {
          console.error("Failed to get content by key:", error);
          return null;
        }
      }),

    // Get content grouped by page (admin)
    list: adminProcedure
      .input(z.object({
        page: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          let query = db.select().from(siteContent);

          if (input?.page) {
            query = query.where(eq(siteContent.page, input.page)) as typeof query;
          }

          const result = await query.orderBy(siteContent.page, siteContent.section, siteContent.key);

          // Filter by search if provided
          if (input?.search) {
            const searchLower = input.search.toLowerCase();
            return result.filter(item =>
              item.key.toLowerCase().includes(searchLower) ||
              item.value.toLowerCase().includes(searchLower) ||
              item.description?.toLowerCase().includes(searchLower)
            );
          }

          return result;
        } catch (error) {
          console.error("Failed to list content:", error);
          return [];
        }
      }),

    // Create content (admin)
    create: adminProcedure
      .input(z.object({
        key: z.string().min(1).max(255),
        value: z.string().min(1),
        description: z.string().max(500).optional(),
        page: z.string().min(1).max(100),
        section: z.string().max(100).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("База данных недоступна");
        }

        try {
          // Check if key already exists
          const existing = await db
            .select()
            .from(siteContent)
            .where(eq(siteContent.key, input.key))
            .limit(1);

          if (existing.length > 0) {
            throw new Error("Ключ уже существует");
          }

          const result = await db.insert(siteContent).values({
            key: input.key,
            value: input.value,
            description: input.description || null,
            page: input.page,
            section: input.section || null,
          });

          triggerQdrantSync();
          return { success: true, id: Number(result[0].insertId) };
        } catch (error) {
          console.error("Failed to create content:", error);
          throw error;
        }
      }),

    // Update content (admin)
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        value: z.string().min(1).optional(),
        description: z.string().max(500).optional(),
        section: z.string().max(100).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("База данных недоступна");
        }

        try {
          const updateData: Record<string, string | null> = {};
          if (input.value !== undefined) updateData.value = input.value;
          if (input.description !== undefined) updateData.description = input.description || null;
          if (input.section !== undefined) updateData.section = input.section || null;

          await db
            .update(siteContent)
            .set(updateData)
            .where(eq(siteContent.id, input.id));

          triggerQdrantSync();
          return { success: true };
        } catch (error) {
          console.error("Failed to update content:", error);
          throw new Error("Не удалось обновить контент");
        }
      }),

    // Delete content (admin)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("База данных недоступна");
        }

        try {
          await db.delete(siteContent).where(eq(siteContent.id, input.id));
          triggerQdrantSync();
          return { success: true };
        } catch (error) {
          console.error("Failed to delete content:", error);
          throw new Error("Не удалось удалить контент");
        }
      }),

    // Bulk update content (admin) - useful for saving multiple edits at once
    bulkUpdate: adminProcedure
      .input(z.array(z.object({
        id: z.number(),
        value: z.string().min(1),
      })))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("База данных недоступна");
        }

        try {
          for (const item of input) {
            await db
              .update(siteContent)
              .set({ value: item.value })
              .where(eq(siteContent.id, item.id));
          }
          triggerQdrantSync();
          return { success: true, count: input.length };
        } catch (error) {
          console.error("Failed to bulk update content:", error);
          throw new Error("Не удалось обновить контент");
        }
      }),

    // Get available pages (admin)
    getPages: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];

      try {
        const result = await db
          .select({ page: siteContent.page })
          .from(siteContent)
          .groupBy(siteContent.page)
          .orderBy(siteContent.page);
        return result.map(r => r.page);
      } catch (error) {
        console.error("Failed to get pages:", error);
        return [];
      }
    }),
  }),

  // ========== CRM MODULE ==========
  crm: router({
    // Customer list with filtering and pagination
    customers: router({
      list: adminProcedure
        .input(z.object({
          segment: z.enum(["all", "new", "regular", "vip", "inactive"]).optional().default("all"),
          search: z.string().optional(),
          sortBy: z.enum(["name", "totalSpent", "lastOrderAt", "createdAt"]).optional().default("createdAt"),
          sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(20),
        }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return { customers: [], total: 0 };

          try {
            const offset = (input.page - 1) * input.limit;

            let baseQuery = db.select().from(customers);

            // Filter by segment
            if (input.segment !== "all") {
              baseQuery = baseQuery.where(eq(customers.segment, input.segment)) as typeof baseQuery;
            }

            // Sort
            const sortColumn = {
              name: customers.name,
              totalSpent: customers.totalSpent,
              lastOrderAt: customers.lastOrderAt,
              createdAt: customers.createdAt,
            }[input.sortBy];

            const result = await baseQuery
              .orderBy(input.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
              .limit(input.limit)
              .offset(offset);

            // Filter by search (client-side for now, can optimize with full-text later)
            let filtered = result;
            if (input.search) {
              const searchLower = input.search.toLowerCase();
              filtered = result.filter(c =>
                c.name?.toLowerCase().includes(searchLower) ||
                c.phone.toLowerCase().includes(searchLower) ||
                c.email?.toLowerCase().includes(searchLower)
              );
            }

            // Get total count
            let countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(customers);
            if (input.segment !== "all") {
              countQuery = countQuery.where(eq(customers.segment, input.segment)) as typeof countQuery;
            }
            const countResult = await countQuery;
            const total = countResult[0]?.count || 0;

            return { customers: filtered, total };
          } catch (error) {
            console.error("Failed to get customers:", error);
            return { customers: [], total: 0 };
          }
        }),

      // Get single customer with order history
      getById: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return null;

          try {
            const customerResult = await db
              .select()
              .from(customers)
              .where(eq(customers.id, input.id))
              .limit(1);

            if (customerResult.length === 0) return null;

            const customer = customerResult[0];

            // Get order history by phone
            const customerOrders = await db
              .select()
              .from(orders)
              .where(eq(orders.customerPhone, customer.phone))
              .orderBy(desc(orders.createdAt))
              .limit(50);

            // Get interactions
            const interactions = await db
              .select()
              .from(customerInteractions)
              .where(eq(customerInteractions.customerId, input.id))
              .orderBy(desc(customerInteractions.createdAt))
              .limit(50);

            // Get order IDs for items query
            const orderIds = customerOrders.map((o) => o.id);

            // Get top products by total amount across all orders
            let topProducts: { productName: string; productArticle: string; totalQty: number; totalAmount: number }[] = [];
            if (orderIds.length > 0) {
              const itemsResult = await db
                .select({
                  productName: orderItems.productName,
                  productArticle: orderItems.productArticle,
                  totalQty: sql<number>`SUM(${orderItems.quantity})`,
                  totalAmount: sql<number>`SUM(${orderItems.price} * ${orderItems.quantity})`,
                })
                .from(orderItems)
                .where(inArray(orderItems.orderId, orderIds))
                .groupBy(orderItems.productName, orderItems.productArticle)
                .orderBy(sql`SUM(${orderItems.price} * ${orderItems.quantity}) DESC`)
                .limit(10);
              topProducts = itemsResult;
            }

            return {
              ...customer,
              orders: customerOrders,
              interactions,
              topProducts,
            };
          } catch (error) {
            console.error("Failed to get customer:", error);
            return null;
          }
        }),

      // Create new customer
      create: adminProcedure
        .input(z.object({
          phone: z.string().regex(phoneRegex, "Некорректный номер телефона"),
          name: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          source: z.enum(["website", "telegram", "phone", "referral", "other"]).optional(),
          notes: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            // Check if customer exists
            const existing = await db
              .select()
              .from(customers)
              .where(eq(customers.phone, input.phone))
              .limit(1);

            if (existing.length > 0) {
              throw new Error("Клиент с таким телефоном уже существует");
            }

            const result = await db.insert(customers).values({
              phone: input.phone,
              name: input.name || null,
              email: input.email || null,
              source: input.source || "website",
              notes: input.notes || null,
            });

            return { success: true, id: Number(result[0].insertId) };
          } catch (error) {
            console.error("Failed to create customer:", error);
            throw error;
          }
        }),

      // Update customer
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          segment: z.enum(["new", "regular", "vip", "inactive"]).optional(),
          notes: z.string().optional(),
          telegramId: z.string().optional(),
          telegramUsername: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const { id, ...updateData } = input;
            const cleanData: Record<string, string | null> = {};

            if (updateData.name !== undefined) cleanData.name = updateData.name || null;
            if (updateData.email !== undefined) cleanData.email = updateData.email || null;
            if (updateData.segment !== undefined) cleanData.segment = updateData.segment;
            if (updateData.notes !== undefined) cleanData.notes = updateData.notes || null;
            if (updateData.telegramId !== undefined) cleanData.telegramId = updateData.telegramId || null;
            if (updateData.telegramUsername !== undefined) cleanData.telegramUsername = updateData.telegramUsername || null;

            await db.update(customers).set(cleanData).where(eq(customers.id, id));

            return { success: true };
          } catch (error) {
            console.error("Failed to update customer:", error);
            throw new Error("Не удалось обновить клиента");
          }
        }),

      // Delete customer
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            await db.delete(customers).where(eq(customers.id, input.id));
            return { success: true };
          } catch (error) {
            console.error("Failed to delete customer:", error);
            throw new Error("Не удалось удалить клиента");
          }
        }),

      // Sync customers from orders (migration helper)
      syncFromOrders: adminProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        try {
          // Get unique customers from completed orders only
          const orderCustomers = await db
            .select({
              phone: orders.customerPhone,
              name: orders.customerName,
              totalOrders: sql<number>`COUNT(*)`,
              totalSpent: sql<string>`SUM(totalAmount)`,
              lastOrderAt: sql<Date>`MAX(createdAt)`,
            })
            .from(orders)
            .where(eq(orders.status, "completed"))
            .groupBy(orders.customerPhone, orders.customerName);

          let created = 0;
          let updated = 0;

          for (const oc of orderCustomers) {
            // Check if customer exists
            const existing = await db
              .select()
              .from(customers)
              .where(eq(customers.phone, oc.phone))
              .limit(1);

            if (existing.length === 0) {
              // Create new customer
              await db.insert(customers).values({
                phone: oc.phone,
                name: oc.name,
                source: "website",
                totalOrders: oc.totalOrders,
                totalSpent: oc.totalSpent,
                lastOrderAt: oc.lastOrderAt,
                segment: oc.totalOrders >= 5 ? "regular" : oc.totalOrders >= 10 ? "vip" : "new",
              });
              created++;
            } else {
              // Update existing customer stats
              await db.update(customers).set({
                totalOrders: oc.totalOrders,
                totalSpent: oc.totalSpent,
                lastOrderAt: oc.lastOrderAt,
              }).where(eq(customers.phone, oc.phone));
              updated++;
            }
          }

          return { success: true, created, updated };
        } catch (error) {
          console.error("Failed to sync customers:", error);
          throw new Error("Не удалось синхронизировать клиентов");
        }
      }),
    }),

    // Customer interactions
    interactions: router({
      list: adminProcedure
        .input(z.object({
          customerId: z.number(),
          type: z.string().optional(),
          limit: z.number().optional().default(50),
        }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];

          try {
            let query = db
              .select()
              .from(customerInteractions)
              .where(eq(customerInteractions.customerId, input.customerId));

            const result = await query
              .orderBy(desc(customerInteractions.createdAt))
              .limit(input.limit);

            return result;
          } catch (error) {
            console.error("Failed to get interactions:", error);
            return [];
          }
        }),

      create: adminProcedure
        .input(z.object({
          customerId: z.number(),
          type: z.enum(["call", "message", "email", "order", "visit", "telegram", "ai_chat"]),
          direction: z.enum(["inbound", "outbound"]).optional().default("inbound"),
          summary: z.string(),
          metadata: z.record(z.string(), z.any()).optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const result = await db.insert(customerInteractions).values({
              customerId: input.customerId,
              type: input.type,
              direction: input.direction,
              summary: input.summary,
              metadata: input.metadata || null,
            });

            return { success: true, id: Number(result[0].insertId) };
          } catch (error) {
            console.error("Failed to create interaction:", error);
            throw new Error("Не удалось создать взаимодействие");
          }
        }),
    }),

    // CRM Statistics
    stats: router({
      overview: adminProcedure.query(async () => {
        const db = await getDb();
        if (!db) return {
          total: 0,
          bySegment: { new: 0, regular: 0, vip: 0, inactive: 0 },
          newThisMonth: 0,
        };

        try {
          // Total customers
          const totalResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(customers);
          const total = totalResult[0]?.count || 0;

          // By segment
          const segmentResult = await db
            .select({
              segment: customers.segment,
              count: sql<number>`COUNT(*)`,
            })
            .from(customers)
            .groupBy(customers.segment);

          const bySegment = { new: 0, regular: 0, vip: 0, inactive: 0 };
          for (const row of segmentResult) {
            if (row.segment && row.segment in bySegment) {
              bySegment[row.segment as keyof typeof bySegment] = row.count;
            }
          }

          // New this month
          const newThisMonthResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(customers)
            .where(sql`createdAt >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`);
          const newThisMonth = newThisMonthResult[0]?.count || 0;

          return { total, bySegment, newThisMonth };
        } catch (error) {
          console.error("Failed to get CRM stats:", error);
          return {
            total: 0,
            bySegment: { new: 0, regular: 0, vip: 0, inactive: 0 },
            newThisMonth: 0,
          };
        }
      }),
    }),
  }),

  // ========== CATALOG MODULE ==========
  catalog: router({
    // Products CRUD
    products: router({
      list: adminProcedure
        .input(z.object({
          category: z.string().optional(),
          subcategory: z.string().optional(),
          isActive: z.boolean().optional(),
          search: z.string().optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(50),
        }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return { products: [], total: 0 };

          try {
            const offset = (input.page - 1) * input.limit;

            // Build conditions array
            const conditions = [];
            if (input.category) {
              conditions.push(eq(products.category, input.category));
            }
            if (input.subcategory) {
              conditions.push(eq(products.subcategory, input.subcategory));
            }
            if (input.isActive !== undefined) {
              conditions.push(eq(products.isActive, input.isActive));
            }
            if (input.search) {
              const pattern = `%${input.search}%`;
              conditions.push(
                or(
                  like(products.name, pattern),
                  like(products.article, pattern),
                  like(products.description, pattern),
                )!
              );
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            const result = await db
              .select()
              .from(products)
              .where(whereClause)
              .orderBy(products.category, products.name)
              .limit(input.limit)
              .offset(offset);

            // Get total count with same filters
            const countResult = await db
              .select({ count: sql<number>`COUNT(*)` })
              .from(products)
              .where(whereClause);
            const total = countResult[0]?.count || 0;

            return { products: result, total };
          } catch (error) {
            console.error("Failed to get products:", error);
            return { products: [], total: 0 };
          }
        }),

      getById: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return null;

          try {
            const result = await db
              .select()
              .from(products)
              .where(eq(products.id, input.id))
              .limit(1);
            return result[0] || null;
          } catch (error) {
            console.error("Failed to get product:", error);
            return null;
          }
        }),

      // Public: get product by slug
      getBySlug: publicProcedure
        .input(z.object({ slug: z.string() }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return null;
          try {
            const result = await db.select().from(products)
              .where(eq(products.slug, input.slug)).limit(1);
            return result[0] || null;
          } catch { return null; }
        }),

      // Public: get product by id (for public pages)
      getPublicById: publicProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return null;
          try {
            const result = await db.select().from(products)
              .where(and(eq(products.id, input.id), eq(products.isActive, true))).limit(1);
            return result[0] || null;
          } catch { return null; }
        }),

      // Public: list active products for catalog page
      publicList: publicProcedure
        .input(z.object({
          category: z.string().optional(),
          subcategory: z.string().optional(),
          search: z.string().optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(100),
        }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return { products: [], total: 0 };
          try {
            const conditions = [eq(products.isActive, true)];
            if (input.category) conditions.push(eq(products.category, input.category));
            if (input.subcategory) conditions.push(eq(products.subcategory, input.subcategory));

            const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
            const offset = (input.page - 1) * input.limit;

            let result = await db.select().from(products)
              .where(whereClause)
              .orderBy(products.name)
              .limit(input.limit)
              .offset(offset);

            if (input.search) {
              const s = input.search.toLowerCase();
              result = result.filter(p =>
                p.name.toLowerCase().includes(s) ||
                p.article.toLowerCase().includes(s)
              );
            }

            const countResult = await db
              .select({ count: sql<number>`COUNT(*)` })
              .from(products)
              .where(whereClause);

            return { products: result, total: countResult[0]?.count || 0 };
          } catch (error) {
            console.error("Failed to get public products:", error);
            return { products: [], total: 0 };
          }
        }),

      // Admin: generate slugs for all products without slug
      generateSlugs: adminProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");
        const all = await db.select({ id: products.id, name: products.name, slug: products.slug }).from(products);
        let count = 0;
        for (const p of all) {
          if (p.slug) continue;
          let slug = slugify(p.name);
          const exists = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
          if (exists.length > 0) slug = `${slug}-${p.id}`;
          await db.update(products).set({ slug }).where(eq(products.id, p.id));
          count++;
        }
        return { updated: count };
      }),

      create: adminProcedure
        .input(z.object({
          article: z.string().min(1).max(100),
          name: z.string().min(1).max(255),
          description: z.string().optional(),
          category: z.string().optional(),
          subcategory: z.string().optional(),
          priceMin: z.number().positive().optional(),
          priceMax: z.number().positive().optional(),
          priceUnit: z.string().optional(),
          materials: z.string().optional(),
          dimensions: z.string().optional(),
          weight: z.string().optional(),
          productionTime: z.string().optional(),
          images: z.array(z.string()).optional(),
          isActive: z.boolean().optional().default(true),
          tags: z.array(z.string()).optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            // Check if article exists
            const existing = await db
              .select()
              .from(products)
              .where(eq(products.article, input.article))
              .limit(1);

            if (existing.length > 0) {
              throw new Error("Товар с таким артикулом уже существует");
            }

            // Auto-generate slug from name
            let slug = slugify(input.name);
            const slugExists = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
            if (slugExists.length > 0) slug = `${slug}-${Date.now()}`;

            const result = await db.insert(products).values({
              article: input.article,
              name: input.name,
              description: input.description || null,
              category: input.category || null,
              subcategory: input.subcategory || null,
              priceMin: input.priceMin?.toString() || null,
              priceMax: input.priceMax?.toString() || null,
              priceUnit: input.priceUnit || "шт",
              materials: input.materials || null,
              dimensions: input.dimensions || null,
              weight: input.weight || null,
              productionTime: input.productionTime || null,
              images: input.images || null,
              isActive: input.isActive,
              tags: input.tags || null,
              slug,
            });

            triggerQdrantSync();
            return { success: true, id: Number(result[0].insertId) };
          } catch (error) {
            console.error("Failed to create product:", error);
            throw error;
          }
        }),

      update: adminProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          category: z.string().optional(),
          subcategory: z.string().optional(),
          priceMin: z.number().positive().optional().nullable(),
          priceMax: z.number().positive().optional().nullable(),
          priceUnit: z.string().optional(),
          materials: z.string().optional(),
          dimensions: z.string().optional(),
          weight: z.string().optional(),
          productionTime: z.string().optional(),
          images: z.array(z.string()).optional(),
          isActive: z.boolean().optional(),
          stockStatus: z.enum(["in_stock", "to_order"]).optional(),
          tags: z.array(z.string()).optional(),
          slug: z.string().optional(),
          metaTitle: z.string().optional(),
          metaDescription: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const { id, ...data } = input;
            const updateData: Record<string, unknown> = {};

            if (data.name !== undefined) updateData.name = data.name;
            if (data.description !== undefined) updateData.description = data.description || null;
            if (data.category !== undefined) updateData.category = data.category || null;
            if (data.subcategory !== undefined) updateData.subcategory = data.subcategory || null;
            if (data.priceMin !== undefined) updateData.priceMin = data.priceMin?.toString() || null;
            if (data.priceMax !== undefined) updateData.priceMax = data.priceMax?.toString() || null;
            if (data.priceUnit !== undefined) updateData.priceUnit = data.priceUnit || "шт";
            if (data.materials !== undefined) updateData.materials = data.materials || null;
            if (data.dimensions !== undefined) updateData.dimensions = data.dimensions || null;
            if (data.weight !== undefined) updateData.weight = data.weight || null;
            if (data.productionTime !== undefined) updateData.productionTime = data.productionTime || null;
            if (data.images !== undefined) updateData.images = data.images || null;
            if (data.isActive !== undefined) updateData.isActive = data.isActive;
            if (data.stockStatus !== undefined) updateData.stockStatus = data.stockStatus;
            if (data.tags !== undefined) updateData.tags = data.tags || null;
            if (data.slug !== undefined) updateData.slug = data.slug || null;
            if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle || null;
            if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription || null;

            await db.update(products).set(updateData).where(eq(products.id, id));

            triggerQdrantSync();
            return { success: true };
          } catch (error) {
            console.error("Failed to update product:", error);
            throw new Error("Не удалось обновить товар");
          }
        }),

      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            await db.delete(products).where(eq(products.id, input.id));
            triggerQdrantSync();
            return { success: true };
          } catch (error) {
            console.error("Failed to delete product:", error);
            throw new Error("Не удалось удалить товар");
          }
        }),

      // Bulk update products
      bulkUpdate: adminProcedure
        .input(z.object({
          ids: z.array(z.number()).min(1),
          stockStatus: z.enum(["in_stock", "to_order"]).optional(),
          priceMin: z.number().positive().optional(),
          discountPercent: z.number().min(0).max(100).optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const updateData: Record<string, unknown> = {};
            if (input.stockStatus) updateData.stockStatus = input.stockStatus;
            if (input.priceMin !== undefined) updateData.priceMin = input.priceMin.toString();

            if (input.discountPercent !== undefined && input.discountPercent > 0) {
              // Apply discount: multiply existing priceMin by (1 - discount/100)
              const factor = (1 - input.discountPercent / 100).toFixed(4);
              await db.execute(
                sql`UPDATE products SET priceMin = ROUND(priceMin * ${factor}, 2) WHERE id IN (${sql.join(input.ids.map(id => sql`${id}`), sql`, `)})`
              );
            }

            if (Object.keys(updateData).length > 0) {
              await db.update(products).set(updateData).where(inArray(products.id, input.ids));
            }

            triggerQdrantSync();
            return { success: true, updated: input.ids.length };
          } catch (error) {
            console.error("Failed to bulk update products:", error);
            throw new Error("Не удалось массово обновить товары");
          }
        }),

      // Public search for products
      search: publicProcedure
        .input(z.object({
          query: z.string(),
          category: z.string().optional(),
          limit: z.number().optional().default(20),
        }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];

          try {
            const query = db
              .select()
              .from(products)
              .where(eq(products.isActive, true))
              .limit(input.limit);

            const result = await query;

            // Filter by search
            const searchLower = input.query.toLowerCase();
            let filtered = result.filter(p =>
              p.name.toLowerCase().includes(searchLower) ||
              p.article.toLowerCase().includes(searchLower) ||
              p.description?.toLowerCase().includes(searchLower) ||
              p.tags?.some(t => t.toLowerCase().includes(searchLower))
            );

            // Filter by category
            if (input.category) {
              filtered = filtered.filter(p => p.category === input.category);
            }

            return filtered;
          } catch (error) {
            console.error("Failed to search products:", error);
            return [];
          }
        }),
    }),

    // Product categories
    categories: router({
      list: publicProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];

        try {
          const result = await db
            .select()
            .from(productCategories)
            .where(eq(productCategories.isActive, true))
            .orderBy(productCategories.sortOrder, productCategories.name);
          return result;
        } catch (error) {
          console.error("Failed to get categories:", error);
          return [];
        }
      }),

      create: adminProcedure
        .input(z.object({
          name: z.string().min(1).max(100),
          slug: z.string().min(1).max(100),
          parentId: z.number().optional(),
          description: z.string().optional(),
          image: z.string().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const result = await db.insert(productCategories).values({
              name: input.name,
              slug: input.slug,
              parentId: input.parentId || null,
              description: input.description || null,
              image: input.image || null,
              sortOrder: input.sortOrder || 0,
            });

            return { success: true, id: Number(result[0].insertId) };
          } catch (error) {
            console.error("Failed to create category:", error);
            throw error;
          }
        }),

      update: adminProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          image: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const { id, ...data } = input;
            await db.update(productCategories).set(data).where(eq(productCategories.id, id));
            return { success: true };
          } catch (error) {
            console.error("Failed to update category:", error);
            throw new Error("Не удалось обновить категорию");
          }
        }),

      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            await db.delete(productCategories).where(eq(productCategories.id, input.id));
            return { success: true };
          } catch (error) {
            console.error("Failed to delete category:", error);
            throw new Error("Не удалось удалить категорию");
          }
        }),
    }),

    // Get unique subcategories from products (for dropdown compat)
    getCategories: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];

      try {
        const result = await db
          .select({ subcategory: products.subcategory })
          .from(products)
          .where(and(eq(products.isActive, true), sql`${products.subcategory} IS NOT NULL`))
          .groupBy(products.subcategory)
          .orderBy(products.subcategory);
        return result.map(r => r.subcategory).filter(Boolean) as string[];
      } catch (error) {
        console.error("Failed to get categories from products:", error);
        return [];
      }
    }),

    // Get main categories list
    getMainCategories: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        const result = await db
          .select({ category: products.category })
          .from(products)
          .where(eq(products.isActive, true))
          .groupBy(products.category)
          .orderBy(products.category);
        return result.map(r => r.category).filter(Boolean) as string[];
      } catch (error) {
        return [];
      }
    }),

    // Get full category tree (category → subcategories)
    getCategoryTree: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        const result = await db
          .select({
            category: products.category,
            subcategory: products.subcategory,
            count: sql<number>`COUNT(*)`,
          })
          .from(products)
          .where(eq(products.isActive, true))
          .groupBy(products.category, products.subcategory)
          .orderBy(products.category, products.subcategory);

        const tree: { category: string; subcategories: { name: string; count: number }[]; totalCount: number }[] = [];
        for (const row of result) {
          const cat = row.category || "Без категории";
          let existing = tree.find((t) => t.category === cat);
          if (!existing) {
            existing = { category: cat, subcategories: [], totalCount: 0 };
            tree.push(existing);
          }
          if (row.subcategory) {
            existing.subcategories.push({ name: row.subcategory, count: row.count });
          }
          existing.totalCount += row.count;
        }
        return tree;
      } catch (error) {
        console.error("Failed to get category tree:", error);
        return [];
      }
    }),

    // Rename category across all products
    renameCategory: adminProcedure
      .input(z.object({ oldName: z.string(), newName: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("БД недоступна");
        await db.update(products).set({ category: input.newName }).where(eq(products.category, input.oldName));
        return { success: true };
      }),

    // Add a new category (create a placeholder product or just validate)
    addCategory: adminProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ input }) => {
        // Categories are derived from products, so we just return success
        // The category will appear when products are assigned to it
        return { success: true, name: input.name };
      }),

    // Rename subcategory across all products
    renameSubcategory: adminProcedure
      .input(z.object({ category: z.string(), oldName: z.string(), newName: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("БД недоступна");
        await db.update(products)
          .set({ subcategory: input.newName })
          .where(and(eq(products.category, input.category), eq(products.subcategory, input.oldName)));
        return { success: true };
      }),

    // Delete category (set to null for all products with this category)
    deleteCategory: adminProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("БД недоступна");
        await db.update(products).set({ category: null, subcategory: null }).where(eq(products.category, input.name));
        return { success: true };
      }),

    // Delete subcategory
    deleteSubcategory: adminProcedure
      .input(z.object({ category: z.string(), name: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("БД недоступна");
        await db.update(products)
          .set({ subcategory: null })
          .where(and(eq(products.category, input.category), eq(products.subcategory, input.name)));
        return { success: true };
      }),

    // Generate barcode for a product
    generateBarcode: adminProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");
        const [product] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
        if (!product) throw new Error("Товар не найден");
        const barcodeValue = product.sku || product.article;
        await db.update(products).set({ barcode: barcodeValue }).where(eq(products.id, input.productId));
        return { barcode: barcodeValue };
      }),

    // Bulk generate barcodes
    bulkGenerateBarcodes: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");
        let count = 0;
        for (const id of input.ids) {
          const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
          if (!product) continue;
          const barcodeValue = product.sku || product.article;
          await db.update(products).set({ barcode: barcodeValue }).where(eq(products.id, id));
          count++;
        }
        return { generated: count };
      }),

    // Catalog statistics
    stats: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, inStock: 0, categories: 0 };

      try {
        const totalResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(products);
        const total = totalResult[0]?.count || 0;

        const inStockResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(products)
          .where(sql`${products.stockStatus} = 'in_stock' OR ${products.stockStatus} IS NULL`);
        const inStock = inStockResult[0]?.count || 0;

        const categoriesResult = await db
          .select({ count: sql<number>`COUNT(DISTINCT category)` })
          .from(products);
        const categories = categoriesResult[0]?.count || 0;

        return { total, inStock, categories };
      } catch (error) {
        console.error("Failed to get catalog stats:", error);
        return { total: 0, inStock: 0, categories: 0 };
      }
    }),
  }),

  // ========== UPLOAD ==========
  upload: router({
    productImage: adminProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ input }) => {
        const fs = await import("fs");
        const path = await import("path");

        const uploadsDir = path.resolve(
          import.meta.dirname, "..", "client", "public", "images", "uploads"
        );
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Clean filename, add timestamp to avoid collisions
        const ext = path.extname(input.filename) || ".jpg";
        const base = input.filename
          .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, "_")
          .replace(ext, "");
        const finalName = `${base}_${Date.now()}${ext}`;
        const filePath = path.join(uploadsDir, finalName);

        // Strip data URI prefix if present
        const base64Data = input.base64.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

        return { url: `/images/uploads/${finalName}` };
      }),
  }),

  // ========== BUSINESS SETTINGS ==========
  settings: router({
    // Get all settings
    list: adminProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          let query = db.select().from(businessSettings);

          if (input?.category) {
            query = query.where(eq(businessSettings.category, input.category)) as typeof query;
          }

          return await query.orderBy(businessSettings.category, businessSettings.key);
        } catch (error) {
          console.error("Failed to get settings:", error);
          return [];
        }
      }),

    // Get single setting by key
    get: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        try {
          const result = await db
            .select()
            .from(businessSettings)
            .where(eq(businessSettings.key, input.key))
            .limit(1);
          return result[0] || null;
        } catch (error) {
          console.error("Failed to get setting:", error);
          return null;
        }
      }),

    // Set/update setting
    set: adminProcedure
      .input(z.object({
        key: z.string().min(1).max(100),
        value: z.string(),
        type: z.enum(["string", "number", "boolean", "json"]).optional(),
        category: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        try {
          // Upsert: insert or update on duplicate key
          const existing = await db
            .select()
            .from(businessSettings)
            .where(eq(businessSettings.key, input.key))
            .limit(1);

          if (existing.length > 0) {
            await db.update(businessSettings).set({
              value: input.value,
              type: input.type || "string",
              category: input.category || null,
              description: input.description || null,
            }).where(eq(businessSettings.key, input.key));
          } else {
            await db.insert(businessSettings).values({
              key: input.key,
              value: input.value,
              type: input.type || "string",
              category: input.category || null,
              description: input.description || null,
            });
          }

          triggerQdrantSync();
          return { success: true };
        } catch (error) {
          console.error("Failed to set setting:", error);
          throw new Error("Не удалось сохранить настройку");
        }
      }),

    // Delete setting
    delete: adminProcedure
      .input(z.object({ key: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        try {
          await db.delete(businessSettings).where(eq(businessSettings.key, input.key));
          triggerQdrantSync();
          return { success: true };
        } catch (error) {
          console.error("Failed to delete setting:", error);
          throw new Error("Не удалось удалить настройку");
        }
      }),

    // Get multiple settings by keys
    getMany: publicProcedure
      .input(z.object({ keys: z.array(z.string()) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return {};

        try {
          const result = await db
            .select()
            .from(businessSettings)
            .where(inArray(businessSettings.key, input.keys));

          const settings: Record<string, string> = {};
          for (const row of result) {
            settings[row.key] = row.value;
          }
          return settings;
        } catch (error) {
          console.error("Failed to get settings:", error);
          return {};
        }
      }),
  }),

  // ========== FINANCE MODULE ==========
  finance: router({
    // Finance categories CRUD
    categories: router({
      list: adminProcedure
        .input(z.object({
          type: z.enum(["all", "income", "expense"]).optional().default("all"),
        }).optional())
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];

          try {
            let query = db.select().from(financeCategories);

            if (input?.type && input.type !== "all") {
              query = query.where(eq(financeCategories.type, input.type)) as typeof query;
            }

            return await query.orderBy(financeCategories.sortOrder, financeCategories.name);
          } catch (error) {
            console.error("Failed to get finance categories:", error);
            return [];
          }
        }),

      create: adminProcedure
        .input(z.object({
          name: z.string().min(1).max(100),
          type: z.enum(["income", "expense"]),
          color: z.string().optional(),
          icon: z.string().optional(),
          description: z.string().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const result = await db.insert(financeCategories).values({
              name: input.name,
              type: input.type,
              color: input.color || "#6B7280",
              icon: input.icon || null,
              description: input.description || null,
              sortOrder: input.sortOrder || 0,
            });

            return { success: true, id: Number(result[0].insertId) };
          } catch (error) {
            console.error("Failed to create finance category:", error);
            throw error;
          }
        }),

      update: adminProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          color: z.string().optional(),
          icon: z.string().optional(),
          description: z.string().optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const { id, ...data } = input;
            const updateData: Record<string, unknown> = {};

            if (data.name !== undefined) updateData.name = data.name;
            if (data.color !== undefined) updateData.color = data.color;
            if (data.icon !== undefined) updateData.icon = data.icon || null;
            if (data.description !== undefined) updateData.description = data.description || null;
            if (data.isActive !== undefined) updateData.isActive = data.isActive;
            if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

            await db.update(financeCategories).set(updateData).where(eq(financeCategories.id, id));
            return { success: true };
          } catch (error) {
            console.error("Failed to update finance category:", error);
            throw new Error("Не удалось обновить категорию");
          }
        }),

      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            // Check if it's a system category
            const category = await db
              .select()
              .from(financeCategories)
              .where(eq(financeCategories.id, input.id))
              .limit(1);

            if (category[0]?.isSystem) {
              throw new Error("Нельзя удалить системную категорию");
            }

            await db.delete(financeCategories).where(eq(financeCategories.id, input.id));
            return { success: true };
          } catch (error) {
            console.error("Failed to delete finance category:", error);
            throw error;
          }
        }),

      // Initialize default categories
      initDefaults: adminProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        const defaultCategories = [
          // Income categories
          { name: "Продажи", type: "income" as const, color: "#10B981", icon: "shopping-cart", isSystem: true, sortOrder: 1 },
          { name: "Услуги", type: "income" as const, color: "#3B82F6", icon: "wrench", isSystem: true, sortOrder: 2 },
          { name: "Другие доходы", type: "income" as const, color: "#8B5CF6", icon: "plus-circle", isSystem: true, sortOrder: 3 },
          // Expense categories
          { name: "Материалы", type: "expense" as const, color: "#EF4444", icon: "package", isSystem: true, sortOrder: 1 },
          { name: "Зарплата", type: "expense" as const, color: "#F59E0B", icon: "users", isSystem: true, sortOrder: 2 },
          { name: "Аренда", type: "expense" as const, color: "#EC4899", icon: "home", isSystem: true, sortOrder: 3 },
          { name: "Коммунальные", type: "expense" as const, color: "#6366F1", icon: "zap", isSystem: true, sortOrder: 4 },
          { name: "Транспорт", type: "expense" as const, color: "#14B8A6", icon: "truck", isSystem: true, sortOrder: 5 },
          { name: "Налоги", type: "expense" as const, color: "#64748B", icon: "file-text", isSystem: true, sortOrder: 6 },
          { name: "Другие расходы", type: "expense" as const, color: "#9CA3AF", icon: "minus-circle", isSystem: true, sortOrder: 7 },
        ];

        try {
          let created = 0;
          for (const cat of defaultCategories) {
            const existing = await db
              .select()
              .from(financeCategories)
              .where(and(eq(financeCategories.name, cat.name), eq(financeCategories.type, cat.type)))
              .limit(1);

            if (existing.length === 0) {
              await db.insert(financeCategories).values(cat);
              created++;
            }
          }

          return { success: true, created };
        } catch (error) {
          console.error("Failed to init default categories:", error);
          throw new Error("Не удалось создать категории по умолчанию");
        }
      }),
    }),

    // Transactions CRUD
    transactions: router({
      list: adminProcedure
        .input(z.object({
          type: z.enum(["all", "income", "expense"]).optional().default("all"),
          categoryId: z.number().optional(),
          accountId: z.number().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          search: z.string().optional(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(50),
        }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return { transactions: [], total: 0 };

          try {
            const offset = (input.page - 1) * input.limit;

            // Build WHERE conditions
            const conditions: ReturnType<typeof sql>[] = [];
            if (input.type !== "all") {
              conditions.push(sql`${transactions.type} = ${input.type}`);
            }
            if (input.categoryId) {
              conditions.push(sql`${transactions.categoryId} = ${input.categoryId}`);
            }
            if (input.accountId) {
              conditions.push(sql`${transactions.accountId} = ${input.accountId}`);
            }
            if (input.dateFrom) {
              conditions.push(sql`${transactions.date} >= ${new Date(input.dateFrom)}`);
            }
            if (input.dateTo) {
              const to = new Date(input.dateTo);
              to.setHours(23, 59, 59, 999);
              conditions.push(sql`${transactions.date} <= ${to}`);
            }
            const whereClause = conditions.length > 0
              ? sql.join(conditions, sql` AND `)
              : undefined;

            // Build query with joins
            let query = db
              .select({
                id: transactions.id,
                type: transactions.type,
                categoryId: transactions.categoryId,
                accountId: transactions.accountId,
                amount: transactions.amount,
                description: transactions.description,
                orderId: transactions.orderId,
                customerId: transactions.customerId,
                date: transactions.date,
                paymentMethod: transactions.paymentMethod,
                isAutomatic: transactions.isAutomatic,
                createdAt: transactions.createdAt,
                categoryName: financeCategories.name,
                categoryColor: financeCategories.color,
                accountName: financeAccounts.name,
              })
              .from(transactions)
              .leftJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
              .leftJoin(financeAccounts, eq(transactions.accountId, financeAccounts.id));

            if (whereClause) {
              query = query.where(whereClause) as typeof query;
            }

            let result = await query
              .orderBy(desc(transactions.date), desc(transactions.createdAt))
              .limit(input.limit)
              .offset(offset);

            // Filter by search
            if (input.search) {
              const searchLower = input.search.toLowerCase();
              result = result.filter(t =>
                t.description?.toLowerCase().includes(searchLower) ||
                t.categoryName?.toLowerCase().includes(searchLower)
              );
            }

            // Get total count
            let countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(transactions);
            if (whereClause) {
              countQuery = countQuery.where(whereClause) as typeof countQuery;
            }
            const countResult = await countQuery;
            const total = countResult[0]?.count || 0;

            return { transactions: result, total };
          } catch (error) {
            console.error("Failed to get transactions:", error);
            return { transactions: [], total: 0 };
          }
        }),

      getById: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return null;

          try {
            const result = await db
              .select({
                id: transactions.id,
                type: transactions.type,
                categoryId: transactions.categoryId,
                amount: transactions.amount,
                description: transactions.description,
                orderId: transactions.orderId,
                customerId: transactions.customerId,
                date: transactions.date,
                paymentMethod: transactions.paymentMethod,
                isAutomatic: transactions.isAutomatic,
                metadata: transactions.metadata,
                createdAt: transactions.createdAt,
                categoryName: financeCategories.name,
                categoryColor: financeCategories.color,
              })
              .from(transactions)
              .leftJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
              .where(eq(transactions.id, input.id))
              .limit(1);

            return result[0] || null;
          } catch (error) {
            console.error("Failed to get transaction:", error);
            return null;
          }
        }),

      create: adminProcedure
        .input(z.object({
          type: z.enum(["income", "expense"]),
          categoryId: z.number().optional(),
          amount: z.number().positive("Сумма должна быть положительной"),
          description: z.string().optional(),
          orderId: z.number().optional(),
          customerId: z.number().optional(),
          accountId: z.number().optional(),
          date: z.string(),
          paymentMethod: z.enum(["cash", "card", "transfer", "other"]).optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const result = await db.insert(transactions).values({
              type: input.type,
              categoryId: input.categoryId || null,
              amount: input.amount.toString(),
              description: input.description || null,
              orderId: input.orderId || null,
              customerId: input.customerId || null,
              accountId: input.accountId || null,
              date: new Date(input.date),
              paymentMethod: input.paymentMethod || "cash",
              isAutomatic: false,
            });

            // Update account balance if accountId provided
            if (input.accountId) {
              const balanceChange = input.type === "income" ? input.amount : -input.amount;
              await db.update(financeAccounts)
                .set({ balance: sql`balance + ${balanceChange.toString()}` })
                .where(eq(financeAccounts.id, input.accountId));
            }

            return { success: true, id: Number(result[0].insertId) };
          } catch (error) {
            console.error("Failed to create transaction:", error);
            throw new Error("Не удалось создать транзакцию");
          }
        }),

      update: adminProcedure
        .input(z.object({
          id: z.number(),
          categoryId: z.number().optional().nullable(),
          amount: z.number().positive().optional(),
          description: z.string().optional(),
          date: z.string().optional(),
          paymentMethod: z.enum(["cash", "card", "transfer", "other"]).optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const { id, ...data } = input;
            const updateData: Record<string, unknown> = {};

            if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
            if (data.amount !== undefined) updateData.amount = data.amount.toString();
            if (data.description !== undefined) updateData.description = data.description || null;
            if (data.date !== undefined) updateData.date = new Date(data.date);
            if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;

            await db.update(transactions).set(updateData).where(eq(transactions.id, id));
            return { success: true };
          } catch (error) {
            console.error("Failed to update transaction:", error);
            throw new Error("Не удалось обновить транзакцию");
          }
        }),

      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            // Get transaction to rollback account balance
            const txn = await db.select().from(transactions).where(eq(transactions.id, input.id)).limit(1);
            if (txn[0]?.accountId) {
              const rollback = txn[0].type === "income"
                ? `-${txn[0].amount}`
                : txn[0].amount;
              await db.update(financeAccounts)
                .set({ balance: sql`balance + ${rollback}` })
                .where(eq(financeAccounts.id, txn[0].accountId));
            }

            await db.delete(transactions).where(eq(transactions.id, input.id));
            return { success: true };
          } catch (error) {
            console.error("Failed to delete transaction:", error);
            throw new Error("Не удалось удалить транзакцию");
          }
        }),

      // Import transactions from CSV
      importCsv: adminProcedure
        .input(z.object({
          csvContent: z.string().min(1, "Файл пуст"),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          const lines = input.csvContent.trim().split("\n");
          if (lines.length < 2) throw new Error("Файл должен содержать заголовок и хотя бы одну строку данных");

          // Parse header
          const header = lines[0].split(";").map(h => h.trim().toLowerCase().replace(/"/g, ""));

          // Expected columns: дата;тип;сумма;категория;описание;способ_оплаты
          const dateIdx = header.findIndex(h => h === "дата" || h === "date");
          const typeIdx = header.findIndex(h => h === "тип" || h === "type");
          const amountIdx = header.findIndex(h => h === "сумма" || h === "amount");
          const categoryIdx = header.findIndex(h => h === "категория" || h === "category");
          const descIdx = header.findIndex(h => h === "описание" || h === "description");
          const methodIdx = header.findIndex(h => h === "способ_оплаты" || h === "payment_method" || h === "оплата");

          if (dateIdx === -1 || amountIdx === -1) {
            throw new Error("CSV должен содержать колонки: дата, сумма. Разделитель — точка с запятой (;)");
          }

          // Load categories for matching
          const allCategories = await db.select().from(financeCategories);
          const categoryMap = new Map(allCategories.map(c => [c.name.toLowerCase(), c]));

          let imported = 0;
          let skipped = 0;
          const errors: string[] = [];

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(";").map(c => c.trim().replace(/^"|"$/g, ""));

            try {
              const dateStr = cols[dateIdx];
              const amountStr = cols[amountIdx]?.replace(/\s/g, "").replace(",", ".");
              const amount = parseFloat(amountStr);

              if (!dateStr || isNaN(amount) || amount <= 0) {
                errors.push(`Строка ${i + 1}: некорректная дата или сумма`);
                skipped++;
                continue;
              }

              // Parse date (supports dd.mm.yyyy and yyyy-mm-dd)
              let parsedDate: Date;
              if (dateStr.includes(".")) {
                const [d, m, y] = dateStr.split(".");
                parsedDate = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
              } else {
                parsedDate = new Date(dateStr);
              }

              if (isNaN(parsedDate.getTime())) {
                errors.push(`Строка ${i + 1}: некорректный формат даты "${dateStr}"`);
                skipped++;
                continue;
              }

              // Determine type
              let type: "income" | "expense" = "expense";
              if (typeIdx !== -1) {
                const typeVal = cols[typeIdx]?.toLowerCase();
                if (typeVal === "доход" || typeVal === "income" || typeVal === "приход") {
                  type = "income";
                }
              }

              // Match category
              let categoryId: number | null = null;
              if (categoryIdx !== -1 && cols[categoryIdx]) {
                const catName = cols[categoryIdx].toLowerCase();
                const matched = categoryMap.get(catName);
                if (matched) {
                  categoryId = matched.id;
                }
              }

              // Payment method
              let paymentMethod: "cash" | "card" | "transfer" | "other" = "cash";
              if (methodIdx !== -1 && cols[methodIdx]) {
                const m = cols[methodIdx].toLowerCase();
                if (m === "карта" || m === "card") paymentMethod = "card";
                else if (m === "перевод" || m === "transfer") paymentMethod = "transfer";
                else if (m === "другое" || m === "other") paymentMethod = "other";
              }

              const description = descIdx !== -1 ? cols[descIdx] || null : null;

              await db.insert(transactions).values({
                type,
                categoryId,
                amount: amount.toString(),
                description,
                date: parsedDate,
                paymentMethod,
                isAutomatic: false,
              });

              imported++;
            } catch (err) {
              errors.push(`Строка ${i + 1}: ${err instanceof Error ? err.message : "неизвестная ошибка"}`);
              skipped++;
            }
          }

          return { imported, skipped, errors, total: lines.length - 1 };
        }),
    }),

    // Finance accounts CRUD
    accounts: router({
      list: adminProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];

        try {
          return await db.select().from(financeAccounts)
            .where(eq(financeAccounts.isActive, true))
            .orderBy(financeAccounts.sortOrder, financeAccounts.name);
        } catch (error) {
          console.error("Failed to get finance accounts:", error);
          return [];
        }
      }),

      listAll: adminProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];

        try {
          return await db.select().from(financeAccounts)
            .orderBy(financeAccounts.sortOrder, financeAccounts.name);
        } catch (error) {
          console.error("Failed to get all finance accounts:", error);
          return [];
        }
      }),

      create: adminProcedure
        .input(z.object({
          name: z.string().min(1).max(100),
          type: z.enum(["cash", "bank", "other"]),
          balance: z.number().optional().default(0),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const result = await db.insert(financeAccounts).values({
              name: input.name,
              type: input.type,
              balance: input.balance.toString(),
            });
            return { success: true, id: Number(result[0].insertId) };
          } catch (error) {
            console.error("Failed to create finance account:", error);
            throw new Error("Не удалось создать счёт");
          }
        }),

      update: adminProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          balance: z.number().optional(),
          isActive: z.boolean().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            const { id, ...data } = input;
            const updateData: Record<string, unknown> = {};
            if (data.name !== undefined) updateData.name = data.name;
            if (data.balance !== undefined) updateData.balance = data.balance.toString();
            if (data.isActive !== undefined) updateData.isActive = data.isActive;

            await db.update(financeAccounts).set(updateData).where(eq(financeAccounts.id, id));
            return { success: true };
          } catch (error) {
            console.error("Failed to update finance account:", error);
            throw new Error("Не удалось обновить счёт");
          }
        }),

      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            // Check if account has transactions
            const txnCount = await db
              .select({ count: sql<number>`COUNT(*)` })
              .from(transactions)
              .where(eq(transactions.accountId, input.id));

            if (txnCount[0]?.count > 0) {
              // Soft delete: just deactivate
              await db.update(financeAccounts)
                .set({ isActive: false })
                .where(eq(financeAccounts.id, input.id));
            } else {
              await db.delete(financeAccounts).where(eq(financeAccounts.id, input.id));
            }
            return { success: true };
          } catch (error) {
            console.error("Failed to delete finance account:", error);
            throw new Error("Не удалось удалить счёт");
          }
        }),

      transfer: adminProcedure
        .input(z.object({
          fromAccountId: z.number(),
          toAccountId: z.number(),
          amount: z.number().positive("Сумма должна быть положительной"),
          description: z.string().optional(),
          date: z.string(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("База данных недоступна");

          try {
            // Get "Другие расходы" and "Другие доходы" categories for transfer
            let expenseCatId: number | null = null;
            let incomeCatId: number | null = null;

            const cats = await db.select().from(financeCategories);
            for (const c of cats) {
              if (c.name === "Другие расходы" && c.type === "expense") expenseCatId = c.id;
              if (c.name === "Другие доходы" && c.type === "income") incomeCatId = c.id;
            }

            const txDate = new Date(input.date);
            const desc = input.description || "Перевод между счетами";

            // Create expense transaction from source
            await db.insert(transactions).values({
              type: "expense",
              categoryId: expenseCatId,
              accountId: input.fromAccountId,
              amount: input.amount.toString(),
              description: `${desc} (списание)`,
              date: txDate,
              paymentMethod: "transfer",
              isAutomatic: false,
            });

            // Create income transaction to destination
            await db.insert(transactions).values({
              type: "income",
              categoryId: incomeCatId,
              accountId: input.toAccountId,
              amount: input.amount.toString(),
              description: `${desc} (зачисление)`,
              date: txDate,
              paymentMethod: "transfer",
              isAutomatic: false,
            });

            // Update balances
            await db.update(financeAccounts)
              .set({ balance: sql`balance - ${input.amount.toString()}` })
              .where(eq(financeAccounts.id, input.fromAccountId));

            await db.update(financeAccounts)
              .set({ balance: sql`balance + ${input.amount.toString()}` })
              .where(eq(financeAccounts.id, input.toAccountId));

            return { success: true };
          } catch (error) {
            console.error("Failed to transfer between accounts:", error);
            throw new Error("Не удалось выполнить перевод");
          }
        }),

      initDefaults: adminProcedure.mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        try {
          const existing = await db.select().from(financeAccounts);
          if (existing.length > 0) return { success: true, created: 0 };

          await db.insert(financeAccounts).values([
            { name: "Наличные", type: "cash" as const, balance: "0", sortOrder: 1 },
            { name: "Расчётный счёт", type: "bank" as const, balance: "0", sortOrder: 2 },
            { name: "Карта", type: "bank" as const, balance: "0", sortOrder: 3 },
          ]);

          return { success: true, created: 3 };
        } catch (error) {
          console.error("Failed to init default accounts:", error);
          throw new Error("Не удалось создать счета по умолчанию");
        }
      }),
    }),

    // Finance statistics and dashboard
    stats: router({
      // Overview for dashboard
      overview: adminProcedure
        .input(z.object({
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        }).optional())
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return {
            totalIncome: 0,
            totalExpense: 0,
            balance: 0,
            transactionsCount: 0,
          };

          try {
            const conditions: ReturnType<typeof sql>[] = [];
            if (input?.dateFrom) {
              conditions.push(sql`date >= ${new Date(input.dateFrom)}`);
            }
            if (input?.dateTo) {
              const to = new Date(input.dateTo);
              to.setHours(23, 59, 59, 999);
              conditions.push(sql`date <= ${to}`);
            }
            const dateWhere = conditions.length > 0
              ? sql.join(conditions, sql` AND `)
              : sql`1=1`;

            // Get income
            const incomeResult = await db
              .select({ sum: sql<string>`COALESCE(SUM(amount), 0)` })
              .from(transactions)
              .where(sql`type = 'income' AND ${dateWhere}`);
            const totalIncome = parseFloat(incomeResult[0]?.sum || "0");

            // Get expenses
            const expenseResult = await db
              .select({ sum: sql<string>`COALESCE(SUM(amount), 0)` })
              .from(transactions)
              .where(sql`type = 'expense' AND ${dateWhere}`);
            const totalExpense = parseFloat(expenseResult[0]?.sum || "0");

            // Get transactions count
            const countResult = await db
              .select({ count: sql<number>`COUNT(*)` })
              .from(transactions)
              .where(dateWhere);
            const transactionsCount = countResult[0]?.count || 0;

            return {
              totalIncome,
              totalExpense,
              balance: totalIncome - totalExpense,
              transactionsCount,
            };
          } catch (error) {
            console.error("Failed to get finance overview:", error);
            return {
              totalIncome: 0,
              totalExpense: 0,
              balance: 0,
              transactionsCount: 0,
            };
          }
        }),

      // Chart data by period
      byPeriod: adminProcedure
        .input(z.object({
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];

          try {
            const dateFormat = "%d.%m";

            const conditions: ReturnType<typeof sql>[] = [];
            if (input.dateFrom) {
              conditions.push(sql`date >= ${new Date(input.dateFrom)}`);
            }
            if (input.dateTo) {
              const to = new Date(input.dateTo);
              to.setHours(23, 59, 59, 999);
              conditions.push(sql`date <= ${to}`);
            }
            const dateWhere = conditions.length > 0
              ? sql.join(conditions, sql` AND `)
              : sql`1=1`;

            const result = await db
              .select({
                period: sql<string>`DATE_FORMAT(date, ${dateFormat})`,
                income: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
                expense: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
              })
              .from(transactions)
              .where(dateWhere)
              .groupBy(sql`DATE_FORMAT(date, ${dateFormat})`)
              .orderBy(sql`MIN(date)`);

            return result.map(row => ({
              period: row.period,
              income: parseFloat(row.income),
              expense: parseFloat(row.expense),
              profit: parseFloat(row.income) - parseFloat(row.expense),
            }));
          } catch (error) {
            console.error("Failed to get finance by period:", error);
            return [];
          }
        }),

      // By category breakdown
      byCategory: adminProcedure
        .input(z.object({
          type: z.enum(["income", "expense"]),
          period: z.enum(["week", "month", "year", "all"]).optional().default("month"),
        }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];

          try {
            let dateFilter = "";
            switch (input.period) {
              case "week":
                dateFilter = "AND date >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
                break;
              case "month":
                dateFilter = "AND date >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
                break;
              case "year":
                dateFilter = "AND date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
                break;
              default:
                dateFilter = "";
            }

            const result = await db
              .select({
                categoryId: transactions.categoryId,
                categoryName: financeCategories.name,
                categoryColor: financeCategories.color,
                total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
                count: sql<number>`COUNT(*)`,
              })
              .from(transactions)
              .leftJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
              .where(sql.raw(`type = '${input.type}' ${dateFilter}`))
              .groupBy(transactions.categoryId, financeCategories.name, financeCategories.color)
              .orderBy(desc(sql`SUM(${transactions.amount})`));

            return result.map(row => ({
              categoryId: row.categoryId,
              categoryName: row.categoryName || "Без категории",
              categoryColor: row.categoryColor || "#9CA3AF",
              total: parseFloat(row.total),
              count: row.count,
            }));
          } catch (error) {
            console.error("Failed to get finance by category:", error);
            return [];
          }
        }),

      // Recent transactions for dashboard
      recent: adminProcedure
        .input(z.object({ limit: z.number().optional().default(10) }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];

          try {
            const result = await db
              .select({
                id: transactions.id,
                type: transactions.type,
                amount: transactions.amount,
                description: transactions.description,
                date: transactions.date,
                categoryName: financeCategories.name,
                categoryColor: financeCategories.color,
              })
              .from(transactions)
              .leftJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
              .orderBy(desc(transactions.date), desc(transactions.createdAt))
              .limit(input.limit);

            return result;
          } catch (error) {
            console.error("Failed to get recent transactions:", error);
            return [];
          }
        }),
    }),
  }),

  // Shop router — offline sales POS interface
  shop: router({
    // Search orders for cashier (active orders only)
    searchOrders: adminProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          const q = `%${input.query}%`;
          const result = await db
            .select()
            .from(orders)
            .where(
              and(
                or(
                  like(orders.customerName, q),
                  like(orders.customerPhone, q),
                  sql`${orders.id} = ${parseInt(input.query) || 0}`
                ),
                sql`${orders.status} = 'processing'`
              )
            )
            .orderBy(desc(orders.createdAt))
            .limit(20);
          return result;
        } catch (error) {
          console.error("Failed to search orders:", error);
          return [];
        }
      }),

    // Create offline sale (new order from scratch)
    createSale: adminProcedure
      .input(z.object({
        customerName: z.string().optional().default(""),
        customerPhone: z.string().optional().default(""),
        customerId: z.number().optional(),
        items: z.array(z.object({
          productName: z.string(),
          productArticle: z.string(),
          productCategory: z.string().optional(),
          quantity: z.number().min(1),
          price: z.string(),
        })),
        paymentMethod: z.enum(["cash", "card", "transfer", "other"]).default("cash"),
        comment: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        try {
          const totalAmount = input.items.reduce(
            (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
          ).toFixed(2);
          const itemsCount = input.items.reduce((sum, item) => sum + item.quantity, 0);

          const customerName = input.customerName?.trim() || "Неизвестный клиент";
          const customerPhone = input.customerPhone?.trim() || "";

          // Find or create customer (only if phone provided)
          let customerId = input.customerId || null;
          if (!customerId && customerPhone) {
            const existing = await db
              .select()
              .from(customers)
              .where(eq(customers.phone, customerPhone))
              .limit(1);

            if (existing[0]) {
              customerId = existing[0].id;
            } else {
              const inserted = await db.insert(customers).values({
                phone: customerPhone,
                name: customerName !== "Неизвестный клиент" ? customerName : null,
                source: "other",
                segment: "new",
              });
              customerId = Number(inserted[0].insertId);
            }
          }

          // Create order with source=offline, status=completed
          const orderResult = await db.insert(orders).values({
            customerName,
            customerPhone: customerPhone || "—",
            comment: input.comment || null,
            status: "completed",
            totalAmount,
            itemsCount,
            source: "offline",
            customerId,
            paymentMethod: input.paymentMethod,
          });
          const orderId = Number(orderResult[0].insertId);

          // Create order items
          if (input.items.length > 0) {
            await db.insert(orderItems).values(
              input.items.map((item) => ({
                orderId,
                productName: item.productName,
                productArticle: item.productArticle,
                productCategory: item.productCategory || null,
                quantity: item.quantity,
                price: item.price,
                totalPrice: (parseFloat(item.price) * item.quantity).toFixed(2),
              }))
            );
          }

          // Create income transaction
          let salesCategoryId: number | null = null;
          const salesCategory = await db
            .select()
            .from(financeCategories)
            .where(and(eq(financeCategories.name, "Продажи"), eq(financeCategories.type, "income")))
            .limit(1);
          if (salesCategory[0]) salesCategoryId = salesCategory[0].id;

          // Resolve account by payment method
          const accountId = await getAccountByPaymentMethod(db, input.paymentMethod);

          await db.insert(transactions).values({
            type: "income",
            categoryId: salesCategoryId,
            amount: totalAmount,
            description: `Продажа #${orderId} (магазин) — ${customerName}`,
            orderId,
            customerId,
            accountId,
            date: new Date(),
            paymentMethod: input.paymentMethod,
            isAutomatic: true,
            metadata: { source: "offline" },
          });

          // Update account balance
          if (accountId) {
            await db.update(financeAccounts)
              .set({ balance: sql`balance + ${totalAmount}` })
              .where(eq(financeAccounts.id, accountId));
          }

          // Update customer stats
          if (customerId) {
            await db.update(customers).set({
              totalOrders: sql`totalOrders + 1`,
              totalSpent: sql`totalSpent + ${totalAmount}`,
              lastOrderAt: new Date(),
            }).where(eq(customers.id, customerId));
          }

          return { success: true, orderId };
        } catch (error) {
          console.error("Failed to create sale:", error);
          throw new Error("Не удалось создать продажу");
        }
      }),

    // Complete sale for existing website order
    completeSale: adminProcedure
      .input(z.object({
        orderId: z.number(),
        paymentMethod: z.enum(["cash", "card", "transfer", "other"]).default("cash"),
        items: z.array(z.object({
          productName: z.string(),
          productArticle: z.string(),
          productCategory: z.string().optional(),
          quantity: z.number().min(1),
          price: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        try {
          const orderData = await db
            .select()
            .from(orders)
            .where(eq(orders.id, input.orderId))
            .limit(1);

          const order = orderData[0];
          if (!order) throw new Error("Заказ не найден");
          if (order.status === "completed") throw new Error("Заказ уже завершён");

          // If items provided, update order items and recalculate total
          let finalAmount = order.totalAmount;
          if (input.items && input.items.length > 0) {
            // Delete old items
            await db.delete(orderItems).where(eq(orderItems.orderId, input.orderId));
            // Insert new items
            for (const item of input.items) {
              const totalPrice = (parseFloat(item.price) * item.quantity).toFixed(2);
              await db.insert(orderItems).values({
                orderId: input.orderId,
                productName: item.productName,
                productArticle: item.productArticle,
                productCategory: item.productCategory || null,
                quantity: item.quantity,
                price: item.price,
                totalPrice,
              });
            }
            // Recalculate total
            const newTotal = input.items.reduce(
              (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
            ).toFixed(2);
            const newItemsCount = input.items.reduce((sum, item) => sum + item.quantity, 0);
            finalAmount = newTotal;
            await db.update(orders).set({
              totalAmount: newTotal,
              itemsCount: newItemsCount,
            }).where(eq(orders.id, input.orderId));
          }

          // Update order
          await db.update(orders).set({
            status: "completed",
            paymentMethod: input.paymentMethod,
          }).where(eq(orders.id, input.orderId));

          // Create transaction
          let salesCategoryId: number | null = null;
          const salesCategory = await db
            .select()
            .from(financeCategories)
            .where(and(eq(financeCategories.name, "Продажи"), eq(financeCategories.type, "income")))
            .limit(1);
          if (salesCategory[0]) salesCategoryId = salesCategory[0].id;

          let customerId: number | null = null;
          const customer = await db
            .select()
            .from(customers)
            .where(eq(customers.phone, order.customerPhone))
            .limit(1);
          if (customer[0]) {
            customerId = customer[0].id;
            await db.update(customers).set({
              totalOrders: sql`totalOrders + 1`,
              totalSpent: sql`totalSpent + ${finalAmount}`,
              lastOrderAt: new Date(),
            }).where(eq(customers.id, customerId));
          }

          // Resolve account by payment method
          const accountId = await getAccountByPaymentMethod(db, input.paymentMethod);

          await db.insert(transactions).values({
            type: "income",
            categoryId: salesCategoryId,
            amount: finalAmount,
            description: `Заказ #${order.id} — ${order.customerName}`,
            orderId: order.id,
            customerId,
            accountId,
            date: new Date(),
            paymentMethod: input.paymentMethod,
            isAutomatic: true,
            metadata: { source: order.source },
          });

          // Update account balance
          if (accountId) {
            await db.update(financeAccounts)
              .set({ balance: sql`balance + ${finalAmount}` })
              .where(eq(financeAccounts.id, accountId));
          }

          return { success: true };
        } catch (error) {
          console.error("Failed to complete sale:", error);
          throw new Error(error instanceof Error ? error.message : "Не удалось оформить продажу");
        }
      }),

    // Today's sales
    todaySales: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await db
          .select()
          .from(orders)
          .where(
            and(
              sql`${orders.status} = 'completed'`,
              sql`${orders.createdAt} >= ${today}`
            )
          )
          .orderBy(desc(orders.createdAt))
          .limit(50);
        return result;
      } catch (error) {
        console.error("Failed to get today sales:", error);
        return [];
      }
    }),

    // Recent sales history with pagination
    recentSales: adminProcedure
      .input(z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        search: z.string().optional(),
        paymentMethod: z.enum(["cash", "card", "transfer", "other", "all"]).optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { sales: [], total: 0, totalAmount: 0 };

        try {
          const offset = (input.page - 1) * input.limit;

          const conditions: any[] = [
            sql`${orders.status} = 'completed'`,
            sql`${orders.source} = 'offline'`,
          ];

          if (input.dateFrom) {
            conditions.push(sql`${orders.createdAt} >= ${new Date(input.dateFrom)}`);
          }
          if (input.dateTo) {
            conditions.push(sql`${orders.createdAt} <= ${new Date(input.dateTo)}`);
          }
          if (input.paymentMethod && input.paymentMethod !== "all") {
            conditions.push(sql`${orders.paymentMethod} = ${input.paymentMethod}`);
          }
          if (input.search && input.search.trim()) {
            const q = `%${input.search.trim()}%`;
            conditions.push(sql`(${orders.customerName} LIKE ${q} OR ${orders.customerPhone} LIKE ${q} OR CAST(${orders.id} AS CHAR) LIKE ${q})`);
          }

          const where = sql.join(conditions, sql` AND `);

          const result = await db
            .select()
            .from(orders)
            .where(where)
            .orderBy(desc(orders.createdAt))
            .limit(input.limit)
            .offset(offset);

          const countResult = await db
            .select({
              count: sql<number>`COUNT(*)`,
              totalAmount: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
            })
            .from(orders)
            .where(where);
          const total = countResult[0]?.count || 0;
          const totalAmount = parseFloat(countResult[0]?.totalAmount || "0");

          return { sales: result, total, totalAmount };
        } catch (error) {
          console.error("Failed to get recent sales:", error);
          return { sales: [], total: 0, totalAmount: 0 };
        }
      }),

    // Offline sales stats for period
    stats: adminProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { revenue: 0, salesCount: 0, avgCheck: 0, itemsSold: 0, byPayment: [] };

        try {
          const conditions: ReturnType<typeof sql>[] = [
            sql`${orders.source} = 'offline'`,
            sql`${orders.status} = 'completed'`,
          ];
          if (input?.dateFrom) conditions.push(sql`${orders.createdAt} >= ${new Date(input.dateFrom)}`);
          if (input?.dateTo) {
            const to = new Date(input.dateTo);
            to.setHours(23, 59, 59, 999);
            conditions.push(sql`${orders.createdAt} <= ${to}`);
          }
          const where = sql.join(conditions, sql` AND `);

          const revenueResult = await db
            .select({
              revenue: sql<string>`COALESCE(SUM(totalAmount), 0)`,
              count: sql<number>`COUNT(*)`,
              items: sql<number>`COALESCE(SUM(itemsCount), 0)`,
            })
            .from(orders)
            .where(where);

          const revenue = parseFloat(revenueResult[0]?.revenue || "0");
          const salesCount = revenueResult[0]?.count || 0;
          const itemsSold = revenueResult[0]?.items || 0;
          const avgCheck = salesCount > 0 ? revenue / salesCount : 0;

          // By payment method
          const byPayment = await db
            .select({
              method: orders.paymentMethod,
              count: sql<number>`COUNT(*)`,
              total: sql<string>`COALESCE(SUM(totalAmount), 0)`,
            })
            .from(orders)
            .where(where)
            .groupBy(orders.paymentMethod);

          return { revenue, salesCount, avgCheck, itemsSold, byPayment };
        } catch (error) {
          console.error("Failed to get shop stats:", error);
          return { revenue: 0, salesCount: 0, avgCheck: 0, itemsSold: 0, byPayment: [] };
        }
      }),

    // Sales dynamics by day
    salesByDay: adminProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          const conditions: ReturnType<typeof sql>[] = [
            sql`${orders.source} = 'offline'`,
            sql`${orders.status} = 'completed'`,
          ];
          if (input?.dateFrom) conditions.push(sql`${orders.createdAt} >= ${new Date(input.dateFrom)}`);
          if (input?.dateTo) {
            const to = new Date(input.dateTo);
            to.setHours(23, 59, 59, 999);
            conditions.push(sql`${orders.createdAt} <= ${to}`);
          }
          const where = sql.join(conditions, sql` AND `);

          const result = await db
            .select({
              date: sql<string>`DATE(createdAt)`,
              revenue: sql<string>`COALESCE(SUM(totalAmount), 0)`,
              count: sql<number>`COUNT(*)`,
            })
            .from(orders)
            .where(where)
            .groupBy(sql`DATE(createdAt)`)
            .orderBy(sql`DATE(createdAt)`);

          return result.map((r) => ({
            date: r.date,
            revenue: parseFloat(r.revenue),
            count: r.count,
          }));
        } catch (error) {
          console.error("Failed to get sales by day:", error);
          return [];
        }
      }),

    // Top products (offline only)
    topProducts: adminProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().optional().default(10),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          const conditions: ReturnType<typeof sql>[] = [
            sql`${orders.source} = 'offline'`,
            sql`${orders.status} = 'completed'`,
          ];
          if (input?.dateFrom) conditions.push(sql`${orders.createdAt} >= ${new Date(input.dateFrom)}`);
          if (input?.dateTo) {
            const to = new Date(input.dateTo);
            to.setHours(23, 59, 59, 999);
            conditions.push(sql`${orders.createdAt} <= ${to}`);
          }
          const where = sql.join(conditions, sql` AND `);

          const result = await db
            .select({
              name: orderItems.productName,
              article: orderItems.productArticle,
              totalQty: sql<number>`SUM(${orderItems.quantity})`,
              totalRevenue: sql<string>`SUM(${orderItems.totalPrice})`,
            })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .where(where)
            .groupBy(orderItems.productName, orderItems.productArticle)
            .orderBy(sql`SUM(${orderItems.totalPrice}) DESC`)
            .limit(input?.limit || 10);

          return result.map((r) => ({
            name: r.name,
            article: r.article,
            quantity: r.totalQty,
            revenue: parseFloat(r.totalRevenue || "0"),
          }));
        } catch (error) {
          console.error("Failed to get top products:", error);
          return [];
        }
      }),

    // Search products for sale form
    searchProducts: adminProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          const q = `%${input.query}%`;
          const result = await db
            .select({
              id: products.id,
              article: products.article,
              name: products.name,
              category: products.category,
              priceMin: products.priceMin,
              priceMax: products.priceMax,
              priceUnit: products.priceUnit,
              images: products.images,
            })
            .from(products)
            .where(
              and(
                eq(products.isActive, true),
                or(
                  like(products.name, q),
                  like(products.article, q),
                  like(products.category, q),
                  like(products.barcode, q)
                )
              )
            )
            .limit(20);
          return result;
        } catch (error) {
          console.error("Failed to search products:", error);
          return [];
        }
      }),

    // Find product by barcode (exact match) for barcode scanner
    findByBarcode: adminProcedure
      .input(z.object({ barcode: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        try {
          const result = await db
            .select({
              id: products.id,
              article: products.article,
              name: products.name,
              category: products.category,
              priceMin: products.priceMin,
              priceMax: products.priceMax,
              priceUnit: products.priceUnit,
              images: products.images,
            })
            .from(products)
            .where(
              and(
                eq(products.isActive, true),
                or(
                  eq(products.barcode, input.barcode),
                  eq(products.article, input.barcode)
                )
              )
            )
            .limit(1);
          return result[0] || null;
        } catch (error) {
          console.error("Failed to find product by barcode:", error);
          return null;
        }
      }),

    // Search customers
    searchCustomers: adminProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          const q = `%${input.query}%`;
          const result = await db
            .select()
            .from(customers)
            .where(or(like(customers.name, q), like(customers.phone, q)))
            .limit(10);
          return result;
        } catch (error) {
          console.error("Failed to search customers:", error);
          return [];
        }
      }),

    // Rate customer after sale
    rateCustomer: adminProcedure
      .input(z.object({
        orderId: z.number(),
        customerId: z.number().optional(),
        rating: z.number().min(1).max(5),
        tags: z.array(z.string()).optional(),
        comment: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");

        try {
          await db.insert(customerRatings).values({
            customerId: input.customerId || null,
            orderId: input.orderId,
            rating: input.rating,
            tags: input.tags || [],
            comment: input.comment || null,
          });
          return { success: true };
        } catch (error) {
          console.error("Failed to rate customer:", error);
          throw new Error("Не удалось сохранить оценку");
        }
      }),

    // Get customer ratings
    getCustomerRatings: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { ratings: [], avg: 0 };

        try {
          const ratings = await db
            .select()
            .from(customerRatings)
            .where(eq(customerRatings.customerId, input.customerId))
            .orderBy(desc(customerRatings.createdAt))
            .limit(50);

          const avg = ratings.length > 0
            ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
            : 0;

          return { ratings, avg: Math.round(avg * 10) / 10 };
        } catch (error) {
          console.error("Failed to get ratings:", error);
          return { ratings: [], avg: 0 };
        }
      }),
  }),

  // Warehouse (stock management)
  warehouse: router({
    overview: adminProcedure
      .input(z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        subcategory: z.string().optional(),
        stockFilter: z.enum(["all", "low", "zero", "ok"]).optional().default("all"),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions: any[] = [eq(products.isActive, true)];
        if (input.search) {
          const pattern = `%${input.search}%`;
          conditions.push(or(like(products.name, pattern), like(products.article, pattern))!);
        }
        if (input.category) {
          conditions.push(eq(products.category, input.category));
        }
        if (input.subcategory) {
          conditions.push(eq(products.subcategory, input.subcategory));
        }
        if (input.stockFilter === "low") {
          conditions.push(sql`COALESCE(minStockLevel, 0) > 0`);
          conditions.push(sql`COALESCE(stockQuantity, 0) <= COALESCE(minStockLevel, 0)`);
          conditions.push(sql`COALESCE(stockQuantity, 0) > 0`);
        } else if (input.stockFilter === "zero") {
          conditions.push(sql`COALESCE(stockQuantity, 0) = 0`);
        } else if (input.stockFilter === "ok") {
          conditions.push(sql`(COALESCE(stockQuantity, 0) > COALESCE(minStockLevel, 0) OR (COALESCE(minStockLevel, 0) = 0 AND COALESCE(stockQuantity, 0) > 0))`);
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        return db.select({
          id: products.id,
          article: products.article,
          name: products.name,
          category: products.category,
          subcategory: products.subcategory,
          stockQuantity: products.stockQuantity,
          minStockLevel: products.minStockLevel,
          isActive: products.isActive,
          priceMin: products.priceMin,
          images: products.images,
        }).from(products)
          .where(whereClause)
          .orderBy(products.category, products.subcategory, products.name);
      }),

    movements: adminProcedure
      .input(z.object({
        productId: z.number().optional(),
        type: z.enum(["arrival", "departure"]).optional(),
        reason: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { items: [], total: 0 };

        const conditions: any[] = [];
        if (input.productId) conditions.push(eq(stockMovements.productId, input.productId));
        if (input.type) conditions.push(eq(stockMovements.type, input.type));
        if (input.reason) conditions.push(eq(stockMovements.reason, input.reason as any));
        if (input.dateFrom) conditions.push(gte(stockMovements.date, new Date(input.dateFrom)));
        if (input.dateTo) conditions.push(lte(stockMovements.date, new Date(input.dateTo)));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [countResult, items] = await Promise.all([
          db.select({ count: sql<number>`COUNT(*)` }).from(stockMovements).where(whereClause),
          db.select({
            id: stockMovements.id,
            productId: stockMovements.productId,
            productName: products.name,
            productArticle: products.article,
            type: stockMovements.type,
            quantity: stockMovements.quantity,
            reason: stockMovements.reason,
            supplierName: stockMovements.supplierName,
            purchasePrice: stockMovements.purchasePrice,
            note: stockMovements.note,
            date: stockMovements.date,
            createdAt: stockMovements.createdAt,
          })
            .from(stockMovements)
            .leftJoin(products, eq(stockMovements.productId, products.id))
            .where(whereClause)
            .orderBy(desc(stockMovements.date))
            .limit(input.limit)
            .offset((input.page - 1) * input.limit),
        ]);

        return { items, total: countResult[0]?.count ?? 0 };
      }),

    addArrival: adminProcedure
      .input(z.object({
        productId: z.number(),
        quantity: z.number().positive(),
        supplierName: z.string().optional(),
        purchasePrice: z.number().optional(),
        note: z.string().optional(),
        date: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.insert(stockMovements).values({
          productId: input.productId,
          type: "arrival",
          quantity: input.quantity,
          reason: "purchase",
          supplierName: input.supplierName || null,
          purchasePrice: input.purchasePrice?.toString() || null,
          note: input.note || null,
          date: new Date(input.date),
        });
        await db.update(products).set({
          stockQuantity: sql`COALESCE(stockQuantity, 0) + ${input.quantity}`,
          stockStatus: "in_stock",
        }).where(eq(products.id, input.productId));
        return { success: true };
      }),

    addDeparture: adminProcedure
      .input(z.object({
        productId: z.number(),
        quantity: z.number().positive(),
        reason: z.enum(["sale", "defect", "return", "correction", "other"]),
        note: z.string().optional(),
        date: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const product = await db.select({ stockQuantity: products.stockQuantity }).from(products).where(eq(products.id, input.productId)).limit(1);
        const current = product[0]?.stockQuantity ?? 0;
        if (current < input.quantity) {
          throw new Error(`Недостаточно на складе: ${current} шт, запрошено ${input.quantity} шт`);
        }
        await db.insert(stockMovements).values({
          productId: input.productId,
          type: "departure",
          quantity: input.quantity,
          reason: input.reason,
          note: input.note || null,
          date: new Date(input.date),
        });
        const newQty = current - input.quantity;
        await db.update(products).set({
          stockQuantity: sql`GREATEST(COALESCE(stockQuantity, 0) - ${input.quantity}, 0)`,
          stockStatus: newQty <= 0 ? "to_order" : "in_stock",
        }).where(eq(products.id, input.productId));
        return { success: true };
      }),

    adjustStock: adminProcedure
      .input(z.object({
        productId: z.number(),
        newQuantity: z.number().min(0),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const product = await db.select({ stockQuantity: products.stockQuantity }).from(products).where(eq(products.id, input.productId)).limit(1);
        const current = product[0]?.stockQuantity ?? 0;
        const diff = input.newQuantity - current;
        if (diff !== 0) {
          await db.insert(stockMovements).values({
            productId: input.productId,
            type: diff > 0 ? "arrival" : "departure",
            quantity: Math.abs(diff),
            reason: "correction",
            note: input.note || `Коррекция: ${current} → ${input.newQuantity}`,
            date: new Date(),
          });
        }
        await db.update(products).set({
          stockQuantity: input.newQuantity,
          stockStatus: input.newQuantity > 0 ? "in_stock" : "to_order",
        }).where(eq(products.id, input.productId));
        return { success: true };
      }),

    setMinLevel: adminProcedure
      .input(z.object({ productId: z.number(), minStockLevel: z.number().min(0) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.update(products).set({ minStockLevel: input.minStockLevel }).where(eq(products.id, input.productId));
        return { success: true };
      }),

    searchProducts: adminProcedure
      .input(z.object({
        query: z.string(),
        inStockOnly: z.boolean().optional(),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        if (!input.query.trim()) return [];
        const pattern = `%${input.query}%`;
        const conditions: any[] = [
          eq(products.isActive, true),
          or(like(products.name, pattern), like(products.article, pattern))!,
        ];
        if (input.inStockOnly) {
          conditions.push(sql`COALESCE(stockQuantity, 0) > 0`);
        }
        return db.select({
          id: products.id,
          article: products.article,
          name: products.name,
          category: products.category,
          stockQuantity: products.stockQuantity,
        }).from(products)
          .where(and(...conditions))
          .limit(input.limit)
          .orderBy(products.name);
      }),

    updateProductQuick: adminProcedure
      .input(z.object({
        productId: z.number(),
        name: z.string().optional(),
        stockQuantity: z.number().min(0).optional(),
        minStockLevel: z.number().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const updateData: any = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.minStockLevel !== undefined) updateData.minStockLevel = input.minStockLevel;

        if (input.stockQuantity !== undefined) {
          const product = await db.select({ stockQuantity: products.stockQuantity }).from(products).where(eq(products.id, input.productId)).limit(1);
          const current = product[0]?.stockQuantity ?? 0;
          const diff = input.stockQuantity - current;
          if (diff !== 0) {
            await db.insert(stockMovements).values({
              productId: input.productId,
              type: diff > 0 ? "arrival" : "departure",
              quantity: Math.abs(diff),
              reason: "correction",
              note: `Коррекция со склада: ${current} → ${input.stockQuantity}`,
              date: new Date(),
            });
          }
          updateData.stockQuantity = input.stockQuantity;
          updateData.stockStatus = input.stockQuantity > 0 ? "in_stock" : "to_order";
        }

        if (Object.keys(updateData).length > 0) {
          await db.update(products).set(updateData).where(eq(products.id, input.productId));
        }
        return { success: true };
      }),

    importExcel: adminProcedure
      .input(z.object({
        rows: z.array(z.object({
          article: z.string(),
          name: z.string(),
          category: z.string().optional(),
          quantity: z.number().min(0),
          purchasePrice: z.number().optional(),
          supplierName: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        let created = 0;
        let updated = 0;
        const errors: string[] = [];

        for (const row of input.rows) {
          try {
            const existing = await db.select({ id: products.id, stockQuantity: products.stockQuantity })
              .from(products)
              .where(eq(products.article, row.article))
              .limit(1);

            if (existing.length > 0) {
              // Update existing product
              const productId = existing[0].id;
              if (row.quantity > 0) {
                await db.insert(stockMovements).values({
                  productId,
                  type: "arrival",
                  quantity: row.quantity,
                  reason: "purchase",
                  supplierName: row.supplierName || null,
                  purchasePrice: row.purchasePrice?.toString() || null,
                  note: "Импорт из Excel",
                  date: new Date(),
                });
                const newQty = (existing[0].stockQuantity ?? 0) + row.quantity;
                await db.update(products).set({
                  stockQuantity: sql`COALESCE(stockQuantity, 0) + ${row.quantity}`,
                  stockStatus: newQty > 0 ? "in_stock" : "to_order",
                }).where(eq(products.id, productId));
              }
              updated++;
            } else {
              // Create new product
              const result = await db.insert(products).values({
                article: row.article,
                name: row.name,
                category: row.category || "Без категории",
                stockQuantity: row.quantity,
                stockStatus: row.quantity > 0 ? "in_stock" : "to_order",
                isActive: true,
                priceMin: row.purchasePrice?.toString() || null,
                images: [],
                tags: [],
              });
              const productId = Number(result[0].insertId);
              if (row.quantity > 0) {
                await db.insert(stockMovements).values({
                  productId,
                  type: "arrival",
                  quantity: row.quantity,
                  reason: "purchase",
                  supplierName: row.supplierName || null,
                  purchasePrice: row.purchasePrice?.toString() || null,
                  note: "Импорт из Excel (новый товар)",
                  date: new Date(),
                });
              }
              created++;
            }
          } catch (e: any) {
            errors.push(`${row.article}: ${e.message}`);
          }
        }

        return { created, updated, errors };
      }),

    nextSku: adminProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { sku: "" };
        // SKU prefix map
        const prefixMap: Record<string, string> = {
          "Балясины": "БАЛ", "Вензеля и волюты": "ВНЗ", "Виноград": "ВНГ",
          "Вставки в балясины": "ВСТ", "Декор полосы": "ДКП", "Декоративные панели": "ДПН",
          "Декоративные элементы": "ДЭЛ", "Заглушки, крышки": "ЗГЛ", "Заклёпки": "ЗКЛ",
          "Кованый виноград": "КВН", "Кольца и квадраты": "КОЛ", "Корзинки": "КРЗ",
          "Листья": "ЛСТ", "Листья кованые": "ЛСК", "Литые элементы": "ЛИТ",
          "Навершия": "НВР", "Накладки": "НКЛ", "Наконечники, навершия": "НКН",
          "Основания": "ОСН", "Основания балясин": "ОСБ", "Переходы на трубы": "ПРТ",
          "Пики": "ПИК", "Пики кованые": "ПИК", "Пластиковые заглушки": "ПЗГ",
          "Полусферы": "ПСФ", "Поручень, окончание поручня": "ПРЧ", "Поручни": "ПРЧ",
          "Розетки": "РЗТ", "Ручки дверные": "РДВ", "Столбы и трубы": "СТТ",
          "Столбы начальные": "СТН", "Цветы": "ЦВТ", "Цветы кованые": "ЦВК",
          "Цифры": "ЦФР", "Шары кованые, сферы": "ШАР", "Штампованные элементы": "ШТМ",
          "Ящики почтовые": "ЯЩП",
        };
        const prefix = prefixMap[input.category] || input.category.substring(0, 3).toUpperCase();
        const pattern = `${prefix}-%`;
        const existing = await db.select({ sku: products.sku })
          .from(products)
          .where(like(products.sku, pattern))
          .orderBy(desc(products.sku))
          .limit(1);
        let nextNum = 1;
        if (existing.length > 0 && existing[0].sku) {
          const match = existing[0].sku.match(/-(\d+)$/);
          if (match) nextNum = parseInt(match[1]) + 1;
        }
        return { sku: `${prefix}-${String(nextNum).padStart(3, "0")}` };
      }),

    generateSkus: adminProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const prefixMap: Record<string, string> = {
        "Балясины": "БАЛ", "Вензеля и волюты": "ВНЗ", "Виноград": "ВНГ",
        "Вставки в балясины": "ВСТ", "Декор полосы": "ДКП", "Декоративные панели": "ДПН",
        "Декоративные элементы": "ДЭЛ", "Заглушки, крышки": "ЗГЛ", "Заклёпки": "ЗКЛ",
        "Кованый виноград": "КВН", "Кольца и квадраты": "КОЛ", "Корзинки": "КРЗ",
        "Листья": "ЛСТ", "Листья кованые": "ЛСК", "Литые элементы": "ЛИТ",
        "Навершия": "НВР", "Накладки": "НКЛ", "Наконечники, навершия": "НКН",
        "Основания": "ОСН", "Основания балясин": "ОСБ", "Переходы на трубы": "ПРТ",
        "Пики": "ПИК", "Пики кованые": "ПИК", "Пластиковые заглушки": "ПЗГ",
        "Полусферы": "ПСФ", "Поручень, окончание поручня": "ПРЧ", "Поручни": "ПРЧ",
        "Розетки": "РЗТ", "Ручки дверные": "РДВ", "Столбы и трубы": "СТТ",
        "Столбы начальные": "СТН", "Цветы": "ЦВТ", "Цветы кованые": "ЦВК",
        "Цифры": "ЦФР", "Шары кованые, сферы": "ШАР", "Штампованные элементы": "ШТМ",
        "Ящики почтовые": "ЯЩП",
      };
      const allProducts = await db.select({ id: products.id, category: products.category, sku: products.sku })
        .from(products).where(sql`sku IS NULL OR sku = ''`);
      const counters: Record<string, number> = {};
      // Pre-count existing SKUs per prefix
      for (const prefix of Object.values(prefixMap)) {
        const existing = await db.select({ sku: products.sku })
          .from(products).where(like(products.sku, `${prefix}-%`))
          .orderBy(desc(products.sku)).limit(1);
        if (existing.length > 0 && existing[0].sku) {
          const match = existing[0].sku.match(/-(\d+)$/);
          counters[prefix] = match ? parseInt(match[1]) : 0;
        } else {
          counters[prefix] = 0;
        }
      }
      let updated = 0;
      for (const p of allProducts) {
        const prefix = prefixMap[p.category || ""] || (p.category || "ТВР").substring(0, 3).toUpperCase();
        counters[prefix] = (counters[prefix] || 0) + 1;
        const sku = `${prefix}-${String(counters[prefix]).padStart(3, "0")}`;
        await db.update(products).set({ sku }).where(eq(products.id, p.id));
        updated++;
      }
      return { updated };
    }),

    // Remove product(s) from warehouse — optionally delete from site entirely
    removeProducts: adminProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1),
        deleteFromSite: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("База данных недоступна");

        try {
          if (input.deleteFromSite) {
            // Full delete: product + cascade movements
            await db.delete(products).where(inArray(products.id, input.ids));
            triggerQdrantSync();
          } else {
            // Warehouse-only: zero out stock, keep product on site
            await db.update(products).set({
              stockQuantity: 0,
              stockStatus: "to_order",
            }).where(inArray(products.id, input.ids));
            // Remove movement history for these products
            await db.delete(stockMovements).where(inArray(stockMovements.productId, input.ids));
          }
          return { success: true, count: input.ids.length };
        } catch (error) {
          console.error("Failed to remove products:", error);
          throw new Error("Не удалось удалить товары");
        }
      }),

    lowStockCount: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return 0;
      const result = await db.select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(and(
          eq(products.isActive, true),
          sql`COALESCE(minStockLevel, 0) > 0`,
          sql`COALESCE(stockQuantity, 0) <= COALESCE(minStockLevel, 0)`,
        ));
      return result[0]?.count ?? 0;
    }),
  }),

  // Delivery calculator
  delivery: router({
    calculate: publicProcedure
      .input(z.object({
        distanceKm: z.number().positive(),
        weightKg: z.number().positive().optional(),
        orderTotal: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();

        const getSetting = async (key: string, def: number): Promise<number> => {
          if (!db) return def;
          const r = await db.select().from(businessSettings).where(eq(businessSettings.key, key)).limit(1);
          return r[0] ? parseFloat(r[0].value) : def;
        };

        const baseCost = await getSetting("delivery.base_cost", 500);
        const perKmRate = await getSetting("delivery.per_km_rate", 30);
        const weightSurchargePerKg = await getSetting("delivery.weight_surcharge_per_kg", 5);
        const weightThreshold = await getSetting("delivery.weight_threshold", 50);
        const freeThreshold = await getSetting("delivery.free_threshold", 50000);
        const maxDistance = await getSetting("delivery.max_distance_km", 500);

        if (input.distanceKm > maxDistance) {
          return {
            available: false,
            message: `Доставка нашим транспортом доступна до ${maxDistance} км. Для дальних расстояний используйте транспортную компанию.`,
            cost: 0,
            breakdown: null,
          };
        }

        if (input.orderTotal && input.orderTotal >= freeThreshold) {
          return {
            available: true,
            message: "Бесплатная доставка!",
            cost: 0,
            breakdown: { baseCost: 0, distanceCost: 0, weightSurcharge: 0 },
          };
        }

        const distanceCost = input.distanceKm * perKmRate;
        let weightSurcharge = 0;
        if (input.weightKg && input.weightKg > weightThreshold) {
          weightSurcharge = (input.weightKg - weightThreshold) * weightSurchargePerKg;
        }

        const totalCost = Math.round(baseCost + distanceCost + weightSurcharge);

        return {
          available: true,
          message: null,
          cost: totalCost,
          breakdown: {
            baseCost,
            distanceCost: Math.round(distanceCost),
            weightSurcharge: Math.round(weightSurcharge),
          },
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
