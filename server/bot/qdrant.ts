import OpenAI from "openai";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { products, businessSettings, siteContent } from "../../drizzle/schema";

const COLLECTION_NAME = "kovka_knowledge";
const EMBEDDING_MODEL = "text-embedding-3-small";
const VECTOR_SIZE = 1536;

const openai = new OpenAI({
  apiKey: ENV.openaiApiKey,
  baseURL: ENV.openaiBaseUrl,
});

// ========== Qdrant HTTP Client ==========

async function qdrantRequest(path: string, method: string = "GET", body?: unknown) {
  const url = `${ENV.qdrantUrl}${path}`;
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qdrant ${method} ${path}: ${response.status} - ${text}`);
  }
  return response.json();
}

// ========== Collection Management ==========

async function ensureCollection(): Promise<void> {
  try {
    await qdrantRequest(`/collections/${COLLECTION_NAME}`);
  } catch {
    // Collection doesn't exist, create it
    await qdrantRequest(`/collections/${COLLECTION_NAME}`, "PUT", {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
      optimizers_config: {
        default_segment_number: 2,
      },
    });
    console.log(`[Qdrant] Collection "${COLLECTION_NAME}" created`);
  }
}

// ========== Embeddings ==========

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Batch in chunks of 100
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    results.push(...response.data.map((d) => d.embedding));
  }
  return results;
}

// ========== Upsert Points ==========

interface KnowledgePoint {
  id: string;
  text: string;
  type: "product" | "setting" | "content" | "faq";
  metadata: Record<string, unknown>;
}

function hashId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

async function upsertPoints(points: KnowledgePoint[]): Promise<number> {
  if (points.length === 0) return 0;

  const texts = points.map((p) => p.text);
  const embeddings = await getEmbeddings(texts);

  const qdrantPoints = points.map((point, i) => ({
    id: hashId(point.id),
    vector: embeddings[i],
    payload: {
      text: point.text,
      type: point.type,
      source_id: point.id,
      ...point.metadata,
    },
  }));

  // Upsert in batches of 100
  for (let i = 0; i < qdrantPoints.length; i += 100) {
    const batch = qdrantPoints.slice(i, i + 100);
    await qdrantRequest(`/collections/${COLLECTION_NAME}/points`, "PUT", {
      points: batch,
    });
  }

  return points.length;
}

// ========== Search ==========

export async function searchKnowledge(query: string, limit: number = 5): Promise<Array<{
  text: string;
  type: string;
  score: number;
  metadata: Record<string, unknown>;
}>> {
  try {
    const queryVector = await getEmbedding(query);

    const result = await qdrantRequest(
      `/collections/${COLLECTION_NAME}/points/search`,
      "POST",
      {
        vector: queryVector,
        limit,
        with_payload: true,
        score_threshold: 0.3,
      }
    );

    return (result.result || []).map((hit: any) => ({
      text: hit.payload?.text || "",
      type: hit.payload?.type || "unknown",
      score: hit.score,
      metadata: hit.payload || {},
    }));
  } catch (error) {
    console.error("[Qdrant] Search error:", error);
    return [];
  }
}

// ========== Sync Data from MySQL to Qdrant ==========

export async function syncKnowledgeBase(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let totalSynced = 0;

  try {
    await ensureCollection();
  } catch (error) {
    return { synced: 0, errors: [`Failed to ensure collection: ${error}`] };
  }

  const db = await getDb();
  if (!db) {
    return { synced: 0, errors: ["Database not available"] };
  }

  // 1. Sync products
  try {
    const allProducts = await db.select().from(products);
    const productPoints: KnowledgePoint[] = allProducts.map((p) => {
      const priceInfo = p.priceMin && p.priceMax
        ? `Цена: от ${p.priceMin} до ${p.priceMax} ₽/${p.priceUnit || "шт"}`
        : p.priceMin
          ? `Цена: от ${p.priceMin} ₽/${p.priceUnit || "шт"}`
          : "Цена по запросу";

      const text = [
        `Товар: ${p.name}`,
        `Артикул: ${p.article}`,
        p.category ? `Категория: ${p.category}` : null,
        p.subcategory ? `Подкатегория: ${p.subcategory}` : null,
        p.description ? `Описание: ${p.description}` : null,
        priceInfo,
        p.materials ? `Материалы: ${p.materials}` : null,
        p.dimensions ? `Размеры: ${p.dimensions}` : null,
        p.weight ? `Вес: ${p.weight}` : null,
        p.productionTime ? `Срок изготовления: ${p.productionTime}` : null,
        p.isActive ? "В наличии" : "Не в наличии",
      ].filter(Boolean).join(". ");

      return {
        id: `product_${p.id}`,
        text,
        type: "product" as const,
        metadata: {
          productId: p.id,
          article: p.article,
          name: p.name,
          category: p.category,
          priceMin: p.priceMin,
          priceMax: p.priceMax,
        },
      };
    });

    if (productPoints.length > 0) {
      const count = await upsertPoints(productPoints);
      totalSynced += count;
      console.log(`[Qdrant] Synced ${count} products`);
    }
  } catch (error) {
    errors.push(`Products sync error: ${error}`);
  }

  // 2. Sync business settings
  try {
    const allSettings = await db.select().from(businessSettings);
    const settingPoints: KnowledgePoint[] = allSettings.map((s) => ({
      id: `setting_${s.key}`,
      text: `Настройка бизнеса "${s.key}": ${s.value}${s.description ? `. ${s.description}` : ""}`,
      type: "setting" as const,
      metadata: {
        key: s.key,
        category: s.category,
      },
    }));

    if (settingPoints.length > 0) {
      const count = await upsertPoints(settingPoints);
      totalSynced += count;
      console.log(`[Qdrant] Synced ${count} settings`);
    }
  } catch (error) {
    errors.push(`Settings sync error: ${error}`);
  }

  // 3. Sync site content
  try {
    const allContent = await db.select().from(siteContent);
    const contentPoints: KnowledgePoint[] = allContent.map((c) => ({
      id: `content_${c.key}`,
      text: `Контент сайта "${c.key}" (страница: ${c.page}): ${c.value}`,
      type: "content" as const,
      metadata: {
        key: c.key,
        page: c.page,
        section: c.section,
      },
    }));

    if (contentPoints.length > 0) {
      const count = await upsertPoints(contentPoints);
      totalSynced += count;
      console.log(`[Qdrant] Synced ${count} content items`);
    }
  } catch (error) {
    errors.push(`Content sync error: ${error}`);
  }

  // 4. Add FAQ / static knowledge
  try {
    const faqPoints: KnowledgePoint[] = [
      {
        id: "faq_about",
        text: 'Компания "Ковка в Дворик" — интернет-магазин элементов художественной ковки. Более 8000 наименований кованых элементов и готовых изделий. Балясины, волюты, листья, виноград и другие элементы художественной ковки оптом и в розницу. Город: Луганск.',
        type: "faq",
        metadata: { topic: "about" },
      },
      {
        id: "faq_delivery",
        text: "Доставка осуществляется по всей территории. Возможен самовывоз со склада. Стоимость доставки зависит от объёма заказа и расстояния.",
        type: "faq",
        metadata: { topic: "delivery" },
      },
      {
        id: "faq_payment",
        text: "Способы оплаты: наличные, банковский перевод, безналичный расчёт. Для оптовых клиентов возможна отсрочка платежа.",
        type: "faq",
        metadata: { topic: "payment" },
      },
      {
        id: "faq_categories",
        text: "Категории товаров: балясины, волюты, листья и цветы, виноград, кованые ворота, ограждения, перила, заборы, калитки, козырьки, мангалы, подсвечники, декоративные элементы, кольца, квадрат, полоса, пруток.",
        type: "faq",
        metadata: { topic: "categories" },
      },
      {
        id: "faq_custom",
        text: "Изготовление на заказ: принимаем индивидуальные заказы по эскизам клиента. Возможно изготовление нестандартных размеров и форм.",
        type: "faq",
        metadata: { topic: "custom_orders" },
      },
    ];

    const count = await upsertPoints(faqPoints);
    totalSynced += count;
    console.log(`[Qdrant] Synced ${count} FAQ items`);
  } catch (error) {
    errors.push(`FAQ sync error: ${error}`);
  }

  console.log(`[Qdrant] Total synced: ${totalSynced} points, errors: ${errors.length}`);
  return { synced: totalSynced, errors };
}

// ========== Get collection info ==========

export async function getCollectionInfo(): Promise<{ pointsCount: number; status: string } | null> {
  try {
    const result = await qdrantRequest(`/collections/${COLLECTION_NAME}`);
    return {
      pointsCount: result.result?.points_count || 0,
      status: result.result?.status || "unknown",
    };
  } catch {
    return null;
  }
}
