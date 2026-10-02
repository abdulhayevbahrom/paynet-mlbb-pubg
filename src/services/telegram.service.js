import TelegramBot from "node-telegram-bot-api";
import { env } from "../config/env.js";

export const bot = new TelegramBot(env.telegram.botToken, {
  polling: false,
});

export async function notifyOrder({ game, groupId, lines }) {
  if (!groupId) return;

  try {
    return await bot.sendMessage(groupId, lines.join("\n"), {
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error(`${game} Telegram notify error:`, error.message);
  }
}

export async function updateOrderNotification({ game, groupId, messageId, lines }) {
  if (!groupId || !messageId) return;

  try {
    return await bot.editMessageText(lines.join("\n"), {
      chat_id: groupId,
      message_id: messageId,
      parse_mode: "HTML",
    });
  } catch (error) {
    if (!error.message?.includes("message is not modified")) {
      console.error(`${game} Telegram update error:`, error.message);
    }
  }
}
