import { Router } from "express";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";

import { emailQueue } from "../lib/queue";


const router = Router();

router.get("/", (_, res) => {
  res.json({
    ok: true,
  });
});

router.get("/ready", async (_, res) => {
  try {
    // PostgreSQL
    await prisma.$queryRaw`SELECT 1`;

    // Redis
    await redisConnection.ping();

    res.json({
      ok: true,
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
    });
  }
});

router.get("/test", async (_, res) => {
  try {
    await emailQueue.add("send-email", {
      email: "abc@gmail.com",
      name: "Thanh",
    });

    res.json({
      message: "Queue Added",
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
    });
  }
});

export default router;