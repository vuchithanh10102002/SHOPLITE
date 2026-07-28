import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser, refreshWith } from "../helpers/auth";
import { prisma } from "../../lib/prisma";

/**
 * GET /api/admin/users + PATCH /api/admin/users/:id/status.
 *
 * Seed user THANG QUA PRISMA chu khong qua /register: rate limit 5 request/60s tren
 * MOT IP, ma supertest di chung mot IP → user thu 6 an 429 va test do vi ly do
 * khong lien quan. Bo luon bcrypt cho nhanh.
 */

const AUTH = (t: string) => ({ Authorization: `Bearer ${t}` });

let seq = 0;

function seedUser(over: Partial<{ email: string; fullName: string; role: "CUSTOMER" | "ADMIN"; isActive: boolean }> = {}) {
  seq += 1;
  return prisma.user.create({
    data: {
      email: over.email ?? `seed${seq}.${process.pid}@test.local`,
      passwordHash: "x", // khong dung: cac test nay khong dang nhap bang tai khoan seed
      fullName: over.fullName ?? `Người dùng ${seq}`,
      role: over.role ?? "CUSTOMER",
      isActive: over.isActive ?? true,
      emailVerified: true,
    },
  });
}

describe("Admin users (Phase 6 bước 4)", () => {
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    ({ accessToken: userToken } = await createLoggedInUser());
  });

  // ── Quyen ─────────────────────────────────────────────────────────────────

  it("chưa đăng nhập → 401; khách thường → 403", async () => {
    await api.get("/api/admin/users").expect(401);
    await api.get("/api/admin/users").set(AUTH(userToken)).expect(403);
    // Ca route ghi cung phai dong: guard dat o router.use nen mot dong che ca cum.
    const target = await seedUser();
    await api
      .patch(`/api/admin/users/${target.id}/status`)
      .set(AUTH(userToken))
      .send({ isActive: false })
      .expect(403);
  });

  // ── GET /api/admin/users ──────────────────────────────────────────────────

  it("KHÔNG lộ passwordHash, có orderCount", async () => {
    const res = await api.get("/api/admin/users").set(AUTH(adminToken)).expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    for (const u of res.body.data) {
      expect(u).not.toHaveProperty("passwordHash");
      expect(u).toHaveProperty("orderCount");
      expect(u).toHaveProperty("isActive");
    }
  });

  it("orderCount đếm đúng số đơn của người đó", async () => {
    const buyer = await seedUser();
    await prisma.order.createMany({
      data: [1, 2].map((n) => ({
        userId: buyer.id,
        totalAmount: "1000",
        idempotencyKey: `k${n}`,
        shippingAddress: "123 Đường Test",
      })),
    });

    const res = await api
      .get("/api/admin/users")
      .query({ q: buyer.email })
      .set(AUTH(adminToken))
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].orderCount).toBe(2);
  });

  it("lọc theo role", async () => {
    await seedUser({ role: "ADMIN" });

    const res = await api
      .get("/api/admin/users")
      .query({ role: "ADMIN" })
      .set(AUTH(adminToken))
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(2); // admin dang goi + admin vua seed
    expect(res.body.data.every((u: { role: string }) => u.role === "ADMIN")).toBe(true);
  });

  it("?isActive=false CHỈ trả tài khoản đã khóa — không dính bẫy Boolean('false')", async () => {
    const locked = await seedUser({ isActive: false });

    const off = await api
      .get("/api/admin/users")
      .query({ isActive: "false" })
      .set(AUTH(adminToken))
      .expect(200);
    expect(off.body.data.map((u: { id: string }) => u.id)).toEqual([locked.id]);

    // Chieu nguoc lai phai KHAC han — neu "false" bi coi la true thi hai lan goi
    // nay tra ve y het nhau va test tren van xanh.
    const on = await api
      .get("/api/admin/users")
      .query({ isActive: "true" })
      .set(AUTH(adminToken))
      .expect(200);
    expect(on.body.data.map((u: { id: string }) => u.id)).not.toContain(locked.id);
  });

  it("tìm q khớp email HOẶC họ tên, không phân biệt hoa thường", async () => {
    const target = await seedUser({ fullName: "Nguyen Van Cuong" });

    const byName = await api
      .get("/api/admin/users")
      .query({ q: "nguyen van" })
      .set(AUTH(adminToken))
      .expect(200);
    expect(byName.body.data.map((u: { id: string }) => u.id)).toContain(target.id);

    const byEmail = await api
      .get("/api/admin/users")
      .query({ q: target.email.toUpperCase() })
      .set(AUTH(adminToken))
      .expect(200);
    expect(byEmail.body.data.map((u: { id: string }) => u.id)).toEqual([target.id]);
  });

  it("phân trang: meta khớp và trang 2 không lặp dòng của trang 1", async () => {
    for (let i = 0; i < 5; i++) await seedUser();

    const p1 = await api
      .get("/api/admin/users")
      .query({ page: 1, limit: 3 })
      .set(AUTH(adminToken))
      .expect(200);
    const p2 = await api
      .get("/api/admin/users")
      .query({ page: 2, limit: 3 })
      .set(AUTH(adminToken))
      .expect(200);

    expect(p1.body.meta).toMatchObject({ page: 1, limit: 3 });
    expect(p1.body.data).toHaveLength(3);
    expect(p1.body.meta.total).toBe(7); // 5 seed + admin + user cua beforeEach

    const ids1 = p1.body.data.map((u: { id: string }) => u.id);
    const ids2 = p2.body.data.map((u: { id: string }) => u.id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
  });

  // ── PATCH /api/admin/users/:id/status ─────────────────────────────────────

  it("khóa tài khoản → isActive=false và REVOKE hết refresh token của người đó", async () => {
    // Can mot user THAT co refresh cookie dang song de chung minh no bi cat.
    const { email, accessToken, refreshCookie } = await createLoggedInUser();
    const me = await api.get("/api/orders").set(AUTH(accessToken)).expect(200);
    expect(me.body.success).toBe(true);

    // Loc theo dung user nay: admin cua beforeEach cung co refresh token song,
    // `findFirst` khong dieu kien se boc nham cua admin roi vuong CANNOT_LOCK_ADMIN.
    const target = await prisma.user.findUniqueOrThrow({ where: { email } });
    const row = { userId: target.id };

    const res = await api
      .patch(`/api/admin/users/${row.userId}/status`)
      .set(AUTH(adminToken))
      .send({ isActive: false })
      .expect(200);

    expect(res.body.data).toMatchObject({ id: row.userId, isActive: false });
    // Phien cu khong gia han duoc nua → het 15 phut cua access token la ra han.
    await refreshWith(refreshCookie).expect(401);
    expect(await prisma.refreshToken.count({ where: { userId: row.userId, revoked: false } })).toBe(0);
  });

  it("mở lại tài khoản → isActive=true; bấm hai lần cùng giá trị vẫn 200 (idempotent)", async () => {
    const target = await seedUser({ isActive: false });

    const a = await api
      .patch(`/api/admin/users/${target.id}/status`)
      .set(AUTH(adminToken))
      .send({ isActive: true })
      .expect(200);
    expect(a.body.data.isActive).toBe(true);

    const b = await api
      .patch(`/api/admin/users/${target.id}/status`)
      .set(AUTH(adminToken))
      .send({ isActive: true })
      .expect(200);
    expect(b.body.data.isActive).toBe(true);
  });

  it("KHÔNG khóa được tài khoản ADMIN → 409 CANNOT_LOCK_ADMIN", async () => {
    const otherAdmin = await seedUser({ role: "ADMIN" });

    const res = await api
      .patch(`/api/admin/users/${otherAdmin.id}/status`)
      .set(AUTH(adminToken))
      .send({ isActive: false })
      .expect(409);

    expect(res.body.error.code).toBe("CANNOT_LOCK_ADMIN");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: otherAdmin.id } })).isActive).toBe(true);
  });

  it("id không tồn tại → 404; id không phải uuid → 400; thiếu isActive → 400", async () => {
    // uuid v4 THAT (randomUUID) chu khong phai chuoi "111...": z.uuid() cua zod 4
    // kiem ca bit phien ban/bien the → uuid tu bia rot o tang validate (400) va
    // khong bao gio cham toi nhanh 404 dinh test.
    await api
      .patch(`/api/admin/users/${randomUUID()}/status`)
      .set(AUTH(adminToken))
      .send({ isActive: false })
      .expect(404);

    await api
      .patch("/api/admin/users/khong-phai-uuid/status")
      .set(AUTH(adminToken))
      .send({ isActive: false })
      .expect(400);

    const target = await seedUser();
    await api
      .patch(`/api/admin/users/${target.id}/status`)
      .set(AUTH(adminToken))
      .send({})
      .expect(400);
  });

  it("gửi kèm role lên endpoint status KHÔNG nâng được quyền", async () => {
    const target = await seedUser();

    // zod object mac dinh STRIP field la (khong phai reject) va validate() gan
    // `req.body = result.data` → `role` bi cat truoc khi cham service. Endpoint
    // van 200, nhung role khong doi. Day la ly do phai co endpoint hep
    // (/status) thay vi PATCH /:id nhan bat ky field nao.
    await api
      .patch(`/api/admin/users/${target.id}/status`)
      .set(AUTH(adminToken))
      .send({ isActive: true, role: "ADMIN" })
      .expect(200);

    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe("CUSTOMER");
  });
});
