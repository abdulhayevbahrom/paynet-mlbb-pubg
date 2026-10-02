import express from "express";
import { games } from "../../config/products.js";
import {
  authPaynet,
  checkPaynetServiceId,
  requirePost,
} from "../../middlewares/paynet.middleware.js";
import { paynetErrors } from "../../constants/paynetErrors.js";
import { paynetError } from "../../utils/paynetResponse.js";
import { createGamePaynetController } from "./gamePaynet.controller.js";

const router = express.Router();

router.use(requirePost);

const controllers = {
  mlbb: createGamePaynetController(games.mlbb),
  pubg: createGamePaynetController(games.pubg),
};

function dispatch(controller) {
  return (req, res) => {
    const { id, jsonrpc, method, params } = req.body ?? {};

    if (jsonrpc !== "2.0" || !method || !params || typeof params !== "object") {
      return res.json(paynetError(id, paynetErrors.invalidRequest));
    }

    const actions = {
      GetInformation: controller.getInformation,
      PerformTransaction: controller.performTransaction,
      CheckTransaction: controller.checkTransaction,
      GetStatement: controller.getStatement,
    };

    const action = actions[method];

    if (!action) {
      return res.json(
        paynetError(id, {
          code: -32601,
          message: "Method topilmadi",
        }),
      );
    }

    return action(req, res);
  };
}

router.all("/mlbb", [authPaynet, checkPaynetServiceId], dispatch(controllers.mlbb));
router.all("/pubg", [authPaynet, checkPaynetServiceId], dispatch(controllers.pubg));

export default router;
