import "dotenv/config";
import mongoose from "mongoose";
import ProductPackage from "../models/productPackage.model.js";
import { getPubgOffers } from "../services/fazercards.service.js";

const apply = process.argv.includes("--apply");
const offers = await getPubgOffers();
const preferred = offers.filter((offer) => offer.categoryName === "PUBG Mobile (Auto)");

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const packages = await ProductPackage.find({ game: "pubg" });
  const changes = [];
  for (const pkg of packages) {
    const matches = preferred.filter((offer) => {
      const match = offer.productName.match(/^(\d+)\s*UC\b/i);
      return match?.[1] === pkg.quantity;
    });
    if (matches.length !== 1) {
      console.log(`SKIP ${pkg.quantity} UC: Auto katalogda ${matches.length} mos taklif`);
      continue;
    }
    const offer = matches[0];
    changes.push({ quantity: pkg.quantity, oldProduct: pkg.gwPid, newProduct: offer.id, priceUsd: offer.price });
    if (apply) {
      pkg.gwPid = offer.id;
      pkg.gwProductName = `${offer.categoryName}: ${offer.productName}`;
      pkg.gwPrice = Number(offer.price);
      await pkg.save();
    }
  }
  console.log(JSON.stringify({ mode: apply ? "applied" : "preview", changes }, null, 2));
} finally {
  await mongoose.disconnect();
}
