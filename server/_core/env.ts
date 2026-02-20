export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Telegram Bot configuration
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  telegramAdminIds: (process.env.TELEGRAM_ADMIN_IDS || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Boolean),
  // OpenAI API (for Whisper + AI assistant)
  openaiApiKey: process.env.OPENAI_API_KEY ?? "sk-p6NQwKJLe1AHYL0ywAVwzXp10WZ6GW1m",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.proxyapi.ru/openai/v1",
  // Qdrant Vector DB
  qdrantUrl: process.env.QDRANT_URL ?? "http://localhost:6333",
  // Admin auth (login/password)
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "kovka2024",
  adminJwtSecret: process.env.ADMIN_JWT_SECRET ?? "kovka-admin-secret-2024",
};
