import TelegramBot from "node-telegram-bot-api";
import { env } from "../config/env.js";

export const bot = new TelegramBot(env.telegram.botToken, {
  polling: false,
});

export async function notifyOrder({ game, groupId, lines }) {
  if (!groupId) return;

  try {
    await bot.sendMessage(groupId, lines.join("\n"), {
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error(`${game} Telegram notify error:`, error.message);
  }
}
