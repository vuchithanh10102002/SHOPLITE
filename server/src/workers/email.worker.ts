import { Job, Worker, UnrecoverableError } from "bullmq";
import { redisConnection } from "../lib/redis";
import { EMAIL_QUEUE_NAME } from "../lib/queue";
import { sendMail } from "../lib/mailer";
import { prisma } from "../lib/prisma";
import logger from "../lib/logger";
import {
  emailJobSchemas,
  isEmailJobName,
  type EmailJobData,
  type EmailJobName,
} from "../modules/emails/email.types";
import {
  orderStatusTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "../modules/emails/email.templates";

/**
 * Xu ly mot job email.
 *
 * Tach ra khoi `new Worker(...)` de test goi thang duoc — khong can dung Redis
 * that chi de kiem tra "job verify-email co render dung template khong".
 *
 * Giao keo voi BullMQ:
 * - NEM loi  → BullMQ retry theo attempts/backoff.
 * - Nem `UnrecoverableError` → BullMQ KHONG retry, day thang vao failed set.
 * - Return binh thuong → job xong.
 */
export async function processEmailJob(job: Job<EmailJobData, void, string>) {
  // requestId di theo payload → mot request_id grep ra duoc ca log cua API lan worker.
  const log = logger.child({
    jobId: job.id,
    jobName: job.name,
    attempt: job.attemptsMade + 1,
    requestId: (job.data as { requestId?: string }).requestId,
  });

  if (!isEmailJobName(job.name)) {
    // Job la vao queue (deploy lech phien ban, ai do add nham ten). Retry 3 lan
    // cung khong lam ten job dung ra duoc → hong phi 3 lan cho.
    throw new UnrecoverableError(`Job type không hỗ trợ: ${job.name}`);
  }

  const name: EmailJobName = job.name;

  // Payload doc tu Redis = du lieu ngoai, validate y het request HTTP.
  const parsed = emailJobSchemas[name].safeParse(job.data);

  if (!parsed.success) {
    // Payload sai thi thu lai bao nhieu lan cung sai — khong retry.
    throw new UnrecoverableError(
      `Payload không hợp lệ cho job ${name}: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join(", ")}`
    );
  }

  switch (name) {
    case "verify-email": {
      const data = parsed.data as { email: string; fullName: string; token: string };

      await sendMail(data.email, verifyEmailTemplate(data.fullName, data.token));

      break;
    }

    case "reset-password": {
      const data = parsed.data as { email: string; fullName: string; token: string };

      await sendMail(data.email, resetPasswordTemplate(data.fullName, data.token));

      break;
    }

    case "order-status": {
      const data = parsed.data as { orderId: string };

      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: { user: true, items: true },
      });

      if (!order) {
        // Don khong ton tai → retry 3 lan cung khong lam no hien ra.
        throw new UnrecoverableError(`Không tìm thấy order ${data.orderId}`);
      }

      await sendMail(
        order.user.email,
        orderStatusTemplate({
          id: order.id,
          status: order.status,
          // Decimal → string, khong qua number: giu nguyen do chinh xac tien te.
          totalAmount: order.totalAmount.toString(),
          fullName: order.user.fullName,
          items: order.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
          })),
        })
      );

      break;
    }
  }

  log.info("job email xử lý xong");
}

export function createEmailWorker() {
  const worker = new Worker<EmailJobData, void, string>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: redisConnection,

      // Gui song song 5 email. SMTP provider nao cung co gioi han ket noi —
      // tha 100 job cung luc la tu chuoc 421 "too many connections".
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    const attempts = job?.opts.attempts ?? 0;
    const made = job?.attemptsMade ?? 0;

    // Het luot retry → job nam lai trong failed set (DLQ). Log o muc error de
    // canh bao; con retry giua chung chi la warn, chua mat gi.
    const exhausted = made >= attempts;

    logger[exhausted ? "error" : "warn"](
      {
        jobId: job?.id,
        jobName: job?.name,
        attempt: made,
        attempts,
        requestId: (job?.data as { requestId?: string } | undefined)?.requestId,
        err: err.message,
      },
      exhausted
        ? "job email FAIL hẳn — nằm lại failed set, xem bằng `npm run queue:failed`"
        : "job email fail, sẽ retry"
    );
  });

  worker.on("error", (err) => {
    // Loi cua BAN THAN worker (mat Redis...), khong gan voi job nao.
    logger.error({ err }, "email worker lỗi");
  });

  return worker;
}
