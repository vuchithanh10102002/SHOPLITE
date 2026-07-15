import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "../helpers/request";
import { redisConnection } from "../../lib/redis";
import { DEFAULT_PASSWORD, createVerifiedUser, uniqueEmail } from "../helpers/auth";

/** Ban 1 loat request tuan tu (khong Promise.all) de thu tu counter xac dinh. */
async function hammer(times: number, send: () => Promise<{ status: number }>) {
  const statuses: number[] = [];

  for (let i = 0; i < times; i++) {
    statuses.push((await send()).status);
  }

  return statuses;
}

const badLogin = () =>
  api.post("/api/auth/login").send({ email: uniqueEmail(), password: DEFAULT_PASSWORD });

describe("Rate limit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("login: 15 request → 10 lần đầu qua, từ lần 11 trả 429", async () => {
    const statuses = await hammer(15, badLogin);

    // 10 lan dau qua duoc rate limit (401 vi sai credentials, khong phai 429).
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true);

    // Tu lan 11 tro di deu bi chan.
    expect(statuses.slice(10).every((s) => s === 429)).toBe(true);
  });

  it("429 kèm Retry-After dương và body đúng format lỗi chuẩn", async () => {
    await hammer(10, badLogin);

    const res = await badLogin();

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");

    // Retry-After am (-1 / -2 tu TTL) la bug: client se retry ngay lap tuc.
    const retryAfter = Number(res.headers["retry-after"]);

    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("REGRESSION: mỗi route một hạn mức riêng — bắn hết quota register không khóa được login", async () => {
    const { email } = await createVerifiedUser();

    // Dot sach quota /register (5/phut).
    await hammer(6, () =>
      api
        .post("/api/auth/register")
        .send({ fullName: "Spam", email: uniqueEmail(), password: DEFAULT_PASSWORD })
    );

    // Login phai van vao duoc. Neu 2 route dung chung mot counter (bug cu:
    // chung prefix "auth"), request nay se an 429.
    const res = await api.post("/api/auth/login").send({ email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
  });

  it("forgot-password: hạn mức chặt hơn (3/phút)", async () => {
    const statuses = await hammer(4, () =>
      api.post("/api/auth/forgot-password").send({ email: uniqueEmail() })
    );

    expect(statuses.slice(0, 3).every((s) => s === 200)).toBe(true);
    expect(statuses[3]).toBe(429);
  });

  it("FAIL-OPEN: Redis chết thì request vẫn đi qua, không 500", async () => {
    const { email } = await createVerifiedUser();

    vi.spyOn(redisConnection, "multi").mockImplementation(() => {
      throw new Error("Redis connection lost");
    });

    const res = await api.post("/api/auth/login").send({ email, password: DEFAULT_PASSWORD });

    // Rate limit la lop bao ve, khong phai nguon chan ly — mat Redis thi app
    // cham/ho hon chu khong duoc sap.
    expect(res.status).toBe(200);
  });
});
