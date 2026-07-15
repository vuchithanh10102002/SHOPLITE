import { Request, Response, NextFunction } from "express";
import { redisConnection } from "../lib/redis";
import { Errors } from "../shared/errors";
import logger from "../lib/logger";

interface RateLimitOptions {
  /** Tach counter theo tung route — dung chung prefix = dung chung han muc. */
  prefix: string;
  limit: number;
  /** Do dai cua so, tinh bang giay. */
  window: number;
}

/**
 * Fixed window counter tren Redis (INCR + EXPIRE).
 *
 * Nhuoc diem da biet cua fixed window: burst o ranh gioi cua so — 5 request cuoi
 * window N + 5 request dau window N+1 = 10 request trong ~1 giay. Chap nhan duoc
 * cho muc dich chong brute force; muon chat hon thi doi sang sliding window log.
 */
export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // req.ip chi dung khi app.set("trust proxy") duoc bat — sau Nginx, neu khong
    // bat thi MOI request deu mang IP cua proxy → ca he thong dung chung 1 counter.
    const identifier = req.user?.id ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `rl:${options.prefix}:${identifier}`;

    let count: number;
    let ttl: number;

    try {
      // MULTI de INCR + EXPIRE + TTL la mot thao tac nguyen tu.
      // Ban cu goi incr roi moi expire: neu process chet giua 2 lenh, key khong bao
      // gio co TTL → counter ket vinh vien → user bi khoa mai mai.
      // EXPIRE ... NX: chi dat TTL khi key chua co, khong gia han cua so moi request.
      const result = await redisConnection
        .multi()
        .incr(key)
        .expire(key, options.window, "NX")
        .ttl(key)
        .exec();

      if (!result) throw new Error("redis multi returned null");

      count = result[0][1] as number;
      ttl = result[2][1] as number;
    } catch (err) {
      // FAIL-OPEN: Redis chet thi app cham di chu khong duoc chet theo.
      // Rate limit la lop bao ve, khong phai nguon chan ly — mat no khong lam
      // hong du lieu. (Neu sau nay can chong brute force tuyet doi thi doi fail-closed.)
      logger.warn({ err, key }, "rate limit: redis loi, cho request di qua");

      return next();
    }

    res.setHeader("RateLimit-Limit", options.limit);
    res.setHeader("RateLimit-Remaining", Math.max(0, options.limit - count));

    if (count > options.limit) {
      // ttl co the la -1 (key khong co TTL) hoac -2 (key vua het han giua chung)
      // → khong bao gio gui Retry-After am cho client.
      const retryAfter = ttl > 0 ? ttl : options.window;

      res.setHeader("Retry-After", retryAfter);

      // Di qua errorHandler thay vi tu res.json → format loi dong nhat toan he thong.
      return next(Errors.tooManyRequests(retryAfter));
    }

    next();
  };
}
