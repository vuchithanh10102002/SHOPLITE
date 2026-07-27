import type Redis from "ioredis";

/**
 * Nhip tim cua worker — nguon su that CHUNG cho ca ben ghi (worker.ts) lan ben
 * doc (worker-healthcheck.ts). De hai ben tu khai hang so rieng la kieu loi im
 * lang dien hinh: doi TTL mot ben, ben kia van tuong minh dang do dung thu.
 *
 * VI SAO CAN: worker khong mo port nao nen khong the tham do bang HTTP. Truoc
 * day compose de `healthcheck: disable: true`, va `docker compose up -d --wait`
 * cua ban moi TU CHOI ca stack voi loi:
 *
 *   container shoplite-worker-prod has no healthcheck configured
 *
 * Nhip tim vao Redis do dung thu can biet: worker CON SONG va CON NOI DUOC
 * Redis — ma noi duoc Redis chinh la toan bo cong viec cua no (BullMQ).
 * Mot phep kiem kieu "tien trinh PID 1 con chay khong" thi gan nhu luon dung,
 * tuc la khong noi len dieu gi.
 */
export const HEARTBEAT_KEY = "worker:heartbeat";

/** Ghi lai moi 15s — bang interval healthcheck trong compose. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * TTL 45s = 3 nhip. Key TU HET HAN khi worker chet, nen healthcheck khong can
 * tin vao dong ho: khong thay key nghia la 3 nhip lien khong ai ghi.
 *
 * Van kiem them tuoi cua gia tri (duoi) vi TTL chi bat "khong ai ghi nua", con
 * mot worker treo giua chung co the da ghi key roi moi treo — luc do key con
 * song nhung noi dung da cu.
 */
export const HEARTBEAT_TTL_SECONDS = 45;
export const HEARTBEAT_MAX_AGE_MS = 45_000;

/**
 * Bat dau ghi nhip. Ghi NGAY mot phat dau tien roi moi lap lai — khong thi
 * healthcheck do trong 15 giay dau se khong thay gi.
 *
 * Tra ve ham dung lai, goi trong shutdown truoc khi dong ket noi Redis.
 */
export function startHeartbeat(redis: Redis): () => void {
  const beat = () => {
    // Nuot loi co chu dich: mat Redis mot nhip khong dang de worker chet. Hau
    // qua tu lo ra dung cho no can lo ra — key cu di, healthcheck chuyen do.
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
