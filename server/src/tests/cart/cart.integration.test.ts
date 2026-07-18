import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser } from "../helpers/auth";
import { prisma } from "../../lib/prisma";

/** Tao product qua API (can admin) → tra ve id. */
async function seedProduct(
  adminToken: string,
  categoryId: string,
  over: Record<string, unknown> = {},
): Promise<string> {
  const res = await api
    .post("/api/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Áo thun", categoryId, price: 199000, stock: 10, ...over })
    .expect(201);

  return res.body.data.id;
}

/** Cac thao tac cart cua mot user (gan san token). */
function cart(token: string) {
  const auth = { Authorization: `Bearer ${token}` };
  return {
    get: () => api.get("/api/cart").set(auth),
    add: (productId: string, quantity: number) =>
      api.post("/api/cart/items").set(auth).send({ productId, quantity }),
    patch: (itemId: string, quantity: number) =>
      api.patch(`/api/cart/items/${itemId}`).set(auth).send({ quantity }),
    del: (itemId: string) => api.delete(`/api/cart/items/${itemId}`).set(auth),
    clear: () => api.delete("/api/cart").set(auth),
  };
}

describe("Cart", () => {
  let adminToken: string;
  let userToken: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    ({ accessToken: userToken } = await createLoggedInUser());
    const catRes = await api
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Thời trang" })
      .expect(201);
    categoryId = catRes.body.data.id;
  });

  it("chưa đăng nhập → 401", async () => {
    const res = await api.get("/api/cart").expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET khi chưa có cart → items rỗng, KHÔNG 404", async () => {
    const res = await cart(userToken).get().expect(200);
    expect(res.body.data).toEqual({ items: [] });
  });

  it("thêm item → 201, giỏ có item với info product hiện tại, KHÔNG lộ stock/publicId", async () => {
    const productId = await seedProduct(adminToken, categoryId, { stock: 10 });

    const res = await cart(userToken).add(productId, 2).expect(201);

    expect(res.body.data.items).toHaveLength(1);
    const item = res.body.data.items[0];
    expect(item).toMatchObject({
      productId,
      name: "Áo thun",
      quantity: 2,
      stockStatus: "in_stock",
      isUnavailable: false,
    });
    expect(typeof item.price).toBe("string");
    expect(item).not.toHaveProperty("stock");
    expect(item).not.toHaveProperty("publicId");
    expect(item).not.toHaveProperty("deletedAt");
  });

  it("thêm TRÙNG productId → cộng dồn quantity, KHÔNG tạo 2 dòng", async () => {
    const productId = await seedProduct(adminToken, categoryId, { stock: 10 });

    await cart(userToken).add(productId, 2).expect(201);
    const res = await cart(userToken).add(productId, 3).expect(201);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it("quantity vượt tồn kho khi thêm → 400 INSUFFICIENT_STOCK (check mềm)", async () => {
    const productId = await seedProduct(adminToken, categoryId, { stock: 5 });

    const res = await cart(userToken).add(productId, 10).expect(400);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("cộng dồn VƯỢT tồn kho → 400 (tính trên tổng, không chỉ lần thêm này)", async () => {
    const productId = await seedProduct(adminToken, categoryId, { stock: 5 });

    await cart(userToken).add(productId, 3).expect(201);
    const res = await cart(userToken).add(productId, 3).expect(400); // 3+3 > 5
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("thêm product không tồn tại → 404", async () => {
    const res = await cart(userToken)
      .add("00000000-0000-4000-8000-000000000000", 1)
      .expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("PATCH đổi quantity (tuyệt đối, không cộng dồn)", async () => {
    const productId = await seedProduct(adminToken, categoryId, { stock: 10 });
    const add = await cart(userToken).add(productId, 2).expect(201);
    const itemId = add.body.data.items[0].id;

    const res = await cart(userToken).patch(itemId, 7).expect(200);
    expect(res.body.data.items[0].quantity).toBe(7);
  });

  it("PATCH quantity=0 → 400 validation (dùng DELETE để xóa)", async () => {
    const productId = await seedProduct(adminToken, categoryId);
    const add = await cart(userToken).add(productId, 1).expect(201);
    const itemId = add.body.data.items[0].id;

    const res = await cart(userToken).patch(itemId, 0).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("DELETE item → biến khỏi giỏ", async () => {
    const productId = await seedProduct(adminToken, categoryId);
    const add = await cart(userToken).add(productId, 1).expect(201);
    const itemId = add.body.data.items[0].id;

    const res = await cart(userToken).del(itemId).expect(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("DELETE /cart → clear sạch giỏ", async () => {
    const p1 = await seedProduct(adminToken, categoryId, { name: "Áo A" });
    const p2 = await seedProduct(adminToken, categoryId, { name: "Áo B" });
    await cart(userToken).add(p1, 1).expect(201);
    await cart(userToken).add(p2, 1).expect(201);

    const res = await cart(userToken).clear().expect(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("IDOR: user B KHÔNG sửa/xóa được item của user A → 404", async () => {
    const productId = await seedProduct(adminToken, categoryId);
    const add = await cart(userToken).add(productId, 1).expect(201); // gio cua A
    const itemId = add.body.data.items[0].id;

    const { accessToken: tokenB } = await createLoggedInUser();

    await cart(tokenB).patch(itemId, 5).expect(404);
    await cart(tokenB).del(itemId).expect(404);

    // Item cua A van con nguyen.
    const aCart = await cart(userToken).get().expect(200);
    expect(aCart.body.data.items[0].quantity).toBe(1);
  });

  it("product bị soft-delete → item VẪN hiện trong giỏ, cờ isUnavailable=true (BR5)", async () => {
    const productId = await seedProduct(adminToken, categoryId, { stock: 10 });
    await cart(userToken).add(productId, 2).expect(201);

    // Soft-delete thang qua DB (khong quan tam cache product o day).
    await prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date() },
    });

    const res = await cart(userToken).get().expect(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ productId, isUnavailable: true });
  });
});
