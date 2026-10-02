import axios from "axios";
import https from "node:https";
import { env } from "../config/env.js";

const ipv4Agent = new https.Agent({
  family: 4,
  keepAlive: true,
});

const client = axios.create({
  baseURL: env.gw.baseUrl,
  timeout: env.gw.timeoutMs,
  httpsAgent: ipv4Agent,
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": env.gw.apiKey,
  },
});

export class GwApiError extends Error {
  constructor(message, { status, code, response } = {}) {
    super(message);
    this.name = "GwApiError";
    this.status = status;
    this.code = code;
    this.response = response;
  }
}

async function request(config) {
  try {
    const { data } = await client.request(config);
    return data;
  } catch (error) {
    const data = error.response?.data;
    throw new GwApiError(
      data?.error || data?.message || error.message || "GW API request failed",
      {
        status: error.response?.status,
        code: data?.code,
        response: data,
      },
    );
  }
}

export function createGwOrder({ pid, trxid, game, identity }) {
  const accountFields = game === "mlbb"
    ? { userId: identity.userId, zoneId: identity.zoneId }
    : { userId: identity.playerId };

  return request({
    method: "POST",
    url: "/orders",
    data: {
      pid,
      trxid,
      idempotencyKey: trxid,
      ...accountFields,
    },
  });
}

export function getGwOrder(orderId) {
  return request({
    method: "GET",
    url: `/orders/${encodeURIComponent(orderId)}`,
  });
}

export function getGwBalance() {
  return request({
    method: "GET",
    url: "/balance",
  });
}

export function getGwProducts() {
  return request({
    method: "GET",
    url: "/products",
  });
}

export function verifyGwAccount({ game, identity, trxid }) {
  if (game === "mlbb") {
    return request({
      method: "POST",
      url: "/mlvfy",
      data: {
        userId: identity.userId,
        zoneId: identity.zoneId,
        trxid,
      },
    });
  }

  return request({
    method: "POST",
    url: "/pubgvvfy",
    data: {
      playerId: identity.playerId,
      trxid,
    },
  });
}
