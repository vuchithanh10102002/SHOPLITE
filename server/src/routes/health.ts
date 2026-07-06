import { Router } from "express";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";


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
    await redis.ping();

    res.json({
      ok: true,
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
    });
  }
});

export default router;