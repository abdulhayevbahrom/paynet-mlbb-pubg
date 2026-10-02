import ProductPackage from "../models/productPackage.model.js";

export async function findActivePackage({ game, quantity }) {
  return ProductPackage.findOne({
    game,
    quantity: String(quantity),
    isActive: true,
  });
}

export async function listPackages(game) {
  return ProductPackage.find({ game }).sort({ isActive: -1, price: 1, quantity: 1 });
}

export async function createPackage({ game, quantity, price, gwPid }) {
  return ProductPackage.create({
    game,
    quantity: String(quantity),
    price: Number(price),
    gwPid,
    isActive: true,
  });
}

export async function updatePackage(packageId, updates) {
  return ProductPackage.findByIdAndUpdate(packageId, updates, {
    new: true,
    runValidators: true,
  });
}

export async function deletePackage(packageId) {
  return ProductPackage.findByIdAndDelete(packageId);
}
