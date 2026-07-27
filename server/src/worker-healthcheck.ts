/**
 * HEALTHCHECK cua container worker. Chay boi Docker:
 *
 *   node dist/worker-healthcheck.js     → exit 0 khoe, exit 1 khong khoe
 *
 * Doc nhip tim worker ghi vao Redis (xem lib/worker-heartbeat.ts).
 *
 * BA DIEU PHAI GIU KHI SUA FILE NAY:
 *
 * 1. KHONG import `lib/redis` dung chung. Ket noi do dat `maxRetriesPerRequest:
 *    null` cho BullMQ — nghia la thu lai VO HAN. Redis chet thi healthcheck se
 *    treo cho toi khi Docker giet vi timeout, tuc la mat 5 giay de noi mot dieu
 *    dang le biet ngay. O day dung ket noi rieng, khong thu lai.
 *
 * 2. KHONG import `config/env`. File do validate TOAN BO bien moi truong; thieu
 *    mot bien khong lien quan (CLOUDINARY_URL chang han) la healthcheck do trong
 *    khi worker van chay tot — bao dong gia.
 *
 * 3. Phai TU CHET som hon timeout cua Docker (5s trong compose). Mot healthcheck
 *    treo la healthcheck vo dung.
 */
import Redis from "ioredis";
import { HEARTBEAT_KEY, isHeartbeatFresh } from "./lib/worker-heartbeat";

const HARD_TIMEOUT_MS = 4_000;
const CONNECT_TIMEOUT_MS = 3_000;

// Chot cung: dinh gi thi dinh, 4 giay la ket luan "khong khoe" va thoat.
setTimeout(() => {
  process.exit(1);
}, HARD_TIMEOUT_MS).unref();

const redis = new Redis(process.env.REDIS_URL ?? "redis://redis:6379", {
  connectTimeout: CONNECT_TIMEOUT_MS,
  // Khong thu lai: healthcheck chay 15s/lan, lan sau la co hoi tiep theo.
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
});

// Ket luan noi bang exit code. In stack trace ra day log container moi 15 giay
// ma khong them thong tin gi.
redis.on("error", () => {});

async function main(): Promise<void> {
  const raw = await redis.get(HEARTBEAT_KEY);

  if (!isHeartbeatFresh(raw, Date.now())) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch(() => process.exit(1));
