import { bot } from "../services/telegram.service.js";
import { env } from "../config/env.js";
import { games } from "../config/products.js";
import {
  createPackage,
  deletePackage,
  listPackages,
  updatePackage,
} from "../services/package.service.js";
import { findOrderByNumber } from "../services/order.service.js";
import { getGwBalance, getGwProducts } from "../services/gw.service.js";

const adminState = new Map();

function isAdmin(msgOrQuery) {
  const id = msgOrQuery?.from?.id;
  return env.telegram.adminIds.includes(Number(id));
}

function mainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ["📦 MLBB paketlar", "📦 PUBG paketlar"],
        ["🌐 GW MLBB katalog", "🌐 GW PUBG katalog"],
        ["➕ MLBB paket", "➕ PUBG paket"],
        ["💰 Balans", "🔎 Order qidirish"],
        ["↩️ Bekor qilish"],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function isGwProductForGame(product, game) {
  const value = [
    product.slug,
    product.gameName,
    product.category,
    product.productName,
  ].filter(Boolean).join(" ").toLowerCase();

  if (game === "pubg") return value.includes("pubg");

  return value.includes("mlbb")
    || value.includes("mobile legends")
    || value.includes("mobilelegends");
}

function gwProductLine(product) {
  const name = product.serviceName || product.productName || product.gameName || "-";
  return `${name} | ${product.price}`;
}

async function sendGwCatalog(chatId, game) {
  const response = await getGwProducts();
  const products = (response.products || []).filter((product) => (
    product.status !== "inactive" && isGwProductForGame(product, game)
  ));

  if (!products.length) {
    return bot.sendMessage(chatId, "Paket topilmadi.", mainMenu());
  }

  const lines = products.map(gwProductLine);
  const chunks = [];
  let chunk = "";

  for (const line of lines) {
    const next = chunk ? `${chunk}\n${line}` : line;
    if (next.length > 3900) {
      chunks.push(chunk);
      chunk = line;
    } else {
      chunk = next;
    }
  }
  if (chunk) chunks.push(chunk);

  for (const message of chunks) {
    await bot.sendMessage(chatId, message);
  }
}

function orderText(order) {
  if (!order) return "Order topilmadi.";

  return [
    `Order: <b>#${order.orderNumber}</b>`,
    `Game: <b>${order.game.toUpperCase()}</b>`,
    `Provider: <b>${order.provider}</b>`,
    `Status: <b>${order.status}</b>`,
    `Miqdor: <b>${order.quantity}</b>`,
    `Narx: <b>${order.priceAmount}</b> so'm`,
    `Paynet amount: <b>${order.amountInTiyin}</b>`,
    `Trans ID: <code>${order.transId}</code>`,
    `GW order ID: <code>${order.gwOrderId || "-"}</code>`,
    `GW status: <b>${order.gwStatus || "-"}</b>`,
    ...(order.gwError ? [`GW error: <code>${order.gwError}</code>`] : []),
    `Mongo ID: <code>${order._id}</code>`,
    `Sana: <i>${new Date(order.createdAt).toLocaleString()}</i>`,
  ].join("\n");
}

function gameFromText(text) {
  if (text.includes("MLBB")) return games.mlbb;
  if (text.includes("PUBG")) return games.pubg;
  return null;
}

function packageText(item, game) {
  const status = item.isActive ? "active" : "inactive";

  return [
    `<b>${game.title}</b>`,
    `ID: <code>${item._id}</code>`,
    `Miqdor: <b>${item.quantity}</b> ${game.quantityLabel}`,
    `Narx: <b>${item.price}</b> so'm`,
    `GW PID: <code>${item.gwPid || "SOZLANMAGAN"}</code>`,
    `Holat: <b>${status}</b>`,
  ].join("\n");
}

function packageKeyboard(item) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✏️ Narx", callback_data: `pkg:price:${item._id}` },
          { text: "🔢 Miqdor", callback_data: `pkg:quantity:${item._id}` },
        ],
        [{ text: "🔗 GW PID", callback_data: `pkg:gwpid:${item._id}` }],
        [
          {
            text: item.isActive ? "⏸ O'chirish" : "▶️ Yoqish",
            callback_data: `pkg:toggle:${item._id}:${item.isActive ? "0" : "1"}`,
          },
          { text: "🗑 Delete", callback_data: `pkg:delete:${item._id}` },
        ],
      ],
    },
    parse_mode: "HTML",
  };
}

async function sendPackages(chatId, game) {
  const packages = await listPackages(game.key);

  if (!packages.length) {
    return bot.sendMessage(chatId, `${game.title} paketlari hali yo'q`, mainMenu());
  }

  await bot.sendMessage(chatId, `${game.title} paketlari:`, mainMenu());

  for (const item of packages) {
    await bot.sendMessage(chatId, packageText(item, game), packageKeyboard(item));
  }
}

async function startAddPackage(chatId, game) {
  adminState.set(chatId, {
    action: "add_quantity",
    game: game.key,
  });

  return bot.sendMessage(
    chatId,
    `${game.title} uchun paket miqdorini kiriting. Masalan: 55 yoki weekly`,
    { reply_markup: { remove_keyboard: true } },
  );
}

async function handleStateMessage(msg, text) {
  const chatId = msg.chat.id;
  const state = adminState.get(chatId);

  if (!state) return false;

  if (state.action === "add_quantity") {
    adminState.set(chatId, {
      ...state,
      action: "add_price",
      quantity: text,
    });

    return bot.sendMessage(chatId, "Endi narxni so'mda kiriting. Masalan: 15000");
  }

  if (state.action === "add_price") {
    const price = Number(text);

    if (Number.isNaN(price) || price < 0) {
      return bot.sendMessage(chatId, "Narx noto'g'ri. Musbat raqam kiriting.");
    }

    adminState.set(chatId, {
      ...state,
      action: "add_gwpid",
      price,
    });
    return bot.sendMessage(chatId, "Endi API katalogidagi GW PID ni kiriting. Masalan: GWML86");
  }

  if (state.action === "add_gwpid") {
    try {
      const created = await createPackage({
        game: state.game,
        quantity: state.quantity,
        price: state.price,
        gwPid: text.trim().toUpperCase(),
      });
      const game = games[state.game];

      adminState.delete(chatId);
      return bot.sendMessage(
        chatId,
        `Paket yaratildi:\n\n${packageText(created, game)}`,
        { ...mainMenu(), parse_mode: "HTML" },
      );
    } catch (error) {
      adminState.delete(chatId);

      if (error.code === 11000) {
        return bot.sendMessage(chatId, "Bu miqdordagi paket allaqachon bor.", mainMenu());
      }

      console.error("Create package error:", error);
      return bot.sendMessage(chatId, "Paket yaratishda xatolik bo'ldi.", mainMenu());
    }
  }

  if (state.action === "edit_price") {
    const price = Number(text);

    if (Number.isNaN(price) || price < 0) {
      return bot.sendMessage(chatId, "Narx noto'g'ri. Musbat raqam kiriting.");
    }

    const updated = await updatePackage(state.packageId, { price });
    adminState.delete(chatId);

    if (!updated) {
      return bot.sendMessage(chatId, "Paket topilmadi.", mainMenu());
    }

    return bot.sendMessage(chatId, "Narx yangilandi.", mainMenu());
  }

  if (state.action === "edit_quantity") {
    try {
      const updated = await updatePackage(state.packageId, { quantity: text });
      adminState.delete(chatId);

      if (!updated) {
        return bot.sendMessage(chatId, "Paket topilmadi.", mainMenu());
      }

      return bot.sendMessage(chatId, "Miqdor yangilandi.", mainMenu());
    } catch (error) {
      adminState.delete(chatId);

      if (error.code === 11000) {
        return bot.sendMessage(chatId, "Bu miqdordagi paket allaqachon bor.", mainMenu());
      }

      console.error("Update package quantity error:", error);
      return bot.sendMessage(chatId, "Miqdor yangilashda xatolik bo'ldi.", mainMenu());
    }
  }

  if (state.action === "edit_gwpid") {
    const updated = await updatePackage(state.packageId, {
      gwPid: text.trim().toUpperCase(),
    });
    adminState.delete(chatId);

    if (!updated) {
      return bot.sendMessage(chatId, "Paket topilmadi.", mainMenu());
    }

    return bot.sendMessage(chatId, "GW PID yangilandi.", mainMenu());
  }

  if (state.action === "find_order") {
    const orderNumber = Number(text.replace("#", ""));

    if (Number.isNaN(orderNumber) || orderNumber < 1) {
      return bot.sendMessage(chatId, "Order raqamini to'g'ri kiriting. Masalan: 15");
    }

    const order = await findOrderByNumber(orderNumber);
    adminState.delete(chatId);

    return bot.sendMessage(chatId, orderText(order), {
      ...mainMenu(),
      parse_mode: "HTML",
    });
  }

  return false;
}

export function initAdminBot() {
  if (!env.telegram.adminIds.length) {
    console.warn("ADMIN_IDS bo'sh. Telegram admin bot ishlamaydi.");
    return;
  }

  bot.startPolling();

  bot.onText(/\/start|\/menu/, async (msg) => {
    if (!isAdmin(msg)) return;
    await bot.sendMessage(msg.chat.id, "Boshqaruv menyusi", mainMenu());
  });

  bot.on("message", async (msg) => {
    if (!isAdmin(msg)) return;

    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    if (!text || text.startsWith("/")) return;

    if (text === "↩️ Bekor qilish") {
      adminState.delete(chatId);
      return bot.sendMessage(chatId, "Bekor qilindi.", mainMenu());
    }

    if (await handleStateMessage(msg, text)) return;

    if (text === "🔎 Order qidirish") {
      adminState.set(chatId, { action: "find_order" });
      return bot.sendMessage(chatId, "Order raqamini kiriting. Masalan: 15");
    }

    if (text === "💰 Balans") {
      try {
        const balance = await getGwBalance();
        return bot.sendMessage(chatId, String(balance.balanceUsd));
      } catch (error) {
        console.error("GW balance error:", error);
        return bot.sendMessage(chatId, "Xatolik");
      }
    }

    if (text === "🌐 GW MLBB katalog" || text === "🌐 GW PUBG katalog") {
      try {
        const game = text.includes("MLBB") ? "mlbb" : "pubg";
        return await sendGwCatalog(chatId, game);
      } catch (error) {
        console.error("GW catalog error:", error);
        return bot.sendMessage(chatId, "Xatolik");
      }
    }

    if (text.startsWith("📦")) {
      const game = gameFromText(text);
      if (game) return sendPackages(chatId, game);
    }

    if (text.startsWith("➕")) {
      const game = gameFromText(text);
      if (game) return startAddPackage(chatId, game);
    }
  });

  bot.on("callback_query", async (query) => {
    if (!isAdmin(query)) {
      return bot.answerCallbackQuery(query.id, {
        text: "Ruxsat yo'q",
        show_alert: true,
      });
    }

    const [scope, action, packageId, value] = query.data.split(":");
    if (scope !== "pkg") return;

    const chatId = query.message.chat.id;

    if (action === "price") {
      adminState.set(chatId, { action: "edit_price", packageId });
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(chatId, "Yangi narxni so'mda kiriting.");
    }

    if (action === "quantity") {
      adminState.set(chatId, { action: "edit_quantity", packageId });
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(chatId, "Yangi miqdorni kiriting.");
    }

    if (action === "gwpid") {
      adminState.set(chatId, { action: "edit_gwpid", packageId });
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(chatId, "API katalogidagi yangi GW PID ni kiriting.");
    }

    if (action === "toggle") {
      await updatePackage(packageId, { isActive: value === "1" });
      await bot.answerCallbackQuery(query.id, { text: "Holat yangilandi" });
      return bot.sendMessage(chatId, "Paket holati yangilandi.", mainMenu());
    }

    if (action === "delete") {
      await deletePackage(packageId);
      await bot.answerCallbackQuery(query.id, { text: "Paket o'chirildi" });
      return bot.sendMessage(chatId, "Paket o'chirildi.", mainMenu());
    }
  });
}
