import OpenAI, { toFile } from "openai";
import { InputFile } from "grammy";
import { ENV } from "../_core/env";
import type { BotContext } from "./index";
import fs from "fs";
import path from "path";
import os from "os";

const openai = new OpenAI({
  apiKey: ENV.openaiApiKey,
  baseURL: ENV.openaiBaseUrl,
});

// Session state per user
interface MockupSession {
  step: "awaiting_background" | "awaiting_element";
  backgroundPhotoUrl: string;
}

const sessions = new Map<number, MockupSession>();

export function hasMockupSession(userId: number): boolean {
  return sessions.has(userId);
}

export function cancelMockupSession(userId: number): void {
  sessions.delete(userId);
}

/**
 * Start the mockup flow — called from /maket command
 */
export async function startMockupFlow(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) return;

  sessions.set(userId, { step: "awaiting_background", backgroundPhotoUrl: "" });

  await ctx.reply(
    "🎨 <b>Создание макета</b>\n\n" +
      "Шаг 1 из 2:\n" +
      "📷 Пришлите фото интерьера/экстерьера, на которое нужно добавить кованый элемент.\n\n" +
      "<i>Для отмены отправьте /cancel</i>",
    { parse_mode: "HTML" }
  );
}

/**
 * Handle photo messages during mockup flow
 */
export async function handleMockupPhoto(ctx: BotContext): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;

  const session = sessions.get(userId);
  if (!session) return false;

  const photo = ctx.message?.photo;
  if (!photo || photo.length === 0) {
    // User sent something that isn't a photo
    const text = ctx.message?.text;
    if (text === "/cancel") {
      sessions.delete(userId);
      await ctx.reply("❌ Создание макета отменено.");
      return true;
    }

    if (session.step === "awaiting_element" && text) {
      // Text without photo at element step — remind them to send a photo
      await ctx.reply(
        "📷 Пожалуйста, пришлите фото кованого элемента вместе с описанием.\n" +
          "Вы можете добавить описание в подпись к фото.\n\n" +
          "<i>Для отмены отправьте /cancel</i>",
        { parse_mode: "HTML" }
      );
      return true;
    }

    return false;
  }

  // Get the highest resolution photo
  const bestPhoto = photo[photo.length - 1];
  const file = await ctx.api.getFile(bestPhoto.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${ENV.telegramBotToken}/${file.file_path}`;

  if (session.step === "awaiting_background") {
    // Step 1: received background photo
    session.backgroundPhotoUrl = fileUrl;
    session.step = "awaiting_element";

    await ctx.reply(
      "✅ Фото фона получено!\n\n" +
        "Шаг 2 из 2:\n" +
        "📷 Теперь пришлите фото кованого элемента, который нужно добавить.\n" +
        "💬 Добавьте описание в подпись к фото (куда и как разместить элемент).\n\n" +
        "<i>Для отмены отправьте /cancel</i>",
      { parse_mode: "HTML" }
    );
    return true;
  }

  if (session.step === "awaiting_element") {
    // Step 2: received element photo
    const elementPhotoUrl = fileUrl;
    const description = ctx.message?.caption || "Добавь этот кованый элемент на фото";
    const backgroundUrl = session.backgroundPhotoUrl;

    // Clear session
    sessions.delete(userId);

    await ctx.reply("⏳ Генерирую макет... Это может занять до минуты.");
    await ctx.api.sendChatAction(ctx.chat!.id, "upload_photo");

    try {
      const result = await generateMockup(backgroundUrl, elementPhotoUrl, description);

      if (result) {
        // Check if result is a local file path or URL
        const isLocalFile = !result.startsWith("http");
        const photoSource = isLocalFile ? new InputFile(result) : result;

        await ctx.replyWithPhoto(photoSource, {
          caption:
            "🎨 Готовый макет от дизайнера\n\n" +
            "Чтобы создать новый макет, используйте /maket",
        });

        // Cleanup result file if local
        if (isLocalFile && fs.existsSync(result)) {
          try { fs.unlinkSync(result); } catch {}
        }
      } else {
        await ctx.reply(
          "❌ Не удалось сгенерировать макет. Попробуйте другие фотографии.\n" +
            "Используйте /maket чтобы начать заново."
        );
      }
    } catch (error) {
      console.error("[Mockup] Generation error:", error);
      await ctx.reply(
        "❌ Ошибка при генерации макета. Попробуйте позже.\n" +
          "Используйте /maket чтобы начать заново."
      );
    }
    return true;
  }

  return false;
}

/**
 * Download image from URL and return as Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Step 1: GPT-4o-mini analyzes the element photo and creates a detailed description
 * Step 2: gpt-image-1 edits the background photo, adding the described element
 */
async function generateMockup(
  backgroundUrl: string,
  elementUrl: string,
  description: string
): Promise<string | null> {
  let bgPath: string | null = null;

  try {
    // Download element as base64 for GPT-4o-mini vision analysis
    const elBuffer = await downloadImage(elementUrl);
    const elBase64 = elBuffer.toString("base64");

    // Step 1: Analyze element photo with GPT-4o-mini Vision
    console.log("[Mockup] Step 1: Analyzing element with GPT-4o-mini...");
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional interior/exterior designer specializing in wrought iron and forged metalwork.
Analyze the provided image of a forged metal element and create an EXTREMELY detailed visual description.
Describe: exact shape, style (baroque, art nouveau, gothic, modern, etc.), decorative patterns, scrollwork, leaves, flowers, dimensions relative to typical objects, color/finish (black, patina, rust, gold, etc.), material texture.
Answer ONLY with the description in English, 3-5 sentences. Be very specific about visual details.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this forged metal element in detail:" },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${elBase64}`, detail: "high" },
            },
          ],
        },
      ],
      max_tokens: 400,
    });

    const elementDescription = analysisResponse.choices[0]?.message?.content;
    if (!elementDescription) return null;
    console.log("[Mockup] Element description:", elementDescription);

    // Step 2: Download background and edit with gpt-image-1
    const bgBuffer = await downloadImage(backgroundUrl);

    const editPrompt = `You are a professional interior and exterior designer. Edit this photo to add a wrought iron forged element.

ELEMENT TO ADD: ${elementDescription}

CLIENT INSTRUCTIONS: "${description}"

CRITICAL REQUIREMENTS:
- PRESERVE the original photo exactly — same room/exterior, same lighting, same colors, same perspective
- ADD the described forged metal element into the scene naturally
- Place it where the client specified, or where it fits best architecturally
- Match the lighting and shadows to the existing scene
- Make it look like a real professional installation photo
- Correct scale and proportions relative to the environment
- The result must look like a real photograph, not a digital collage`;

    console.log("[Mockup] Step 2: Editing background with gpt-image-1...");

    // Use toFile() to set correct MIME type
    const imageFile = await toFile(bgBuffer, "background.png", { type: "image/png" });

    const imageResponse = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: editPrompt,
      n: 1,
      size: "1024x1024",
    });

    const resultData = imageResponse.data[0];
    if (!resultData) return null;

    // gpt-image-1 returns b64_json by default
    if (resultData.b64_json) {
      const resultPath = path.join(os.tmpdir(), `mockup_result_${Date.now()}.png`);
      fs.writeFileSync(resultPath, Buffer.from(resultData.b64_json, "base64"));
      console.log("[Mockup] Image generated successfully");
      return resultPath;
    }

    if (resultData.url) {
      return resultData.url;
    }

    return null;
  } finally {
    // no temp files to clean up
  }
}
