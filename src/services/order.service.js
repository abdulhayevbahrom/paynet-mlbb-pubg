import Order from "../models/order.model.js";

export async function findOrderByNumber(orderNumber) {
  return Order.findOne({ orderNumber: Number(orderNumber) }).lean();
}
