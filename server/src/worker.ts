import { createEmailWorker } from "./workers/email.worker";
import { prisma } from "./lib/prisma";
import { redisConnection } from "./lib/redis";
import logger from "./lib/logger";

const emailWorker = createEmailWorker();

logger.info("Email worker started");

/**
 * Graceful shutdown — quan trong o worker hon ca o API.
 *
 * `worker.close()` doi job DANG chay xu ly xong roi moi dong. Neu process.exit()
 * ngay, job dang gui bi bo giua chung: BullMQ khong nhan duoc ket qua nen sau
 * `lockDuration` se coi la stalled va giao lai cho worker khac → email gui 2 lan.
 *
 * Cham 1 giay luc deploy, doi lai khong gui trung. Dang gia.
 */
async function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down...");

  try {
    await emailWorker.close();

    await prisma.$disconnect();
    await redisConnection.quit();

    process.exit(0);
  } catch (err) {
    logger.error({ err }, "lỗi khi shutdown worker");

    process.exit(1);
  }
}

// Chot cung: job treo qua lau thi van phai chet, khong de container ket mai.
process.on("SIGTERM", () => {
  setTimeout(() => process.exit(1), 15000).unref();

  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  setTimeout(() => process.exit(1), 15000).unref();

  void shutdown("SIGINT");
});
