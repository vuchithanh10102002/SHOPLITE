import app from "./app";
import { env } from "./config/env";
import logger from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";

// const PORT = 3000;

// app.listen(PORT, () => {
//     console.log(`Server running on ${PORT}`);
// });

async function bootstrap() {
  await redis.connect();

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });
}

bootstrap();

const server = app.listen(env.PORT);
async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {              // 1. ngung nhan request moi, cho request dang chay
    await prisma.$disconnect();           // 2. dong DB pool
    await redis.quit();                   // 3. dong Redis
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();  // 4. timeout cung 10s
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));