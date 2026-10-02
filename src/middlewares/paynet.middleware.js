import { env } from "../config/env.js";
import { paynetErrors } from "../constants/paynetErrors.js";
import { paynetError } from "../utils/paynetResponse.js";

export function requirePost(req, res, next) {
  const { id } = req.body ?? {};

  if (req.method !== "POST") {
    return res.json(paynetError(id, paynetErrors.methodMustBePost));
  }

  next();
}

export function authPaynet(req, res, next) {
  const { id } = req.body ?? {};
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json(paynetError(id, paynetErrors.credentialsMissing));
  }

  const decoded = Buffer.from(token, "base64").toString("utf8");
  const [login, password] = decoded.split(":");

  if (login !== env.paynet.login || password !== env.paynet.password) {
    return res.status(401).json(paynetError(id, paynetErrors.unauthorized));
  }

  next();
}

export function checkPaynetServiceId(req, res, next) {
  const { id, params } = req.body ?? {};

  if (!params || typeof params !== "object") {
    return res.json(paynetError(id, paynetErrors.invalidParams));
  }

  const serviceId = params?.serviceId;

  if (typeof serviceId !== "number" || !env.paynet.serviceIds.includes(serviceId)) {
    return res.json(paynetError(id, paynetErrors.invalidService));
  }

  next();
}
