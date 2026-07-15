/**
 * "DLQ viewer" cua du an — xem cac job email da fail het 3 luot.
 *
 *   npm run queue:failed          # liet ke
 *   npm run queue:failed -- retry # day tat ca ve lai queue de thu lai
 *
 * Day la ban thu cong cua Bull Board. Muc dich khong phai tien nghi, ma la de
 * thay ro: job fail KHONG bien mat — no nam lai cho nguoi that quyet dinh xu ly.
 */
import { emailQueue } from "../lib/queue";
import { redisConnection } from "../lib/redis";

async function main() {
  const shouldRetry = process.argv.includes("retry");

  const failed = await emailQueue.getFailed();

  if (failed.length === 0) {
    console.log("✅ Không có job nào trong failed set.");

    return;
  }

  console.log(`❌ ${failed.length} job fail:\n`);

  for (const job of failed) {
    // Khong in job.data nguyen ven: payload verify/reset chua TOKEN con song,
    // in ra terminal (roi lot vao log CI) la lo token that.
    const { token, ...safeData } = job.data as Record<string, unknown>;

    console.log(`- [${job.name}] id=${job.id} attempts=${job.attemptsMade}`);
    console.log(`  data: ${JSON.stringify(safeData)}${token ? " (+token đã ẩn)" : ""}`);
    console.log(`  lỗi:  ${job.failedReason}`);
    console.log("");
  }

  if (shouldRetry) {
    for (const job of failed) {
      await job.retry();
    }

    console.log(`♻️  Đã đẩy ${failed.length} job về lại queue.`);
  } else {
    console.log("Chạy `npm run queue:failed -- retry` để thử lại toàn bộ.");
  }
}

main()
  .catch((err) => {
    console.error(err);

    process.exitCode = 1;
  })
  .finally(async () => {
    await emailQueue.close();
    await redisConnection.quit();
  });
