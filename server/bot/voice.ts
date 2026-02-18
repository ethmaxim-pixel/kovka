import OpenAI from "openai";
import { ENV } from "../_core/env";
import { getAIResponse } from "./ai";
import type { BotContext } from "./index";
import fs from "fs";
import path from "path";
import os from "os";

const openai = new OpenAI({
  apiKey: ENV.openaiApiKey,
  baseURL: ENV.openaiBaseUrl,
});

export async function handleVoiceMessage(ctx: BotContext) {
  const voice = ctx.message?.voice;
  const userId = ctx.from?.id;
  if (!voice || !userId) return;

  if (!ENV.openaiApiKey) {
    await ctx.reply("OpenAI API не настроен. Голосовые сообщения недоступны.");
    return;
  }

  // Show typing indicator
  await ctx.api.sendChatAction(ctx.chat!.id, "typing");

  let tempPath: string | null = null;

  try {
    // Download voice file from Telegram
    const file = await ctx.getFile();
    const filePath = file.file_path;

    if (!filePath) {
      await ctx.reply("Не удалось получить голосовое сообщение.");
      return;
    }

    // Download file to temp directory
    const downloadUrl = `https://api.telegram.org/file/bot${ENV.telegramBotToken}/${filePath}`;
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      await ctx.reply("Ошибка загрузки голосового сообщения.");
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Save to temp file
    tempPath = path.join(os.tmpdir(), `voice_${userId}_${Date.now()}.ogg`);
    fs.writeFileSync(tempPath, buffer);

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
      language: "ru",
      prompt: "Транскрибация голосового сообщения администратора интернет-магазина кованых изделий",
    });

    const text = transcription.text;

    if (!text || text.trim().length === 0) {
      await ctx.reply("Не удалось распознать голосовое сообщение. Попробуйте ещё раз.");
      return;
    }

    // Show transcription
    await ctx.reply(`🎙 Распознано: "${text}"`);

    // Send typing again for AI response
    await ctx.api.sendChatAction(ctx.chat!.id, "typing");

    // Get AI response based on transcribed text
    const aiResponse = await getAIResponse(userId, text);

    // Send images first
    for (const imageUrl of aiResponse.images) {
      try {
        await ctx.replyWithPhoto(imageUrl);
      } catch (imgErr) {
        console.error("[Bot Voice] Failed to send image:", imgErr);
      }
    }

    // Split long messages
    if (aiResponse.text.length > 4000) {
      const chunks = aiResponse.text.match(/.{1,4000}/gs) || [aiResponse.text];
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }
    } else {
      await ctx.reply(aiResponse.text);
    }
  } catch (error) {
    console.error("[Bot Voice] Error:", error);
    await ctx.reply("Ошибка при обработке голосового сообщения. Попробуйте позже.");
  } finally {
    // Clean up temp file
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
  }
}
