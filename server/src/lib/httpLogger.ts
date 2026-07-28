import pinoHttp from "pino-http";
import type { Response } from "express";
import logger from "./logger";

export const httpLogger = pinoHttp({
  logger,

  redact: [
    "req.body.password",
    "req.body.token",
    "req.headers.authorization",

    // Set-Cookie (va Cookie ben request) chua refresh token PLAINTEXT: khong redact
    // thi ai doc duoc log la chiem duoc phien.
    'res.headers["set-cookie"]',
    "req.headers.cookie",
  ],

  /**
   * Gan cache_hit vao CHINH dong log ket thuc request thay vi mot dong rieng → mot
   * dong co du route + status + thoi gian + hit/miss, doc hit rate bang mot cau query
   * log (handbook 8.3). Route khong cache thi khong co field nay.
   */
  customProps: (_req, res) => {
    const cacheHit = (res as unknown as Response).locals?.cacheHit;

    return cacheHit === undefined ? {} : { cache_hit: cacheHit };
  },
});
