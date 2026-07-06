import { createClient } from "redis";
import logger from "./logger";

export const redis = createClient({
  url: process.env.REDIS_URL,
});

redis.on("ready", () => {
  logger.info("Redis connected");
});

redis.on("error", (err) => {
  logger.error({ err }, "Redis error");
});