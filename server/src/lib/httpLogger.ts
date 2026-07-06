import { randomUUID } from "crypto";
import pinoHttp from "pino-http";
import logger from "./logger";

export const httpLogger = pinoHttp({
   logger,

  redact: [
    "req.body.password",
    "req.body.token",
    "req.headers.authorization",
  ],
});