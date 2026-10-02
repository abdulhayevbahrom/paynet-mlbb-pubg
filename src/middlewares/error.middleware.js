import { paynetErrors } from "../constants/paynetErrors.js";
import { paynetError } from "../utils/paynetResponse.js";

export function jsonParseErrorHandler(error, req, res, next) {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json(paynetError(null, paynetErrors.parseError));
  }

  next(error);
}

export function appErrorHandler(error, req, res, next) {
  console.error("Unhandled app error:", error);

  return res.status(500).json(paynetError(null, paynetErrors.internalError));
}
