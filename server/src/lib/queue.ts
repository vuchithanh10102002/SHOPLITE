import { Queue } from "bullmq";
import { redisConnection } from "./redis";
import type { EmailJobData, EmailJobName } from "../modules/emails/email.types";

export const EMAIL_QUEUE_NAME = "email";

export const emailQueue = new Queue<EmailJobData, void, EmailJobName>(
  EMAIL_QUEUE_NAME,
  {
    connection: redisConnection,

    // Dat o QUEUE thay vi lap lai o tung `.add()`: producer nam rai rac trong
    // auth.service, order.service... quen mot cho la job do im lang khong retry.
    defaultJobOptions: {
      // 3 lan thu, backoff luy thua tu 1s: 1s → 2s → 4s.
      // Vi sao backoff luy thua chu khong retry ngay: loi SMTP thuong la tam thoi
      // (rate limit cua provider, mang chop chop). Dam lai ngay lap tuc chi lam
      // provider chan manh hon — lui dan cho ben kia kip hoi.
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },

      // Job thanh cong: giu 1000 cai gan nhat de con soi lai, khong de phinh Redis.
      removeOnComplete: { count: 1000 },

      // Job FAIL: giu lai 5000 cai — day chinh la "DLQ" cua du an.
      // KHONG duoc de removeOnFail: true, khong thi job chet la bien mat khong dau vet,
      // dung y nghia cua failed set (FR-N1: "quá 3 lần → nằm ở failed queue để xem lại").
      removeOnFail: { count: 5000 },
    },
  }
);
