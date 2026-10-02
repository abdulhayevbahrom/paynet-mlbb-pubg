import express from "express";
import paynetRouter from "../modules/paynet/paynet.router.js";

const router = express.Router();

router.use("/paynet", paynetRouter);

export default router;
