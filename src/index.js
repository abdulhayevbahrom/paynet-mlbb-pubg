import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import router from "./routes/index.js";
import connectDB from "./config/db.js";
import { env } from "./config/env.js";
import { initAdminBot } from "./bot/adminBot.js";
import { appErrorHandler, jsonParseErrorHandler } from "./middlewares/error.middleware.js";

const app = express();

await connectDB();
initAdminBot();

app.use(express.json());
app.use(jsonParseErrorHandler);
app.use(cors());
app.use(helmet());

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "ulugbek-payent",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

app.use("/api", router);

app.use((req, res) => {
  res.status(404).json({
    status: "FAILED",
    message: "Route not found",
  });
});

app.use(appErrorHandler);

app.listen(env.port, () => {
  console.log(`Server running: http://localhost:${env.port}`);
});
