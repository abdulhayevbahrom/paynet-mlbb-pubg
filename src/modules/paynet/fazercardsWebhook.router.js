import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { games } from "../../config/products.js";
import Order from "../../models/order.model.js";
import { getPubgOrder } from "../../services/fazercards.service.js";
import { applyGwResponse, refreshOrderNotification } from "./gamePaynet.controller.js";

const router = express.Router();

router.post("/", express.raw({ type: "application/json", limit: "64kb" }), async (req, res) => {
  const secret = env.fazercards.webhookSecret;
  if (!secret || !Buffer.isBuffer(req.body)) return res.sendStatus(503);

  const supplied = req.get("X-Webhook-Signature") || "";
  const expected = `sha256=${createHmac("sha256", secret).update(req.body).digest("hex")}`;
  const received = Buffer.from(supplied);
  const correct = Buffer.from(expected);
  if (received.length !== correct.length || !timingSafeEqual(received, correct)) {
    return res.sendStatus(401);
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.sendStatus(400);
  }

  if (!["order.created", "order.status_changed"].includes(payload.event)) {
    return res.sendStatus(200);
  }
  const orderId = payload.data?.order_id;
  if (!/^ord-\d+$/.test(orderId || "")) return res.sendStatus(400);

  try {
    const order = await Order.findOne({ game: "pubg", provider: "paynet", gwOrderId: orderId });
    if (!order) return res.sendStatus(200);
    const current = await getPubgOrder(orderId);
    await applyGwResponse(order, current);
    await refreshOrderNotification(order, games.pubg);
    return res.sendStatus(200);
  } catch (error) {
    console.error("FazerCards webhook processing error:", error);
    return res.sendStatus(500);
  }
});

export default router;
