import app from "./app";
import { env } from "./config/env";
import logger from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redisConnection } from "./lib/redis";

let server: ReturnType<typeof app.listen>;

async function bootstrap() {
  server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });
}

bootstrap();

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