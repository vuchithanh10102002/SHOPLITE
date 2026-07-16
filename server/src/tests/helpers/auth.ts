import type { Mock } from "vitest";
import type { Response } from "supertest";
import { api } from "./request";
import { emailQueue } from "../../lib/queue";
import { prisma } from "../../lib/prisma";

export const REFRESH_COOKIE = "refreshToken";

let seq = 0;

/** Email duy nhat trong moi test — tranh dinh unique constraint khi mot test tao nhieu user. */
export function uniqueEmail() {
  return `user${++seq}.${process.pid}@test.local`;
}

export const DEFAULT_PASSWORD = "password123";

/**
 * Doc job da day vao emailQueue (da bi mock o setup.ts).
 * Token verify/reset chi ton tai o day — DB chi luu hash.
 */
export function emailJobs(): { name: string; data: Record<string, any> }[] {
  return (emailQueue.add as Mock).mock.calls.map(([name, data]) => ({ name, data }));
}

export function lastEmailToken(jobName: string): string {
  const job = [...emailJobs()].reverse().find((j) => j.name === jobName);

  if (!job?.data?.token) {
    throw new Error(
      `Không tìm thấy job "${jobName}" trong emailQueue. Các job đã gửi: ${emailJobs()
        .map((j) => j.name)
        .join(", ") || "(không có)"}`
    );
  }

  return job.data.token;
}

/**
 * Lay refresh cookie tu response de gui lai o request sau.
 * Tra ve nguyen chuoi "refreshToken=xxx; Path=/api/auth; HttpOnly" — supertest
 * chi can phan truoc dau ";" nhung gui ca chuoi cung khong sao.
 */
export function getRefreshCookie(res: Response): string | undefined {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;

  return raw?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
}

/** Gia tri cookie sau khi clearCookie la rong → dung de assert "cookie da bi xoa". */
export function getRefreshCookieValue(res: Response): string | undefined {
  const cookie = getRefreshCookie(res);

  return cookie?.split(";")[0].split("=")[1];
}

export async function register(email = uniqueEmail(), password = DEFAULT_PASSWORD) {
  const res = await api
    .post("/api/auth/register")
    .send({ fullName: "Test User", email, password });

  return { res, email, password, verifyToken: lastEmailToken("verify-email") };
}

/** register + verify-email → user san sang login va da verified. */
export async function createVerifiedUser(
  email = uniqueEmail(),
  password = DEFAULT_PASSWORD
) {
  const { verifyToken } = await register(email, password);

  await api.post("/api/auth/verify-email").send({ token: verifyToken }).expect(200);

  return { email, password };
}

export async function login(email: string, password = DEFAULT_PASSWORD) {
  const res = await api.post("/api/auth/login").send({ email, password });

  return {
    res,
    accessToken: res.body.data?.accessToken as string,
    refreshCookie: getRefreshCookie(res),
  };
}

/** Duong tat: tao user da verify + login, tra ve token va cookie san dung. */
export async function createLoggedInUser() {
  const { email, password } = await createVerifiedUser();
  const { accessToken, refreshCookie } = await login(email, password);

  return { email, password, accessToken, refreshCookie: refreshCookie! };
}

/**
 * Nhu createLoggedInUser nhung role ADMIN.
 *
 * Phai UPDATE role TRUOC khi login: role duoc nhet vao access token luc ky
 * (auth.service), doi role sau khi login thi token cu van mang role CUSTOMER.
 */
export async function createLoggedInAdmin() {
  const { email, password } = await createVerifiedUser();

  await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });

  const { accessToken, refreshCookie } = await login(email, password);

  return { email, password, accessToken, refreshCookie: refreshCookie! };
}

export function refreshWith(cookie: string) {
  return api.post("/api/auth/refresh").set("Cookie", cookie);
}
