import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";

new Worker(
    "email",
    async (job) => {
        console.log("Receive Job");

        console.log(job.data);
    },
    {
        connection: redisConnection,
    }
);

console.log("Email Worker Started");