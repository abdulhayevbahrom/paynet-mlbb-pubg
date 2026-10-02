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
const GW_PICKER_PAGE_SIZE = 8;

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
    product.serviceName,
    product.region,
    product.regionName,
  ].filter(Boolean).join(" ").toLowerCase();

  if (game === "pubg") {
    const slug = String(product.slug || "").toLowerCase();
    const isPubg = value.includes("pubg");
    const isUcPack = /\d+\s*uc\b/.test(value) || /\buc\b/.test(value);
    const isGlobal = value.includes("global")
      || slug === "pubg"
      || slug === "pubgmobile";
    const excluded = [
      "prime",
      "subscription",
      "material",
      "emblem",
      "gamekey",
      "game key",
    ].some((term) => value.includes(term));

    return isPubg && isUcPack && isGlobal && !excluded;
  }

  const isMlbb = value.includes("mlbb")
    || value.includes("mobile legends")
    || value.includes("mobilelegends");

  return isMlbb && value.includes("global");
}

function gwProductLine(product) {
  const name = product.serviceName || product.productName || product.gameName || "-";
  return `${name} | ${product.price}`;
}

function gwProductName(product) {
  return product.serviceName || product.productName || product.gameName || product.id;
}

function gwProductQuantity(product) {
  const name = gwProductName(product);
  const bonusMatch = name.match(/(\d+)\s*\+\s*(\d+)/);
  if (bonusMatch) {
    return String(Number(bonusMatch[1]) + Number(bonusMatch[2]));
  }

  const numberMatch = name.match(/\d+/);
  if (numberMatch) return numberMatch[0];

  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function loadGwProductsForGame(game) {
  const response = await getGwProducts();
  return (response.products || []).filter((product) => (
    product.status !== "inactive" && isGwProductForGame(product, game)
  ));
}

async function showGwProductPicker(chatId, page = 0, messageId = null) {
  const state = adminState.get(chatId);
  if (!state) return;

  let products = state.gwProducts;
  if (!products) {
    products = await loadGwProductsForGame(state.game);
    adminState.set(chatId, { ...state, gwProducts: products });
  }

  if (!products.length) {
    adminState.delete(chatId);
    return bot.sendMessage(chatId, "GW katalogida mos paket topilmadi.", mainMenu());
  }

  const pageCount = Math.ceil(products.length / GW_PICKER_PAGE_SIZE);
  const safePage = Math.max(0, Math.min(page, pageCount - 1));
  const start = safePage * GW_PICKER_PAGE_SIZE;
  const pageProducts = products.slice(start, start + GW_PICKER_PAGE_SIZE);
  const inlineKeyboard = pageProducts.map((product) => ([{
    text: `${gwProductName(product)} | ${product.price}`.slice(0, 60),
    callback_data: `gwselect:${product.id}`,
  }]));
  const navigation = [];

  if (safePage > 0) {
    navigation.push({ text: "⬅️", callback_data: `gwpage:${safePage - 1}` });
  }
  if (safePage < pageCount - 1) {
    navigation.push({ text: "➡️", callback_data: `gwpage:${safePage + 1}` });
  }
  if (navigation.length) inlineKeyboard.push(navigation);

  const text = `GW paketni tanlang (${safePage + 1}/${pageCount})`;
  const options = { reply_markup: { inline_keyboard: inlineKeyboard } };

  if (messageId) {
    return bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      ...options,
    });
  }

  return bot.sendMessage(chatId, text, options);
}

async function sendGwCatalog(chatId, game) {
  const products = await loadGwProductsForGame(game);

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
    `📦 Order: <b>#${order.orderNumber}</b>`,
    `🎮 O'yin: <b>${order.game.toUpperCase()}</b>`,
    `💳 Provider: <b>${order.provider}</b>`,
    `⚙️ Holat: <b>${order.status}</b>`,
    `💎 Miqdor: <b>${order.quantity}</b>`,
    `💰 Narx: <b>${order.priceAmount}</b> so'm`,
    `🧾 Paynet amount: <b>${order.amountInTiyin}</b>`,
    `🔖 Tranzaksiya: <code>${order.transId}</code>`,
    `🔗 GW order: <code>${order.gwOrderId || "-"}</code>`,
    `🌐 GW holat: <b>${order.gwStatus || "-"}</b>`,
    ...(order.gwError ? [`⚠️ GW xatolik: <code>${order.gwError}</code>`] : []),
    `📅 Sana: <i>${new Date(order.createdAt).toLocaleString()}</i>`,
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
    `🎮 O'yin: <b>${game.title}</b>`,
    `💎 Miqdor: <b>${item.quantity}</b> ${game.quantityLabel}`,
    `💰 Sotuv narxi: <b>${item.price}</b> so'm`,
    `🔗 GW paket: <b>${item.gwProductName || "SOZLANMAGAN"}</b>`,
    ...(item.gwPrice !== undefined ? [`💵 API narxi: <b>${item.gwPrice}</b>`] : []),
    `⚙️ Holat: <b>${status}</b>`,
  ].join("\n");
}

function packageKeyboard(item) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✏️ Sotuv narxi", callback_data: `pkg:price:${item._id}` }],
        [{ text: "🔗 GW paket", callback_data: `pkg:gwpid:${item._id}:${item.game}` }],
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
    action: "add_select_gwproduct",
    game: game.key,
  });

  return showGwProductPicker(chatId);
}

async function handleStateMessage(msg, text) {
  const chatId = msg.chat.id;
  const state = adminState.get(chatId);

  if (!state) return false;

  if (state.action === "add_sale_price") {
    const price = Number(text);

    if (Number.isNaN(price) || price < 0) {
      return bot.sendMessage(chatId, "Narx noto'g'ri. Musbat raqam kiriting.");
    }

    try {
      const product = state.selectedGwProduct;
      const created = await createPackage({
        game: state.game,
        quantity: gwProductQuantity(product),
        price,
        gwPid: product.id,
        gwProductName: gwProductName(product),
        gwPrice: product.price,
      });

      adminState.delete(chatId);
      return bot.sendMessage(
        chatId,
        `Paket saqlandi:\n\n${packageText(created, games[state.game])}`,
        { ...mainMenu(), parse_mode: "HTML" },
      );
    } catch (error) {
      adminState.delete(chatId);
      console.error("Create package error:", error);

      if (error.code === 11000) {
        return bot.sendMessage(chatId, "Bu API paketi allaqachon yaratilgan.", mainMenu());
      }

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

    const chatId = query.message.chat.id;
    const [scope, action, packageId, value] = query.data.split(":");

    if (scope === "gwpage") {
      await bot.answerCallbackQuery(query.id);
      return showGwProductPicker(
        chatId,
        Number(action),
        query.message.message_id,
      );
    }

    if (scope === "gwselect") {
      const state = adminState.get(chatId);
      const product = state?.gwProducts?.find((item) => item.id === action);

      if (!state || !product) {
        return bot.answerCallbackQuery(query.id, {
          text: "Tanlov eskirgan. Qaytadan urinib ko'ring.",
          show_alert: true,
        });
      }

      try {
        let saved;
        const gwFields = {
          gwPid: product.id,
          gwProductName: gwProductName(product),
          gwPrice: product.price,
        };

        if (state.action === "add_select_gwproduct") {
          adminState.set(chatId, {
            ...state,
            action: "add_sale_price",
            selectedGwProduct: product,
          });
          await bot.answerCallbackQuery(query.id);
          return bot.sendMessage(
            chatId,
            `${gwProductName(product)} uchun mijoz to'laydigan narxni so'mda kiriting.`,
          );
        } else if (state.action === "edit_gwproduct") {
          saved = await updatePackage(state.packageId, {
            ...gwFields,
            quantity: gwProductQuantity(product),
          });
        }

        if (!saved) {
          throw new Error("Paket topilmadi");
        }

        adminState.delete(chatId);
        await bot.answerCallbackQuery(query.id, { text: "GW paket saqlandi" });
        return bot.sendMessage(
          chatId,
          `Paket saqlandi:\n\n${packageText(saved, games[saved.game])}`,
          { ...mainMenu(), parse_mode: "HTML" },
        );
      } catch (error) {
        adminState.delete(chatId);
        console.error("Save GW package error:", error);
        await bot.answerCallbackQuery(query.id, { text: "Xatolik", show_alert: true });

        if (error.code === 11000) {
          return bot.sendMessage(chatId, "Bu miqdordagi paket allaqachon bor.", mainMenu());
        }

        return bot.sendMessage(chatId, "Paketni saqlashda xatolik bo'ldi.", mainMenu());
      }
    }

    if (scope !== "pkg") return;

    if (action === "price") {
      adminState.set(chatId, { action: "edit_price", packageId });
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(chatId, "Yangi narxni so'mda kiriting.");
    }

    if (action === "gwpid") {
      adminState.set(chatId, {
        action: "edit_gwproduct",
        packageId,
        game: value,
      });
      await bot.answerCallbackQuery(query.id);
      return showGwProductPicker(chatId);
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
