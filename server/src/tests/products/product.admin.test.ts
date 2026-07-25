import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser } from "../helpers/auth";
import { prisma } from "../../lib/prisma";

/**
 * Phan admin cua product them o Phase 6: khoi phuc hang da soft-delete
 * (POST /:id/restore) va detail theo ID cho form sua (GET /admin/:id).
 *
 * Phan CRUD + list ?includeDeleted da co san o product.integration.test.ts —
 * khong lap lai o day.
 */

const AUTH = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("Product admin: khôi phục + detail theo id (Phase 6)", () => {
  let adminToken: string;
  let userToken: string;
  let categoryId: string;
  let productId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    ({ accessToken: userToken } = await createLoggedInUser());

    const cat = await api
      .post("/api/categories")
      .set(AUTH(adminToken))
      .send({ name: "Đồ gia dụng" })
      .expect(201);
    categoryId = cat.body.data.id;

    const p = await api
      .post("/api/products")
      .set(AUTH(adminToken))
      .send({ name: "Nồi chiên không dầu", categoryId, price: 1500000, stock: 7 })
      .expect(201);
    productId = p.body.data.id;
  });

  // ── GET /api/products/admin/:id ────────────────────────────────────────────

  it("admin detail LO `stock` that — form sửa cần con số, không phải stockStatus", async () => {
    const res = await api.get(`/api/products/admin/${productId}`).set(AUTH(adminToken)).expect(200);

    expect(res.body.data).toMatchObject({ id: productId, stock: 7, deletedAt: null });
    // stockStatus van con (dung chung mapper public) — day la them, khong phai thay.
    expect(res.body.data.stockStatus).toBe("in_stock");
  });

  it("route public GET /:slug van KHONG lo stock — mo rong admin khong ro ri sang public", async () => {
    const res = await api.get("/api/products/noi-chien-khong-dau").expect(200);

    expect(res.body.data).not.toHaveProperty("stock");
    expect(res.body.data).not.toHaveProperty("deletedAt");
  });

  // ── GET /api/products/admin (list) ────────────────────────────────────────
  //
  // BUG THAT da xay ra: shape tra ve bam theo bo loc `includeDeleted` thay vi
  // theo vai nguoi goi, nen admin mo bang voi o "hien ca hang da xoa" CHUA tick
  // thi nhan PublicProduct — thieu `stock` va `deletedAt`. Man admin doc
  // `p.deletedAt !== null` ra `undefined !== null` = TRUE nen MOI dong hien
  // "Da xoa" kem nut Khoi phuc, cot ton kho trong tron.

  it("list admin KHÔNG kèm includeDeleted vẫn trả `stock` + `deletedAt`", async () => {
    const res = await api.get("/api/products/admin").set(AUTH(adminToken)).expect(200);

    const row = res.body.data.find((p: { id: string }) => p.id === productId);
    expect(row).toMatchObject({ stock: 7, deletedAt: null });
  });

  it("list admin ?includeDeleted=false cũng vậy — bộ lọc không đổi hợp đồng dữ liệu", async () => {
    const res = await api
      .get("/api/products/admin?includeDeleted=false")
      .set(AUTH(adminToken))
      .expect(200);

    const row = res.body.data.find((p: { id: string }) => p.id === productId);
    expect(row).toMatchObject({ stock: 7, deletedAt: null });
  });

  it("admin nạp cache trước KHÔNG làm rò `stock` sang list public cùng tham số", async () => {
    // Dung thu tu nay moi bat duoc bug: admin di TRUOC nen no la nguoi ghi cache.
    // Neu hai view dung chung key thi ban co `stock` se duoc phuc vu cho khach.
    await api.get("/api/products/admin?limit=50").set(AUTH(adminToken)).expect(200);

    const pub = await api.get("/api/products?limit=50").expect(200);

    for (const p of pub.body.data) {
      expect(p).not.toHaveProperty("stock");
      expect(p).not.toHaveProperty("deletedAt");
    }
  });

  it("admin detail thấy CẢ hàng đã xóa (public /:slug thì 404)", async () => {
    await api.delete(`/api/products/${productId}`).set(AUTH(adminToken)).expect(200);

    const admin = await api
      .get(`/api/products/admin/${productId}`)
      .set(AUTH(adminToken))
      .expect(200);
    expect(admin.body.data.deletedAt).not.toBeNull();

    // Mo trang sua mot hang da xoa ma 404 thi khong khoi phuc duoc bang UI.
    await api.get("/api/products/noi-chien-khong-dau").expect(404);
  });

  it("khách thường gọi admin detail → 403; chưa đăng nhập → 401", async () => {
    await api.get(`/api/products/admin/${productId}`).set(AUTH(userToken)).expect(403);
    await api.get(`/api/products/admin/${productId}`).expect(401);
  });

  it("id không tồn tại → 404, id không phải uuid → 400", async () => {
    await api
      .get("/api/products/admin/00000000-0000-4000-8000-000000000000")
      .set(AUTH(adminToken))
      .expect(404);

    await api.get("/api/products/admin/khong-phai-uuid").set(AUTH(adminToken)).expect(400);
  });

  // ── POST /api/products/:id/restore ─────────────────────────────────────────

  it("khôi phục: deletedAt về null, hàng hiện lại ở list public", async () => {
    await api.delete(`/api/products/${productId}`).set(AUTH(adminToken)).expect(200);

    const before = await api.get("/api/products").expect(200);
    expect(before.body.data.map((p: { id: string }) => p.id)).not.toContain(productId);

    const res = await api
      .post(`/api/products/${productId}/restore`)
      .set(AUTH(adminToken))
      .expect(200);
    expect(res.body.data).toMatchObject({ id: productId, deletedAt: null, stock: 7 });

    // Day la assertion THAT ve cache: restore co bumpVersion thi list moi thay
    // hang quay lai. Quen bump → list van tra ket qua cu (60s) → test do.
    const after = await api.get("/api/products").expect(200);
    expect(after.body.data.map((p: { id: string }) => p.id)).toContain(productId);
  });

  it("khôi phục hàng ĐANG SỐNG → 409, không nuốt im lặng", async () => {
    const res = await api
      .post(`/api/products/${productId}/restore`)
      .set(AUTH(adminToken))
      .expect(409);

    expect(res.body.error.code).toBe("PRODUCT_NOT_DELETED");
  });

  it("danh mục của nó đã bị xóa → 409 CATEGORY_UNAVAILABLE", async () => {
    await api.delete(`/api/products/${productId}`).set(AUTH(adminToken)).expect(200);
    // Xoa category qua DB: route DELETE /categories/:id tra 409 khi con san pham.
    await prisma.category.update({ where: { id: categoryId }, data: { deletedAt: new Date() } });

    const res = await api
      .post(`/api/products/${productId}/restore`)
      .set(AUTH(adminToken))
      .expect(409);

    expect(res.body.error.code).toBe("CATEGORY_UNAVAILABLE");

    // Va quan trong: van dang bi xoa, khong phai "loi nhung da tha ra roi".
    const row = await prisma.product.findUnique({ where: { id: productId } });
    expect(row?.deletedAt).not.toBeNull();
  });

  it("khách thường không khôi phục được → 403", async () => {
    await api.delete(`/api/products/${productId}`).set(AUTH(adminToken)).expect(200);
    await api.post(`/api/products/${productId}/restore`).set(AUTH(userToken)).expect(403);
    await api.post(`/api/products/${productId}/restore`).expect(401);
  });
});
