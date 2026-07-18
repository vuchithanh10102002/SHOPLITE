import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { api } from "../helpers/request";
import {
  createLoggedInUser,
  createLoggedInAdmin,
  register,
  login,
} from "../helpers/auth";

/**
 * Khoa DAY MIDDLEWARE cua Order module: route da mount chua, chuoi middleware
 * (authenticate / requireVerified / requireRole) co chan dung thu tu khong —
 * doc lap voi logic. Cac endpoint CHUA co logic (cancel: b6, admin: b6) van nem
 * 501; test 501 o day rot dan khi tung buoc sau hien thuc hoa chung.
 *
 * Hanh vi that cua create/list/getById (da co logic tu b4) test o
 * order.integration.test.ts.
 */
describe("Order middleware & endpoint chưa có logic (Phase 4)", () => {
  it("POST /api/orders chua dang nhap → 401 UNAUTHORIZED", async () => {
    const res = await api.post("/api/orders").expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/orders khi email chua verify → 403 EMAIL_NOT_VERIFIED (BR4)", async () => {
    // register = tao user CHUA verify; BR4 cho login luc chua verify. requireVerified
    // chay TRUOC validate/controller nen chan o day, khong cham toi logic dat hang.
    const { email, password } = await register();
    const { accessToken } = await login(email, password);

    const res = await api
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("POST /api/orders/:id/cancel (chua co logic) → 501", async () => {
    const { accessToken } = await createLoggedInUser();

    const res = await api
      .post(`/api/orders/${randomUUID()}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("GET /api/admin/orders bang user thuong → 403 FORBIDDEN", async () => {
    const { accessToken } = await createLoggedInUser();

    const res = await api
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("GET /api/admin/orders bang ADMIN → qua requireRole, cham logic → 501", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const res = await api
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("PATCH /api/admin/orders/:id/status bang ADMIN (chua co logic) → 501", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const res = await api
      .patch(`/api/admin/orders/${randomUUID()}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "PAID" })
      .expect(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });
});
