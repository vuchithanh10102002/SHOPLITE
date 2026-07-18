import { describe, it, expect } from "vitest";
import { api } from "../helpers/request";
import { createLoggedInUser, register, login } from "../helpers/auth";

/**
 * Khoa DAY MIDDLEWARE cua Order module — doc lap voi logic: route da mount chua,
 * chuoi authenticate / requireVerified / requireRole co chan dung khong. Hanh vi
 * that cua tung endpoint test o order.integration / order.admin.integration.
 */
describe("Order — cổng middleware", () => {
  it("POST /api/orders chưa đăng nhập → 401 UNAUTHORIZED", async () => {
    const res = await api.post("/api/orders").expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/orders khi email chưa verify → 403 EMAIL_NOT_VERIFIED (BR4)", async () => {
    // register = user CHUA verify; BR4 cho login luc chua verify. requireVerified
    // chay TRUOC validate/controller nen chan o day, khong cham logic dat hang.
    const { email, password } = await register();
    const { accessToken } = await login(email, password);

    const res = await api
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("GET /api/admin/orders bằng user thường → 403 FORBIDDEN", async () => {
    const { accessToken } = await createLoggedInUser();

    const res = await api
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("PATCH /api/admin/orders/:id/status bằng user thường → 403 FORBIDDEN", async () => {
    const { accessToken } = await createLoggedInUser();

    const res = await api
      .patch("/api/admin/orders/00000000-0000-0000-0000-000000000000/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "PAID" })
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
