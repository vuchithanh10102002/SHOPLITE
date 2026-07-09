import { Worker } from "bullmq";
import { redisConnection } from "./lib/redis";
import { sendVerifyEmail } from "./lib/mailer";
import logger from "./lib/logger";

new Worker(
  "email",
  async (job) => {
    logger.info(`Processing job: ${job.name}`);

    switch (job.name) {
      case "verify-email":
        await sendVerifyEmail(
          job.data.email,
          job.data.fullName,
          job.data.token
        );
        break;

      default:
        logger.warn(`Unknown job: ${job.name}`);
    }
  },
  {
    connection: redisConnection,
  }
);

logger.info("✅ Email Worker started");