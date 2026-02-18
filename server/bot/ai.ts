import OpenAI from "openai";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import {
  orders,
  contactRequests,
  customers,
  products,
  productCategories,
  businessSettings,
  transactions,
  financeCategories,
} from "../../drizzle/schema";
import { sql, desc, eq, like, and } from "drizzle-orm";
import { searchKnowledge } from "./qdrant";
import type { BotContext } from "./index";

const openai = new OpenAI({
  apiKey: ENV.openaiApiKey,
  baseURL: ENV.openaiBaseUrl,
});

// Conversation history per user (in-memory, resets on restart)
const conversations = new Map<number, OpenAI.Chat.ChatCompletionMessageParam[]>();

const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `Ты — AI-ассистент компании "Ковка в Дворик", интернет-магазин элементов художественной ковки (балясины, волюты, листья, виноград, кованые ворота, ограждения, перила, заборы и т.д.).

Ты общаешься с администраторами через Telegram-бот. Твоя задача:
1. Отвечать на вопросы по товарам, ценам, наличию
2. Давать статистику по заказам, заявкам, клиентам, финансам
3. Помогать с бизнес-аналитикой
4. Отвечать на организационные вопросы (график, контакты)
5. Генерировать изображения по запросу (баннеры, иллюстрации, концепты товаров)

Правила:
- Отвечай кратко и по делу
- Используй данные из функций для точных ответов
- Если данных нет в базе, скажи об этом честно
- Формат: обычный текст, без markdown (Telegram plain text)
- Числа форматируй с разделителями (1 000 вместо 1000)
- Валюта: рубли (₽)
- Язык: русский`;

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Поиск товаров по названию, артикулу или категории. Показывает цены и наличие. Поддерживает поиск по отдельным словам. Артикулы в базе на латинице (BAL, VOL, VIN, LIST, PIK и т.д.). Если пользователь пишет кириллический артикул, ищи по названию товара.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Поисковый запрос (название товара или его часть, артикул на латинице, категория). Лучше искать по ключевому слову из названия, например 'балясина' или 'витая'" },
          limit: { type: "number", description: "Максимум результатов (по умолчанию 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders_stats",
      description: "Получить статистику заказов за период",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month", "year", "all"],
            description: "Период статистики",
          },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_orders",
      description: "Получить список последних заказов",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Количество заказов (по умолчанию 5)" },
          status: {
            type: "string",
            enum: ["new", "processing", "completed", "cancelled", "all"],
            description: "Фильтр по статусу",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_requests",
      description: "Получить заявки с сайта (контактные формы)",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["new", "processed", "all"], description: "Фильтр по статусу" },
          limit: { type: "number", description: "Количество (по умолчанию 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_finance_stats",
      description: "Получить финансовую статистику: доходы, расходы, баланс",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month", "year", "all"],
            description: "Период",
          },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customers_stats",
      description: "Получить статистику по клиентам",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_business_settings",
      description: "Получить настройки бизнеса (график работы, контакты, адрес и т.д.)",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Категория настроек (schedule, contacts, general)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_catalog_stats",
      description: "Получить общую статистику каталога: количество товаров, категорий, диапазон цен. Используй для вопросов 'сколько товаров', 'какие категории' и т.п.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_products",
      description: "Получить список всех товаров или товаров определённой категории. Используй когда нужно показать все товары, а не искать по запросу.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Фильтр по категории (необязательно)" },
          limit: { type: "number", description: "Максимум результатов (по умолчанию 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Сгенерировать изображение по текстовому описанию с помощью DALL-E. Используй когда пользователь просит создать, нарисовать, сгенерировать картинку, баннер, изображение.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Описание изображения на английском языке (DALL-E лучше понимает английский)" },
          size: {
            type: "string",
            enum: ["1024x1024", "1792x1024", "1024x1792"],
            description: "Размер: 1024x1024 (квадрат), 1792x1024 (горизонтальный), 1024x1792 (вертикальный). По умолчанию 1024x1024",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Семантический поиск по базе знаний компании: товары, FAQ, информация о компании, контент сайта. Используй для общих вопросов о компании, доставке, оплате и т.д.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Поисковый запрос на естественном языке" },
          limit: { type: "number", description: "Количество результатов (по умолчанию 5)" },
        },
        required: ["query"],
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  // Image generation doesn't need DB
  if (name === "generate_image") {
    try {
      const prompt = args.prompt as string;
      const size = (args.size as string) || "1024x1024";

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: size as "1024x1024" | "1792x1024" | "1024x1792",
        quality: "standard",
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        return JSON.stringify({ error: "Не удалось сгенерировать изображение" });
      }

      // Store image URL for later sending
      // We'll use a special marker in the response
      return JSON.stringify({
        success: true,
        imageUrl,
        revisedPrompt: response.data[0]?.revised_prompt || prompt,
      });
    } catch (error) {
      console.error("[Bot AI] Image generation error:", error);
      return JSON.stringify({ error: `Ошибка генерации: ${error instanceof Error ? error.message : "unknown"}` });
    }
  }

  const db = await getDb();
  if (!db) return JSON.stringify({ error: "База данных недоступна" });

  try {
    switch (name) {
      case "search_products": {
        const query = args.query as string;
        const limit = (args.limit as number) || 10;

        // Split query into words for fuzzy matching
        const words = query
          .replace(/[^\p{L}\p{N}\s-]/gu, "")
          .split(/\s+/)
          .filter((w) => w.length >= 2);

        let whereClause;
        if (words.length > 0) {
          // Search by each word separately (OR between words, each word checked against all fields)
          const wordConditions = words.map(
            (word) =>
              sql`(${products.name} LIKE ${`%${word}%`} OR ${products.article} LIKE ${`%${word}%`} OR ${products.category} LIKE ${`%${word}%`} OR ${products.description} LIKE ${`%${word}%`})`
          );
          // Combine with OR — find products matching ANY word
          whereClause = sql.join(wordConditions, sql` OR `);
        } else {
          whereClause = sql`(${products.name} LIKE ${`%${query}%`} OR ${products.article} LIKE ${`%${query}%`} OR ${products.category} LIKE ${`%${query}%`} OR ${products.description} LIKE ${`%${query}%`})`;
        }

        const result = await db
          .select({
            id: products.id,
            article: products.article,
            name: products.name,
            category: products.category,
            priceMin: products.priceMin,
            priceMax: products.priceMax,
            priceUnit: products.priceUnit,
            materials: products.materials,
            dimensions: products.dimensions,
            isActive: products.isActive,
          })
          .from(products)
          .where(whereClause)
          .limit(limit);

        return JSON.stringify({ products: result, total: result.length });
      }

      case "get_orders_stats": {
        const period = args.period as string;
        let dateFilter = "1=1";
        switch (period) {
          case "today": dateFilter = "DATE(createdAt) = CURDATE()"; break;
          case "week": dateFilter = "createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)"; break;
          case "month": dateFilter = "createdAt >= DATE_SUB(NOW(), INTERVAL 1 MONTH)"; break;
          case "year": dateFilter = "createdAt >= DATE_SUB(NOW(), INTERVAL 1 YEAR)"; break;
        }

        const [total] = await db
          .select({ count: sql<number>`COUNT(*)`, sum: sql<string>`COALESCE(SUM(totalAmount), 0)` })
          .from(orders)
          .where(sql.raw(dateFilter));

        const statusCounts = await db
          .select({
            status: orders.status,
            count: sql<number>`COUNT(*)`,
          })
          .from(orders)
          .where(sql.raw(dateFilter))
          .groupBy(orders.status);

        return JSON.stringify({
          period,
          totalOrders: total.count,
          totalRevenue: total.sum,
          byStatus: statusCounts,
        });
      }

      case "get_recent_orders": {
        const limit = (args.limit as number) || 5;
        const status = args.status as string;

        let query = db
          .select({
            id: orders.id,
            customerName: orders.customerName,
            customerPhone: orders.customerPhone,
            status: orders.status,
            totalAmount: orders.totalAmount,
            itemsCount: orders.itemsCount,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .orderBy(desc(orders.createdAt))
          .limit(limit);

        if (status && status !== "all") {
          query = query.where(eq(orders.status, status as "new" | "processing" | "completed" | "cancelled")) as typeof query;
        }

        const result = await query;
        return JSON.stringify({ orders: result });
      }

      case "get_contact_requests": {
        const status = args.status as string;
        const limit = (args.limit as number) || 10;

        let query = db
          .select()
          .from(contactRequests)
          .orderBy(desc(contactRequests.createdAt))
          .limit(limit);

        if (status && status !== "all") {
          query = query.where(eq(contactRequests.status, status as "new" | "processed")) as typeof query;
        }

        const result = await query;
        return JSON.stringify({ requests: result, total: result.length });
      }

      case "get_finance_stats": {
        const period = args.period as string;
        let dateFilter = "1=1";
        switch (period) {
          case "today": dateFilter = "DATE(date) = CURDATE()"; break;
          case "week": dateFilter = "date >= DATE_SUB(NOW(), INTERVAL 7 DAY)"; break;
          case "month": dateFilter = "date >= DATE_SUB(NOW(), INTERVAL 1 MONTH)"; break;
          case "year": dateFilter = "date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)"; break;
        }

        const [income] = await db
          .select({ sum: sql<string>`COALESCE(SUM(amount), 0)` })
          .from(transactions)
          .where(sql`type = 'income' AND ${sql.raw(dateFilter)}`);

        const [expense] = await db
          .select({ sum: sql<string>`COALESCE(SUM(amount), 0)` })
          .from(transactions)
          .where(sql`type = 'expense' AND ${sql.raw(dateFilter)}`);

        const [count] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(transactions)
          .where(sql.raw(dateFilter));

        return JSON.stringify({
          period,
          totalIncome: parseFloat(income.sum),
          totalExpense: parseFloat(expense.sum),
          balance: parseFloat(income.sum) - parseFloat(expense.sum),
          transactionsCount: count.count,
        });
      }

      case "get_customers_stats": {
        const [total] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(customers);

        const segments = await db
          .select({
            segment: customers.segment,
            count: sql<number>`COUNT(*)`,
          })
          .from(customers)
          .groupBy(customers.segment);

        const [newThisMonth] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(customers)
          .where(sql`createdAt >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`);

        return JSON.stringify({
          totalCustomers: total.count,
          newThisMonth: newThisMonth.count,
          bySegment: segments,
        });
      }

      case "get_business_settings": {
        const category = args.category as string;

        let query = db.select().from(businessSettings);
        if (category) {
          query = query.where(eq(businessSettings.category, category)) as typeof query;
        }

        const result = await query;
        const settings: Record<string, string> = {};
        for (const s of result) {
          settings[s.key] = s.value;
        }
        return JSON.stringify({ settings });
      }

      case "get_catalog_stats": {
        const [totalProducts] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(products);

        const [activeProducts] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(products)
          .where(eq(products.isActive, true));

        const categoriesResult = await db
          .select({
            category: products.category,
            count: sql<number>`COUNT(*)`,
          })
          .from(products)
          .where(eq(products.isActive, true))
          .groupBy(products.category);

        const [priceRange] = await db
          .select({
            minPrice: sql<string>`MIN(CAST(priceMin AS DECIMAL(10,2)))`,
            maxPrice: sql<string>`MAX(CAST(priceMax AS DECIMAL(10,2)))`,
          })
          .from(products)
          .where(eq(products.isActive, true));

        const [categoriesCount] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(productCategories)
          .where(eq(productCategories.isActive, true));

        return JSON.stringify({
          totalProducts: totalProducts.count,
          activeProducts: activeProducts.count,
          categoriesCount: categoriesCount.count,
          priceRange: {
            min: priceRange.minPrice,
            max: priceRange.maxPrice,
          },
          byCategory: categoriesResult.map((c) => ({
            category: c.category || "Без категории",
            count: c.count,
          })),
        });
      }

      case "list_products": {
        const category = args.category as string;
        const limit = (args.limit as number) || 50;

        let query = db
          .select({
            id: products.id,
            article: products.article,
            name: products.name,
            category: products.category,
            priceMin: products.priceMin,
            priceMax: products.priceMax,
            priceUnit: products.priceUnit,
            materials: products.materials,
            dimensions: products.dimensions,
            isActive: products.isActive,
          })
          .from(products)
          .where(eq(products.isActive, true))
          .limit(limit);

        if (category) {
          query = query.where(eq(products.category, category)) as typeof query;
        }

        const result = await query;
        return JSON.stringify({ products: result, total: result.length });
      }

      case "search_knowledge_base": {
        const query = args.query as string;
        const limit = (args.limit as number) || 5;

        const results = await searchKnowledge(query, limit);
        return JSON.stringify({
          results: results.map((r) => ({
            text: r.text,
            type: r.type,
            relevance: Math.round(r.score * 100) + "%",
          })),
          total: results.length,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown function: ${name}` });
    }
  } catch (error) {
    console.error(`[Bot AI] Tool ${name} error:`, error);
    return JSON.stringify({ error: `Ошибка выполнения: ${error instanceof Error ? error.message : "unknown"}` });
  }
}

export interface AIResponse {
  text: string;
  images: string[];
}

export async function getAIResponse(userId: number, userMessage: string): Promise<AIResponse> {
  if (!ENV.openaiApiKey) {
    return { text: "OpenAI API не настроен.", images: [] };
  }

  // Get or create conversation history
  let history = conversations.get(userId) || [];

  // Add user message
  history.push({ role: "user", content: userMessage });

  // Trim history
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
    conversations.set(userId, history);
  }

  const collectedImages: string[] = [];

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
    ];

    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
      max_tokens: 2048,
    });

    // Handle tool calls (up to 5 rounds)
    let rounds = 0;
    while (response.choices[0]?.message?.tool_calls && rounds < 5) {
      const assistantMessage = response.choices[0].message;
      history.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(toolCall.function.name, args);

        // Collect image URLs from generate_image tool results
        if (toolCall.function.name === "generate_image") {
          try {
            const parsed = JSON.parse(result);
            if (parsed.imageUrl) {
              collectedImages.push(parsed.imageUrl);
            }
          } catch {
            // ignore parse errors
          }
        }

        history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
        tools,
        max_tokens: 2048,
      });
      rounds++;
    }

    const reply = response.choices[0]?.message?.content || "Не удалось получить ответ.";

    // Save assistant reply to history
    history.push({ role: "assistant", content: reply });
    conversations.set(userId, history);

    return { text: reply, images: collectedImages };
  } catch (error) {
    console.error("[Bot AI] Error:", error);
    return { text: "Произошла ошибка при обработке запроса. Попробуйте позже.", images: [] };
  }
}

export async function handleTextMessage(ctx: BotContext) {
  const text = ctx.message?.text;
  const userId = ctx.from?.id;
  if (!text || !userId) return;

  await ctx.api.sendChatAction(ctx.chat!.id, "typing");

  const response = await getAIResponse(userId, text);

  // Send images first
  for (const imageUrl of response.images) {
    try {
      await ctx.replyWithPhoto(imageUrl);
    } catch (error) {
      console.error("[Bot] Failed to send image:", error);
    }
  }

  // Send text reply
  if (response.text) {
    if (response.text.length > 4000) {
      const chunks = response.text.match(/.{1,4000}/gs) || [response.text];
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }
    } else {
      await ctx.reply(response.text);
    }
  }
}
