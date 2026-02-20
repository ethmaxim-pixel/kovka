import { Bot, Context } from "grammy";
import { ENV } from "../_core/env";

let botInstance: Bot<Context> | null = null;

export function getBotInstance(): Bot<Context> | null {
  return botInstance;
}

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

  const bot = new Bot<Context>(ENV.telegramBotToken);
  botInstance = bot;

  // /start command
  bot.command("start", async (ctx) => {
    await ctx.reply(
      'Бот "Ковка в Дворик" активен.\n\n' +
      "Я отправляю уведомления о новых заказах и заявках с сайта."
    );
  });

  // Error handler
  bot.catch((err) => {
    console.error("[Bot] Error:", err.message);
  });

  // Start polling
  try {
    await bot.api.deleteWebhook();
    bot.start({
      onStart: () => {
        console.log("[Bot] Telegram bot started (long polling)");
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
