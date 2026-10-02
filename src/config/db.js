import mongoose from "mongoose";
import { env } from "./env.js";

export default async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}
