import app from "./app";
import { env } from "./config/env";
import logger from "./lib/logger";

export function bootstrap() {
  return app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });
}