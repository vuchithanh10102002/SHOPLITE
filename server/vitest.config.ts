import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Nap .env.test o day (truoc khi worker khoi dong) roi bom qua `test.env`.
// Neu de env.ts tu nap, no se doc .env (DB dev) — va setup.ts se xoa sach DB dev.
const testEnv = dotenv.config({ path: ".env.test" }).parsed ?? {};

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./src/tests/global-setup.ts"],
    setupFiles: ["./src/tests/setup.ts"],
    testTimeout: 30000,
    env: testEnv,
    // Cac file test dung chung 1 DB + 1 Redis, setup.ts truncate giua moi test
    // → chay song song se dam nhau. Bat lai khi nao moi file co schema rieng.
    fileParallelism: false,
  },
});
