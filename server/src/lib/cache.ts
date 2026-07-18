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
 * FAIL-OPEN, giong rate-limit: Redis chet → log warning va di thang DB. Cache la
 * tang "rung duoc" — mat no thi app cham di chu khong duoc chet theo (handbook 8.3).
 * Ke ca JSON trong cache bi hong cung roi vao nhanh nay: coi nhu miss, doc lai DB.
 *
 * `ttlSeconds` BAT BUOC, co tinh khong cho default: TTL la luoi an toan cuoi khi
 * invalidation co bug. Quen TTL = cache ban vinh vien, va do la loai bug chi lo ra
 * sau nhieu ngay.
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
 * Xoa key sau khi ghi DB thanh cong.
 *
 * XOA chu khong UPDATE cache: update song song voi DB la mo cua cho race ghi de
 * du lieu cu len du lieu moi (handbook 8.3).
 *
 * Dung cho key IT bien the (vd `categories:tree` — dung mot key duy nhat). Key co
 * vo so bien the query param thi dung version key, dung SCAN + DEL (handbook 8.2).
 *
 * Xoa that bai cung khong nem loi: DB da ghi xong roi, hong cache chi lam du lieu
 * cu them toi da mot nhip TTL — khong dang de request cua nguoi dung fail theo.
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
 * Doc version hien tai cua mot namespace (vd "products:ver"), de ghep vao key:
 * `products:list:<ver>:<params>`. Handbook 8.2.
 *
 * FAIL-OPEN nhu remember: Redis chet → tra "0". `null` (chua ai incr bao gio)
 * cung tra "0" — day la version khoi dau hop le, khong phai loi.
 *
 * Vi sao "0" an toan khi Redis vua song lai: moi key deu mang version dang
 * chay, write tiep theo `incr` len 1 → cac key version-0 thanh mo coi, het TTL
 * tu chet. Khong bao gio serve du lieu cu vinh vien.
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
 * Tang version sau khi ghi DB thanh cong → moi key mang version cu tro thanh
 * "mo coi", khong con duoc doc lai, TTL tu don (handbook 8.2). Khong xoa gi,
 * khong SCAN, khong race.
 *
 * Fail giong cacheDel: DB da ghi xong, incr hong chi lam du lieu cu song them
 * toi da mot nhip TTL — khong dang de request cua nguoi dung fail theo.
 *
 * incr tren key chua ton tai bat dau tu 0 → thanh "1"; khop voi getVersion tra
 * "0" cho key chua co, nen lan write dau tien van day version len that.
 */
export async function bumpVersion(key: string): Promise<void> {
  try {
    await redisConnection.incr(key);
  } catch (err) {
    logger.warn({ err, key }, "cache: incr version loi — cache cu se het TTL tu don");
  }
}
