import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ["paynet"],
      default: "paynet",
    },
    game: {
      type: String,
      required: true,
      enum: ["mlbb", "pubg"],
    },
    orderNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    transId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    providerTrnId: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      validate: Number.isInteger,
    },
    quantity: {
      type: String,
      required: true,
    },
    priceAmount: {
      type: Number,
      required: true,
    },
    amountInTiyin: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "success", "failed", "reversed"],
      default: "success",
    },
    gwOrderId: {
      type: String,
      index: true,
    },
    gwStatus: {
      type: String,
    },
    gwError: {
      type: String,
    },
    gwResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    telegramMessageId: {
      type: Number,
    },
    fields: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.pre("validate", function setProviderTrnId(next) {
  if (!this.providerTrnId) {
    this.providerTrnId = this.orderNumber;
  }

  next();
});

export default mongoose.model("Order", orderSchema);
