import "dotenv/config";
import connectDB from "../config/db.js";
import ProductPackage from "../models/productPackage.model.js";

const packages = [
  { game: "mlbb", quantity: "55", price: 15000 },
  { game: "mlbb", quantity: "86", price: 20000 },
  { game: "mlbb", quantity: "172", price: 38000 },
  { game: "mlbb", quantity: "275", price: 64000 },
  { game: "mlbb", quantity: "706", price: 155000 },
  { game: "mlbb", quantity: "2195", price: 460000 },
  { game: "mlbb", quantity: "3688", price: 7300000 },
  { game: "mlbb", quantity: "5532", price: 1020000 },
  { game: "mlbb", quantity: "9228", price: 17600000 },
  { game: "mlbb", quantity: "weekly", price: 30000 },
  { game: "pubg", quantity: "60", price: 14000 },
  { game: "pubg", quantity: "325", price: 72000 },
  { game: "pubg", quantity: "660", price: 141000 },
  { game: "pubg", quantity: "1800", price: 355000 },
  { game: "pubg", quantity: "3850", price: 680000 },
  { game: "pubg", quantity: "8100", price: 1400000 },
];

await connectDB();

for (const item of packages) {
  await ProductPackage.updateOne(
    {
      game: item.game,
      quantity: item.quantity,
    },
    {
      $setOnInsert: {
        ...item,
        isActive: true,
      },
    },
    {
      upsert: true,
    },
  );
}

console.log(`Seed completed: ${packages.length} packages checked`);
process.exit(0);
