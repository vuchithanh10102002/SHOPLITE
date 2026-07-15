import pinoHttp from "pino-http";
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
});
