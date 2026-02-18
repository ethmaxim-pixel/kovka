import { Bot, Context, Keyboard } from "grammy";
import { FileFlavor, hydrateFiles } from "@grammyjs/files";
import { ENV } from "../_core/env";
import { handleVoiceMessage } from "./voice";
import { handleTextMessage, getAIResponse } from "./ai";
import { startMockupFlow, handleMockupPhoto, hasMockupSession, cancelMockupSession } from "./mockup";
import { syncKnowledgeBase, getCollectionInfo } from "./qdrant";
import { getDb } from "../db";
import { orders, contactRequests, customers } from "../../drizzle/schema";
import { sql, desc, eq } from "drizzle-orm";

export type BotContext = FileFlavor<Context>;

let botInstance: Bot<BotContext> | null = null;

export function getBotInstance(): Bot<BotContext> | null {
  return botInstance;
}

function isAdmin(userId: number): boolean {
  return ENV.telegramAdminIds.includes(userId);
}

// Main menu keyboard
const mainMenu = new Keyboard()
  .text("📊 Статистика").text("📦 Последние заказы").row()
  .text("📩 Новые заявки").text("🎨 Создать макет").row()
  .resized()
  .persistent();

export async function startBot() {
  if (!ENV.telegramBotToken) {
    console.warn("[Bot] Telegram bot token not configured, skipping bot start");
    return;
  }

  // Stop previous bot instance if exists (hot-reload safe)
  if (botInstance) {
    try {
      await botInstance.stop();
    } catch {
      // ignore
    }
    botInstance = null;
  }

  const bot = new Bot<BotContext>(ENV.telegramBotToken);
  botInstance = bot;

  // Enable file downloads
  bot.api.config.use(hydrateFiles(bot.token));

  // Admin-only middleware
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !isAdmin(userId)) {
      if (ctx.message) {
        await ctx.reply("Доступ запрещён. Бот доступен только администраторам.");
      }
      return;
    }
    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Привет! Я бот-ассистент \"Ковка в Дворик\".\n\n" +
      "Что я умею:\n" +
      "- Отвечать на вопросы о товарах, ценах, графике работы\n" +
      "- Показывать статистику заказов и заявок\n" +
      "- Принимать голосовые сообщения\n" +
      "- Создавать макеты размещения кованых элементов\n\n" +
      "Используйте кнопки меню или просто напишите / скажите голосом свой вопрос!",
      { reply_markup: mainMenu }
    );
  });

  // /sync command - sync knowledge base to Qdrant
  bot.command("sync", async (ctx) => {
    await ctx.reply("⏳ Синхронизация базы знаний...");
    try {
      const result = await syncKnowledgeBase();
      const info = await getCollectionInfo();
      let text = `✅ Синхронизация завершена!\nЗагружено: ${result.synced} записей`;
      if (info) {
        text += `\nВсего в базе: ${info.pointsCount} записей`;
      }
      if (result.errors.length > 0) {
        text += `\n\n⚠️ Ошибки:\n${result.errors.join("\n")}`;
      }
      await ctx.reply(text);
    } catch (error) {
      console.error("[Bot] Sync error:", error);
      await ctx.reply("❌ Ошибка синхронизации: " + (error instanceof Error ? error.message : "unknown"));
    }
  });

  // /stats command
  bot.command("stats", async (ctx) => {
    try {
      const db = await getDb();
      if (!db) {
        await ctx.reply("База данных недоступна.");
        return;
      }

      const [ordersCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orders);

      const [newOrdersCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(eq(orders.status, "new"));

      const [contactsCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(contactRequests);

      const [newContactsCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(contactRequests)
        .where(eq(contactRequests.status, "new"));

      const [customersCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(customers);

      const [monthOrders] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(sql`createdAt >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`);

      await ctx.reply(
        `<b>Статистика</b>\n\n` +
        `Заказы: ${ordersCount.count} (новых: ${newOrdersCount.count})\n` +
        `За месяц: ${monthOrders.count}\n` +
        `Заявки: ${contactsCount.count} (новых: ${newContactsCount.count})\n` +
        `Клиенты: ${customersCount.count}`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("[Bot] Stats error:", error);
      await ctx.reply("Ошибка при получении статистики.");
    }
  });

  // /orders command
  bot.command("orders", async (ctx) => {
    try {
      const db = await getDb();
      if (!db) {
        await ctx.reply("База данных недоступна.");
        return;
      }

      const recentOrders = await db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(5);

      if (recentOrders.length === 0) {
        await ctx.reply("Заказов пока нет.");
        return;
      }

      const statusEmoji: Record<string, string> = {
        new: "🆕",
        processing: "⚙️",
        completed: "✅",
        cancelled: "❌",
      };

      let text = "<b>Последние заказы:</b>\n\n";
      for (const order of recentOrders) {
        const emoji = statusEmoji[order.status] || "📋";
        const date = new Date(order.createdAt).toLocaleDateString("ru-RU");
        text += `${emoji} #${order.id} | ${order.customerName}\n`;
        text += `   ${order.customerPhone} | ${order.totalAmount}₽\n`;
        text += `   ${date}\n\n`;
      }

      await ctx.reply(text, { parse_mode: "HTML" });
    } catch (error) {
      console.error("[Bot] Orders error:", error);
      await ctx.reply("Ошибка при получении заказов.");
    }
  });

  // /requests command
  bot.command("requests", async (ctx) => {
    try {
      const db = await getDb();
      if (!db) {
        await ctx.reply("База данных недоступна.");
        return;
      }

      const newRequests = await db
        .select()
        .from(contactRequests)
        .where(eq(contactRequests.status, "new"))
        .orderBy(desc(contactRequests.createdAt))
        .limit(10);

      if (newRequests.length === 0) {
        await ctx.reply("Новых заявок нет.");
        return;
      }

      let text = "<b>Новые заявки:</b>\n\n";
      for (const req of newRequests) {
        const date = new Date(req.createdAt).toLocaleDateString("ru-RU");
        text += `📩 ${req.name} | ${req.phone}\n`;
        if (req.message) text += `   "${req.message}"\n`;
        text += `   ${date}\n\n`;
      }

      await ctx.reply(text, { parse_mode: "HTML" });
    } catch (error) {
      console.error("[Bot] Requests error:", error);
      await ctx.reply("Ошибка при получении заявок.");
    }
  });

  // /maket command - start mockup flow
  bot.command("maket", async (ctx) => {
    await startMockupFlow(ctx);
  });

  // /cancel command - cancel mockup flow
  bot.command("cancel", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && hasMockupSession(userId)) {
      cancelMockupSession(userId);
      await ctx.reply("❌ Создание макета отменено.");
    } else {
      await ctx.reply("Нет активного процесса для отмены.");
    }
  });

  // Photo messages (mockup flow or pass through)
  bot.on("message:photo", async (ctx) => {
    const handled = await handleMockupPhoto(ctx);
    if (!handled) {
      await ctx.reply("📷 Фото получено. Чтобы создать макет, используйте /maket");
    }
  });

  // Voice messages
  bot.on("message:voice", async (ctx) => {
    await handleVoiceMessage(ctx);
  });

  // Menu button handlers
  bot.hears("📊 Статистика", async (ctx) => {
    await ctx.api.sendChatAction(ctx.chat.id, "typing");
    // Reuse /stats logic
    try {
      const db = await getDb();
      if (!db) { await ctx.reply("База данных недоступна."); return; }
      const [ordersCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(orders);
      const [newOrdersCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(eq(orders.status, "new"));
      const [contactsCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(contactRequests);
      const [newContactsCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(contactRequests).where(eq(contactRequests.status, "new"));
      const [customersCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(customers);
      const [monthOrders] = await db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(sql`createdAt >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`);
      await ctx.reply(
        `<b>📊 Статистика</b>\n\n` +
        `Заказы: ${ordersCount.count} (новых: ${newOrdersCount.count})\n` +
        `За месяц: ${monthOrders.count}\n` +
        `Заявки: ${contactsCount.count} (новых: ${newContactsCount.count})\n` +
        `Клиенты: ${customersCount.count}`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("[Bot] Stats error:", error);
      await ctx.reply("Ошибка при получении статистики.");
    }
  });

  bot.hears("📦 Последние заказы", async (ctx) => {
    await ctx.api.sendChatAction(ctx.chat.id, "typing");
    try {
      const db = await getDb();
      if (!db) { await ctx.reply("База данных недоступна."); return; }
      const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5);
      if (recentOrders.length === 0) { await ctx.reply("Заказов пока нет."); return; }
      const statusEmoji: Record<string, string> = { new: "🆕", processing: "⚙️", completed: "✅", cancelled: "❌" };
      let text = "<b>📦 Последние заказы:</b>\n\n";
      for (const order of recentOrders) {
        const emoji = statusEmoji[order.status] || "📋";
        const date = new Date(order.createdAt).toLocaleDateString("ru-RU");
        text += `${emoji} #${order.id} | ${order.customerName}\n`;
        text += `   ${order.customerPhone} | ${order.totalAmount}₽\n`;
        text += `   ${date}\n\n`;
      }
      await ctx.reply(text, { parse_mode: "HTML" });
    } catch (error) {
      console.error("[Bot] Orders error:", error);
      await ctx.reply("Ошибка при получении заказов.");
    }
  });

  bot.hears("📩 Новые заявки", async (ctx) => {
    await ctx.api.sendChatAction(ctx.chat.id, "typing");
    try {
      const db = await getDb();
      if (!db) { await ctx.reply("База данных недоступна."); return; }
      const newRequests = await db.select().from(contactRequests).where(eq(contactRequests.status, "new")).orderBy(desc(contactRequests.createdAt)).limit(10);
      if (newRequests.length === 0) { await ctx.reply("Новых заявок нет."); return; }
      let text = "<b>📩 Новые заявки:</b>\n\n";
      for (const req of newRequests) {
        const date = new Date(req.createdAt).toLocaleDateString("ru-RU");
        text += `📩 ${req.name} | ${req.phone}\n`;
        if (req.message) text += `   "${req.message}"\n`;
        text += `   ${date}\n\n`;
      }
      await ctx.reply(text, { parse_mode: "HTML" });
    } catch (error) {
      console.error("[Bot] Requests error:", error);
      await ctx.reply("Ошибка при получении заявок.");
    }
  });

  bot.hears("🎨 Создать макет", async (ctx) => {
    await startMockupFlow(ctx);
  });

  // Text messages (AI assistant)
  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    // Check if user is in mockup session and sent text
    const userId = ctx.from?.id;
    if (userId && hasMockupSession(userId)) {
      const handled = await handleMockupPhoto(ctx);
      if (handled) return;
    }
    await handleTextMessage(ctx);
  });

  // Error handler
  bot.catch((err) => {
    console.error("[Bot] Error:", err.message);
  });

  // Start polling
  try {
    await bot.api.deleteWebhook();
    bot.start({
      onStart: async () => {
        console.log("[Bot] Telegram bot started (long polling)");
        // Auto-sync knowledge base on startup (non-blocking)
        syncKnowledgeBase()
          .then((r) => console.log(`[Bot] Knowledge base synced: ${r.synced} points`))
          .catch((e) => console.error("[Bot] Auto-sync failed:", e));
      },
    });
  } catch (error) {
    console.error("[Bot] Failed to start:", error);
  }
}

// Send notification to all admins
export async function notifyAdmins(message: string): Promise<void> {
  const bot = getBotInstance();
  if (!bot) return;

  for (const adminId of ENV.telegramAdminIds) {
    try {
      await bot.api.sendMessage(adminId, message, { parse_mode: "HTML" });
    } catch (error) {
      console.error(`[Bot] Failed to notify admin ${adminId}:`, error);
    }
  }
}
