import Order from "../../models/order.model.js";
import { paynetErrors } from "../../constants/paynetErrors.js";
import { notifyOrder } from "../../services/telegram.service.js";
import { checkMlbbAccount } from "../../services/mlbb.service.js";
import { findActivePackage } from "../../services/package.service.js";
import { getNextSequence } from "../../services/counter.service.js";
import {
  createGwOrder,
  getGwOrder,
  verifyGwAccount,
  GwApiError,
} from "../../services/gw.service.js";
import { randomUUID } from "node:crypto";
import {
  internalPaynetError,
  paynetError,
  paynetResult,
} from "../../utils/paynetResponse.js";
import {
  tashkentTimestamp,
  tashkentTransactionTimestamp,
} from "../../utils/time.js";

function validateGameFields(game, fields = {}) {
  if (game.key === "mlbb") {
    const { user_id: userId, zone_id: zoneId, quantity } = fields;

    if (!userId || !zoneId || !quantity) {
      return { ok: false, error: paynetErrors.invalidParams };
    }

    if (String(zoneId).startsWith("6")) {
      return {
        ok: false,
        error: { ...paynetErrors.validationFailed, message: "Zone ID 6 bilan boshlanmasin" },
      };
    }

    return {
      ok: true,
      identity: { userId: String(userId), zoneId: String(zoneId) },
      quantity: String(quantity),
    };
  }

  const { player_id: playerId, quantity } = fields;

  if (!playerId || !quantity) {
    return { ok: false, error: paynetErrors.invalidParams };
  }

  if (!String(playerId).startsWith("5")) {
    return {
      ok: false,
      error: { ...paynetErrors.validationFailed, message: "Player ID 5 bilan boshlansin" },
    };
  }

  return {
    ok: true,
    identity: { playerId: String(playerId) },
    quantity: String(quantity),
  };
}

async function enrichInformation(game, identity) {
  if (game.key === "pubg") {
    const account = await verifyGwAccount({
      game: "pubg",
      identity,
      trxid: `CHK-PUBG-${randomUUID()}`,
    });

    if (!account?.success) {
      return null;
    }

    return {
      player_id: identity.playerId,
      player_name: account.playerName || account.name || "",
    };
  }

  const account = await checkMlbbAccount({
    userId: identity.userId,
    zoneId: identity.zoneId,
  });

  if (!account.exists) {
    return null;
  }

  return {
    name: account.username,
  };
}

function buildOrderMessage({ game, identity, quantity, order }) {
  const gateway = [
    `🔗 GW order: <code>${order.gwOrderId || "-"}</code>`,
    `⚙️ GW status: <b>${order.gwStatus || "-"}</b>`,
  ];

  if (game.key === "mlbb") {
    return [
      `📦 Order: <b>#${order.orderNumber}</b>`,
      `🆔 MLBB ID: <code>${identity.userId}</code>`,
      `🌐 Zone ID: <code>${identity.zoneId}</code>`,
      `💎 Miqdori: <b>${quantity}</b> ${game.quantityLabel}`,
      `💰 From: <b>Paynet</b>`,
      `📅 Sana: <i>${order.createdAt.toLocaleString()}</i>`,
      ...gateway,
    ];
  }

  return [
    `📦 Order: <b>#${order.orderNumber}</b>`,
    `🆔 Player ID: <code>${identity.playerId}</code>`,
    `🪙 Miqdori: <b>${quantity}</b> ${game.quantityLabel}`,
    `💰 From: <b>Paynet</b>`,
    `📅 Sana: <i>${order.createdAt.toLocaleString()}</i>`,
    ...gateway,
  ];
}

function localStatus(gwStatus) {
  if (gwStatus === "completed") return "success";
  if (gwStatus === "cancelled") return "failed";
  return "pending";
}

async function applyGwResponse(order, response) {
  order.gwOrderId = response?.orderId || order.gwOrderId;
  order.gwStatus = response?.status || order.gwStatus;
  order.gwError = response?.error || undefined;
  order.gwResponse = response;
  order.status = localStatus(response?.status);
  await order.save();
  return order;
}

function gwPaynetError(error) {
  const message = error?.message || "Top-up provider xatosi";
  const validationCodes = new Set([
    "INVALID BODY",
    "INVALID REQUEST",
    "UNKNOWN PID",
    "INVALID PACK",
    "GAME DISABLED",
    "INVALID_PRODUCT",
    "PRODUCT_DISABLED",
  ]);

  if (validationCodes.has(error?.code) || validationCodes.has(message)) {
    return { ...paynetErrors.validationFailed, message };
  }

  if (message === "INSUFFICIENT BALANCE") {
    return { ...paynetErrors.internalError, message: "Top-up balansida mablag' yetarli emas" };
  }

  return { ...paynetErrors.internalError, message };
}

export function createGamePaynetController(game) {
  return {
    async getInformation(req, res) {
      const { id, params } = req.body;

      try {
        if (!params || typeof params !== "object") {
          return res.json(paynetError(id, paynetErrors.invalidParams));
        }

        if (params.serviceId !== game.serviceId) {
          return res.json(paynetError(id, paynetErrors.invalidService));
        }

        const validated = validateGameFields(game, params.fields);
        if (!validated.ok) {
          return res.json(paynetError(id, validated.error));
        }

        const selectedPackage = await findActivePackage({
          game: game.key,
          quantity: validated.quantity,
        });
        if (!selectedPackage) {
          return res.json(paynetError(id, paynetErrors.invalidQuantity));
        }

        if (!selectedPackage.gwPid) {
          return res.json(
            paynetError(id, {
              ...paynetErrors.invalidQuantity,
              message: "Paket uchun GW PID sozlanmagan",
            }),
          );
        }

        const fields = await enrichInformation(game, validated.identity);
        if (!fields) {
          return res.json(
            paynetError(id, {
              ...paynetErrors.validationFailed,
              message: "Mijoz ma'lumotlari topilmadi",
            }),
          );
        }

        return res.json(
          paynetResult(id, {
            status: "0",
            timestamp: tashkentTimestamp(),
            fields: {
              ...fields,
              amount: selectedPackage.price,
            },
          }),
        );
      } catch (error) {
        console.error(`Paynet ${game.key} GetInformation error:`, error);
        return res.json(internalPaynetError(id));
      }
    },

    async performTransaction(req, res) {
      const { id, params } = req.body;

      try {
        if (!params || typeof params !== "object") {
          return res.json(paynetError(id, paynetErrors.invalidParams));
        }

        const transactionId = params?.transactionId;
        const amount = Number(params?.amount);

        if (params.serviceId !== game.serviceId) {
          return res.json(paynetError(id, paynetErrors.invalidService));
        }

        if (!transactionId || !amount) {
          return res.json(paynetError(id, paynetErrors.invalidParams));
        }

        const validated = validateGameFields(game, params.fields);
        if (!validated.ok) {
          return res.json(paynetError(id, validated.error));
        }

        const selectedPackage = await findActivePackage({
          game: game.key,
          quantity: validated.quantity,
        });
        if (!selectedPackage) {
          return res.json(paynetError(id, paynetErrors.invalidQuantity));
        }

        if (!selectedPackage.gwPid) {
          return res.json(
            paynetError(id, {
              ...paynetErrors.invalidQuantity,
              message: "Paket uchun GW PID sozlanmagan",
            }),
          );
        }

        if (Number.isNaN(amount) || amount !== selectedPackage.price * 100) {
          return res.json(paynetError(id, paynetErrors.invalidAmount));
        }

        let order = await Order.findOne({ transId: transactionId });
        if (order && (
          order.game !== game.key
          || order.quantity !== validated.quantity
          || order.amountInTiyin !== amount
        )) {
          return res.json(paynetError(id, paynetErrors.transactionExists));
        }

        if (order && (order.status !== "pending" || order.gwOrderId)) {
          return res.json(paynetError(id, paynetErrors.transactionExists));
        }

        if (!order) {
          const orderNumber = await getNextSequence("order");
          order = await Order.create({
            provider: "paynet",
            game: game.key,
            orderNumber,
            transId: transactionId,
            quantity: validated.quantity,
            priceAmount: selectedPackage.price,
            amountInTiyin: amount,
            status: "pending",
            fields: params.fields,
          });
        }

        let gwResponse;

        try {
          gwResponse = await createGwOrder({
            pid: selectedPackage.gwPid,
            trxid: String(transactionId),
            game: game.key,
            identity: validated.identity,
          });
          await applyGwResponse(order, gwResponse);
        } catch (error) {
          // A timeout/network failure is ambiguous: GW may already have accepted
          // the idempotent trxid. Keep it pending so the same Paynet request can retry.
          const definitiveFailure = Boolean(error.status);
          order.status = definitiveFailure ? "failed" : "pending";
          order.gwStatus = definitiveFailure ? "cancelled" : "processing";
          order.gwError = error.message;
          order.gwResponse = error.response;
          await order.save();

          console.error(`GW ${game.key} create order error:`, error);
          return res.json(paynetError(id, gwPaynetError(error)));
        }

        if (order.status === "failed") {
          return res.json(
            paynetError(id, gwPaynetError({
              message: gwResponse?.error || "Top-up bekor qilindi",
              code: gwResponse?.code,
            })),
          );
        }

        await notifyOrder({
          game: game.key,
          groupId: game.groupId,
          lines: buildOrderMessage({
            game,
            identity: validated.identity,
            quantity: validated.quantity,
            order,
          }),
        });

        return res.json(
          paynetResult(id, {
            timestamp: tashkentTimestamp(),
            providerTrnId: order._id,
            fields: {
              price: amount,
              message: "To'lov muvaffaqiyatli amalga oshirildi",
            },
          }),
        );
      } catch (error) {
        console.error(`Paynet ${game.key} PerformTransaction error:`, error);
        return res.json(internalPaynetError(id));
      }
    },

    async checkTransaction(req, res) {
      const { id, params } = req.body;

      try {
        if (!params || typeof params !== "object") {
          return res.json(paynetError(id, paynetErrors.invalidParams));
        }

        if (params.serviceId !== game.serviceId) {
          return res.json(paynetError(id, paynetErrors.invalidService));
        }

        const transactionId = params?.transactionId;

        if (!transactionId) {
          return res.json(paynetError(id, paynetErrors.invalidParams));
        }

        const order = await Order.findOne({
          transId: transactionId,
          game: game.key,
          provider: "paynet",
        });

        if (!order) {
          return res.json(paynetError(id, paynetErrors.transactionNotFound));
        }

        if (order.status === "pending" && order.gwOrderId) {
          try {
            const gwResponse = await getGwOrder(order.gwOrderId);
            await applyGwResponse(order, gwResponse);
          } catch (error) {
            console.error(`GW ${game.key} status error:`, error);

            if (error instanceof GwApiError && error.status === 404) {
              order.status = "failed";
              order.gwStatus = "cancelled";
              order.gwError = error.message;
              await order.save();
            }
          }
        }

        if (order.status === "failed" || order.status === "reversed") {
          return res.json(paynetError(id, paynetErrors.transactionCanceled));
        }

        return res.json(
          paynetResult(id, {
            transactionState: 1,
            timestamp: tashkentTransactionTimestamp(order.updatedAt),
            providerTrnId: order._id,
          }),
        );
      } catch (error) {
        console.error(`Paynet ${game.key} CheckTransaction error:`, error);
        return res.json(internalPaynetError(id));
      }
    },

    async getStatement(req, res) {
      const { id, params } = req.body;

      try {
        if (!params || typeof params !== "object") {
          return res.json(paynetError(id, paynetErrors.invalidParams));
        }

        const { dateFrom, dateTo, serviceId } = params ?? {};

        if (!dateFrom || !dateTo || !serviceId) {
          return res.json(paynetError(id, paynetErrors.invalidParams));
        }

        if (serviceId !== game.serviceId) {
          return res.json(paynetError(id, paynetErrors.invalidService));
        }

        const orders = await Order.find({
          game: game.key,
          provider: "paynet",
          status: { $in: ["pending", "success"] },
          createdAt: {
            $gte: new Date(dateFrom),
            $lte: new Date(dateTo),
          },
        }).sort({ createdAt: 1 });

        return res.json(
          paynetResult(id, {
            statements: orders.map((order) => ({
              transactionId: order.transId,
              amount: order.amountInTiyin,
              providerTrnId: order._id,
              timestamp: tashkentTimestamp(order.updatedAt),
            })),
          }),
        );
      } catch (error) {
        console.error(`Paynet ${game.key} GetStatement error:`, error);
        return res.json(internalPaynetError(id));
      }
    },
  };
}
