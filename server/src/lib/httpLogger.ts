import pinoHttp from "pino-http";
import type { Response } from "express";
import logger from "./logger";

export const httpLogger = pinoHttp({
  logger,

  redact: [
    "req.body.password",
    "req.body.token",
    "req.headers.authorization",

    // Set-Cookie chua refresh token o dang PLAINTEXT. Khong redact thi moi lan
    // login/refresh la mot refresh token con song nam trong log — ai doc duoc log
    // la chiem duoc phien. Cookie header (request) cung vay.
    'res.headers["set-cookie"]',
    "req.headers.cookie",
  ],

  /**
   * Gan cache_hit vao chinh dong log ket thuc request (thay vi mot dong log rieng)
   * → mot dong co du route + status + thoi gian + hit/miss, doc hit rate that bang
   * mot cau query log (handbook 8.3).
   *
   * Controller nao set res.locals.cacheHit thi dong log cua no co field nay; route
   * khong cache thi khong co — khong lam ban log cua ca he thong.
   */
  customProps: (_req, res) => {
    const cacheHit = (res as unknown as Response).locals?.cacheHit;

    return cacheHit === undefined ? {} : { cache_hit: cacheHit };
  },
});
