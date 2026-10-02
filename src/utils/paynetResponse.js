import { paynetErrors } from "../constants/paynetErrors.js";

export function paynetResult(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

export function paynetError(id, error, details) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code: error.code,
      message: error.message,
      ...(details ? { details } : {}),
    },
  };
}

export function internalPaynetError(id) {
  return paynetError(id, paynetErrors.internalError);
}
