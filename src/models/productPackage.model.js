import mongoose from "mongoose";

const productPackageSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["mlbb", "pubg"],
      index: true,
    },
    quantity: {
      type: String,
      required: true,
      trim: true,
    },
    gwPid: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    gwProductName: {
      type: String,
      trim: true,
      default: "",
    },
    gwPrice: {
      type: Number,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

productPackageSchema.index({ game: 1, quantity: 1 }, { unique: true });

export default mongoose.model("ProductPackage", productPackageSchema);
