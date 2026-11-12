import TelegramBot from "node-telegram-bot-api";
import { env } from "../config/env.js";

export const bot = new TelegramBot(env.telegram.botToken, {
  polling: false,
});

const pendingEdits = new Map();
const editQueue = [];
let editing = false;
let nextEditAt = 0;
const EDIT_SPACING_MS = 1100;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(error) {
  const seconds = Number(error?.response?.body?.parameters?.retry_after);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  if (error?.response?.statusCode === 429 || error?.response?.status === 429) return 15000;
  return null;
}

async function processEditQueue() {
  if (editing) return;
  editing = true;
  try {
    while (editQueue.length) {
      const key = editQueue[0];
      const job = pendingEdits.get(key);
      if (!job) {
        editQueue.shift();
        continue;
      }

      await delay(Math.max(0, nextEditAt - Date.now()));
      const text = job.text;
      try {
        await bot.editMessageText(text, {
          chat_id: job.groupId,
          message_id: job.messageId,
          parse_mode: "HTML",
        });
        nextEditAt = Date.now() + EDIT_SPACING_MS;
      } catch (error) {
        const retryMs = retryAfterMs(error);
        if (retryMs !== null) {
          nextEditAt = Date.now() + retryMs + 1000;
          console.warn(`${job.game} Telegram rate limit: retry in ${Math.ceil((retryMs + 1000) / 1000)}s`);
          continue;
        }
        if (!error.message?.includes("message is not modified")) {
          console.error(`${job.game} Telegram update error:`, error.message);
        }
      }

      if (pendingEdits.get(key)?.text === text) {
        pendingEdits.delete(key);
        editQueue.shift();
      }
    }
  } finally {
    editing = false;
  }
}

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

export function updateOrderNotification({ game, groupId, messageId, lines }) {
  if (!groupId || !messageId) return;
  const key = `${groupId}:${messageId}`;
  const text = lines.join("\n");
  if (pendingEdits.has(key)) {
    pendingEdits.get(key).text = text;
  } else {
    pendingEdits.set(key, { game, groupId, messageId, text });
    editQueue.push(key);
  }
  void processEditQueue();
}
