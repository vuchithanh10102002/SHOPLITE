import { describe, it, expect } from "vitest";
import { api } from "../helpers/request";
import {
  createLoggedInUser,
  createLoggedInAdmin,
  register,
  login,
} from "../helpers/auth";

/**
 * Phase 4 buoc 2: Order module moi la SKELETON — 6 endpoint da lo ra + gan dung
 * middleware, logic nem 501 NOT_IMPLEMENTED. Test o day chi khoa DAY DAU: route
 * da mount chua, chuoi middleware (authenticate / requireVerified / requireRole)
 * co chan dung thu tu khong. Logic that + test logic lam o cac buoc sau.
 */
describe("Order skeleton (Phase 4 b2)", () => {
  it("POST /api/orders chua dang nhap → 401 UNAUTHORIZED", async () => {
    const res = await api.post("/api/orders").expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/orders khi email chua verify → 403 EMAIL_NOT_VERIFIED (BR4)", async () => {
    // register = tao user CHUA verify; BR4 cho login luc chua verify.
    const { email, password } = await register();
    const { accessToken } = await login(email, password);

    const res = await api
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("POST /api/orders khi da verify → qua middleware, cham logic → 501", async () => {
    const { accessToken } = await createLoggedInUser();

    const res = await api
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("GET /api/orders (chi can authenticate) khi da login → 501", async () => {
    const { accessToken } = await createLoggedInUser();

    const res = await api
      .get("/api/orders")
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
});
