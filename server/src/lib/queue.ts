import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const emailQueue = new Queue("email", {
    connection: redisConnection,
});