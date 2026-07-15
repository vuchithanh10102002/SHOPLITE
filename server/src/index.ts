import app from "./app";
import { bootstrap } from "./bootstrap";
import { env } from "./config/env";
import logger from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redisConnection } from "./lib/redis";

const server = bootstrap();

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down...");

  server.close(async () => {
    await prisma.$disconnect();
    await redisConnection.quit();

    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));