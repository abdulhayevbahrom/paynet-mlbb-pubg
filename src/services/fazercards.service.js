import axios from "axios";
import { env } from "../config/env.js";

const client = axios.create({
  baseURL: env.fazercards.baseUrl,
  timeout: env.fazercards.timeoutMs,
  headers: { "X-API-Key": env.fazercards.apiKey, "Content-Type": "application/json" },
});

async function request(config) {
  if (!env.fazercards.apiKey) throw new Error("FAZERCARDS_API_KEY sozlanmagan");
  try {
    const { data } = await client.request(config);
    if (data?.ok === false) throw new Error(data.error || "FazerCards xatosi");
    return data;
  } catch (error) {
    if (error.response) {
      const detail = error.response.data;
      const wrapped = new Error(detail?.error || error.message);
      wrapped.status = error.response.status;
      wrapped.code = detail?.code;
      throw wrapped;
    }
    throw error;
  }
}

export async function getPubgOffers() {
  const products = [];
  let cursor;
  do {
    const { items = [], meta = {} } = await request({ method: "GET", url: "/topups", params: { limit: 50, ...(cursor ? { cursor } : {}) } });
    for (const category of items.filter((item) => /pubg mobile/i.test(item.name))) {
      const detail = await request({ method: "GET", url: "/topups/offers", params: { category_id: category.category_id } });
      for (const offer of detail.offers || []) {
        if (/\buc\b/i.test(offer.name)) products.push({
          id: `${category.category_id}|${offer.offer_id}`,
          productName: offer.name,
          categoryName: category.name,
          price: offer.price_usd,
        });
      }
    }
    cursor = meta.has_more ? meta.next_cursor : null;
  } while (cursor);
  return products;
}

export async function validatePubgId(playerId) {
  const { items = [] } = await request({ method: "GET", url: "/topups/validate-id" });
  const category = items.find((item) => /pubg mobile/i.test(item.name));
  if (!category) throw new Error("PUBG ID tekshirish mavjud emas");
  return request({ method: "POST", url: "/topups/validate-id", data: { category_id: category.category_id, fields: { player_id: playerId } } });
}

export function createPubgOrder({ productId, playerId, transactionId }) {
  const [category_id, offer_id] = String(productId).split("|");
  if (!category_id || !offer_id) throw new Error("FazerCards paketi qayta tanlanishi kerak");
  return request({ method: "POST", url: "/topups/order", headers: { "Idempotency-Key": `paynet-pubg-${transactionId}` }, data: { category_id, offer_id, fields: { player_id: playerId } } });
}

export function getPubgOrder(orderId) {
  return request({ method: "GET", url: `/orders/${encodeURIComponent(orderId)}` });
}

export function getFazerBalance() {
  return request({ method: "GET", url: "/balance" });
}
