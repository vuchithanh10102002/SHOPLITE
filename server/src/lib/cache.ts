import { redisConnection } from "./redis";
import logger from "./logger";

export interface CacheResult<T> {
  value: T;
  /** true = lay tu Redis, false = phai xuong DB. Dung de log cache_hit. */
  hit: boolean;
}

/**
 * Cache-aside: co trong Redis thi tra luon; khong thi goi loader roi ghi lai.
 *
 * FAIL-OPEN, giong rate-limit: Redis chet (hoac JSON trong cache hong) → log
 * warning va di thang DB. Mat cache thi app cham di chu khong duoc chet theo.
 *
 * `ttlSeconds` BAT BUOC, co tinh khong cho default: TTL la luoi an toan cuoi khi
 * invalidation co bug. Quen TTL = cache ban vinh vien, chi lo ra sau nhieu ngay.
 */
export async function remember<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<CacheResult<T>> {
  try {
    const cached = await redisConnection.get(key);

    // `!== null` chu khong phai truthy-check: "[]" va "0" deu la gia tri cache hop le.
    if (cached !== null) return { value: JSON.parse(cached) as T, hit: true };
  } catch (err) {
    logger.warn({ err, key }, "cache: doc Redis loi, doc thang DB");
  }

  const value = await loader();

  try {
    await redisConnection.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn({ err, key }, "cache: ghi Redis loi, bo qua");
  }

  return { value, hit: false };
}

/**
 * Xoa key sau khi ghi DB thanh cong. XOA chu khong UPDATE: update song song voi DB
 * la mo cua cho race ghi de du lieu cu len du lieu moi (handbook 8.3).
 *
 * Dung cho key IT bien the (vd `categories:tree`). Key co vo so bien the query param
 * thi dung version key, dung SCAN + DEL (handbook 8.2).
 *
 * Xoa that bai khong nem loi: DB da ghi xong, hong cache chi lam du lieu cu them toi
 * da mot nhip TTL — khong dang de request cua nguoi dung fail theo.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  try {
    await redisConnection.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, "cache: xoa key loi — TTL se tu don");
  }
}

/**
 * Doc version hien tai cua mot namespace de ghep vao key:
 * `products:list:<ver>:<params>` (handbook 8.2).
 *
 * FAIL-OPEN nhu remember: Redis chet, hoac chua ai incr bao gio → "0". An toan vi
 * write tiep theo `incr` len 1, cac key version-0 thanh mo coi va het TTL tu chet.
 */
export async function getVersion(key: string): Promise<string> {
  try {
    return (await redisConnection.get(key)) ?? "0";
  } catch (err) {
    logger.warn({ err, key }, "cache: doc version loi, dung '0'");
    return "0";
  }
}

/**
 * Tang version sau khi ghi DB thanh cong → moi key mang version cu thanh mo coi,
 * TTL tu don (handbook 8.2). Khong xoa gi, khong SCAN, khong race.
 *
 * incr tren key chua ton tai cho "1", khop voi getVersion tra "0" cho key chua co →
 * lan write dau tien van day version len that. Fail thi nuot nhu cacheDel.
 */
export async function bumpVersion(key: string): Promise<void> {
  try {
    await redisConnection.incr(key);
  } catch (err) {
    logger.warn({ err, key }, "cache: incr version loi — cache cu se het TTL tu don");
  }
}
