import type Redis from "ioredis";

/**
 * Nhip tim cua worker — hang so dat CHUNG cho ca ben ghi (worker.ts) lan ben doc
 * (worker-healthcheck.ts): de hai ben tu khai TTL rieng la loi im lang dien hinh.
 *
 * VI SAO CAN: worker khong mo port nen khong tham do duoc bang HTTP, ma
 * `healthcheck: disable: true` lam `docker compose up -d --wait` TU CHOI ca stack
 * ("container ... has no healthcheck configured").
 *
 * Nhip tim vao Redis do dung thu can biet: worker con song VA con noi duoc Redis —
 * ma noi duoc Redis la toan bo cong viec cua no. Phep kiem "PID 1 con chay khong"
 * thi gan nhu luon dung, tuc la khong noi len dieu gi.
 */
export const HEARTBEAT_KEY = "worker:heartbeat";

/** Ghi lai moi 15s — bang interval healthcheck trong compose. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * TTL 45s = 3 nhip: key tu het han khi worker chet, khong thay key nghia la 3 nhip
 * lien khong ai ghi. Van kiem them TUOI cua gia tri vi worker treo giua chung co
 * the da kip ghi key — key con song nhung noi dung da cu.
 */
export const HEARTBEAT_TTL_SECONDS = 45;
export const HEARTBEAT_MAX_AGE_MS = 45_000;

/**
 * Ghi NGAY mot phat dau tien roi moi lap lai — khong thi healthcheck do trong 15
 * giay dau se khong thay gi. Tra ve ham dung lai, goi trong shutdown TRUOC khi dong
 * ket noi Redis.
 */
export function startHeartbeat(redis: Redis): () => void {
  const beat = () => {
    // Nuot loi co chu dich: mat Redis mot nhip khong dang de worker chet. Hau qua tu
    // lo ra dung cho can lo ra — key cu di, healthcheck chuyen do.
    void redis
      .set(HEARTBEAT_KEY, Date.now().toString(), "EX", HEARTBEAT_TTL_SECONDS)
      .catch(() => {});
  };

  beat();

  const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);

  return () => clearInterval(timer);
}

/** `true` khi gia tri doc duoc la mot moc thoi gian con tuoi. */
export function isHeartbeatFresh(raw: string | null, now: number): boolean {
  if (raw === null) return false;

  const beatAt = Number(raw);

  if (!Number.isFinite(beatAt)) return false;

  // Khong lay tri tuyet doi: moc o TUONG LAI xa nghia la dong ho lech hoac co ai
  // ghi rac vao key, ca hai deu khong phai "worker khoe".
  const age = now - beatAt;

  return age >= -HEARTBEAT_MAX_AGE_MS && age <= HEARTBEAT_MAX_AGE_MS;
}
