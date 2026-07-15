import { execSync } from "node:child_process";
import dotenv from "dotenv";

/**
 * Chay MOT LAN truoc ca suite: dam bao DB test co schema moi nhat.
 * De o day thay vi bat nguoi chay phai nho `prisma migrate deploy` bang tay —
 * buoc nao phai nho thi som muon cung co nguoi quen.
 */
export default function setup() {
  const testEnv = dotenv.config({ path: ".env.test" }).parsed ?? {};

  if (!testEnv.DATABASE_URL) {
    throw new Error(".env.test thiếu DATABASE_URL");
  }

  console.log("[test] chạy prisma migrate deploy trên DB test...");

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, ...testEnv },
    stdio: "inherit",
  });
}
