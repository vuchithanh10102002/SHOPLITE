import { Queue, Worker, Job } from "bullmq";
import { redisConnection } from "../../lib/redis";
import logger from "../../lib/logger";
import { orderService } from "./order.service";

export const ORDER_MAINTENANCE_QUEUE = "order-maintenance";
export const CANCEL_STALE_ORDERS_JOB = "cancel-stale-orders";

const SWEEP_EVERY_MS = 10 * 60_000; // chay moi 10 phut (Handbook muc 4.5)
const STALE_AFTER_MINUTES = 15; // don PENDING lau hon 15' coi la treo

export const orderMaintenanceQueue = new Queue(ORDER_MAINTENANCE_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    // Job dinh ky, khong can giu lich su lau. Fail thi lan chay sau (10' nua) lam lai.
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Dang ky lich quet don treo. upsertJobScheduler IDEMPOTENT theo scheduler id —
 * goi lai moi lan worker khoi dong KHONG tao lich trung (khac queue.add repeat cu).
 * Chi mot lich duy nhat du chay nhieu instance worker.
 */
export async function scheduleStaleOrderSweep(): Promise<void> {
  await orderMaintenanceQueue.upsertJobScheduler(
    "stale-order-sweep",
    { every: SWEEP_EVERY_MS },
    { name: CANCEL_STALE_ORDERS_JOB },
  );
}

/**
 * Xu ly job — tach khoi new Worker(...) de test goi thang duoc, khong can Redis
 * (giong processEmailJob). Nem loi → BullMQ retry; nhung sweep la idempotent nen
 * lan chay sau (dinh ky) cung don not don con sot.
 */
export async function processMaintenanceJob(job: Job): Promise<void> {
  if (job.name !== CANCEL_STALE_ORDERS_JOB) return;

  const cancelled = await orderService.cancelStalePendingOrders(STALE_AFTER_MINUTES);
  if (cancelled > 0) logger.info({ cancelled }, "đã hủy đơn PENDING quá hạn + hoàn kho");
}

export function createOrderMaintenanceWorker(): Worker {
  const worker = new Worker(ORDER_MAINTENANCE_QUEUE, processMaintenanceJob, {
    connection: redisConnection,
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err: err.message }, "job quét đơn treo fail");
  });
  worker.on("error", (err) => {
    logger.error({ err }, "order-maintenance worker lỗi");
  });

  return worker;
}
