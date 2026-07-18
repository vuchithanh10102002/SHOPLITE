import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser } from "../helpers/auth";
import { prisma } from "../../lib/prisma";

const ADDRESS = "123 Đường Test, Quận 1, TP.HCM";

/** Tao product qua API (can admin) → tra ve id. */
async function seedProduct(
  adminToken: string,
  categoryId: string,
  over: Record<string, unknown> = {},
): Promise<string> {
  const res = await api
    .post("/api/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Áo thun", categoryId, price: 100000, stock: 10, ...over })
    .expect(201);
  return res.body.data.id;
}

function addToCart(token: string, productId: string, quantity: number) {
  return api
    .post("/api/cart/items")
    .set("Authorization", `Bearer ${token}`)
    .send({ productId, quantity });
}

/** Dat hang. Idempotency-Key mac dinh moi lan mot uuid; truyen key co dinh de test replay. */
function placeOrder(token: string, key = randomUUID(), address = ADDRESS) {
  return api
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", key)
    .send({ shippingAddress: address });
}

async function stockOf(productId: string): Promise<number> {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { stock: true } });
  return p!.stock;
}

describe("Order — đặt hàng (Phase 4 b4)", () => {
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

  it("thiếu header Idempotency-Key → 400", async () => {
    const res = await api
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ shippingAddress: ADDRESS })
      .expect(400);
    expect(res.body.error.code).toBe("MISSING_IDEMPOTENCY_KEY");
  });

  it("giỏ trống → 400 CART_EMPTY", async () => {
    const res = await placeOrder(userToken).expect(400);
    expect(res.body.error.code).toBe("CART_EMPTY");
  });

  it("đặt hàng thành công → 201, total tính server, trừ kho, giỏ sạch (settle PAID ở b5)", async () => {
    const p1 = await seedProduct(adminToken, categoryId, { name: "Áo", price: 100000, stock: 10 });
    const p2 = await seedProduct(adminToken, categoryId, { name: "Quần", price: 250000, stock: 5 });
    await addToCart(userToken, p1, 2);
    await addToCart(userToken, p2, 1);

    const res = await placeOrder(userToken).expect(201);
    const order = res.body.data;

    // Mock cong thanh toan mac dinh THANH CONG → don ket PAID (finalize dong bo o b5).
    expect(order.status).toBe("PAID");
    // total = 100000*2 + 250000*1 = 450000, tra ve string (Decimal)
    expect(order.totalAmount).toBe("450000");
    expect(order.items).toHaveLength(2);
    // history: PENDING (tao) → PAID (thanh toan)
    expect(order.history.map((h: { toStatus: string }) => h.toStatus)).toEqual(["PENDING", "PAID"]);
    expect(order.history[0].fromStatus).toBeNull();

    // Tru kho that (PAID giu nguyen kho da tru)
    expect(await stockOf(p1)).toBe(8);
    expect(await stockOf(p2)).toBe(4);

    // Gio bi don sach sau khi dat
    const cart = await api.get("/api/cart").set("Authorization", `Bearer ${userToken}`).expect(200);
    expect(cart.body.data.items).toEqual([]);
  });

  it("item lưu SNAPSHOT giá — đổi giá product sau đó không đổi đơn cũ", async () => {
    const p1 = await seedProduct(adminToken, categoryId, { price: 100000, stock: 10 });
    await addToCart(userToken, p1, 1);
    const res = await placeOrder(userToken).expect(201);
    const orderId = res.body.data.id;
    expect(res.body.data.items[0].unitPrice).toBe("100000");

    // Doi gia product hien tai
    await prisma.product.update({ where: { id: p1 }, data: { price: 999000 } });

    const detail = await api
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    // Van la gia luc mua, khong phai gia moi
    expect(detail.body.data.items[0].unitPrice).toBe("100000");
    expect(detail.body.data.totalAmount).toBe("100000");
  });

  it("replay cùng Idempotency-Key → KHÔNG tạo đơn thứ 2, trừ kho đúng 1 lần", async () => {
    const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
    await addToCart(userToken, p1, 3);

    const key = randomUUID();
    const first = await placeOrder(userToken, key).expect(201);
    const second = await placeOrder(userToken, key).expect(200); // replay → 200

    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(p1)).toBe(7); // tru 3 dung MOT lan
  });

  it("chống oversell: cart vượt kho hiện tại → 400 INSUFFICIENT_STOCK, không đơn, kho nguyên", async () => {
    const p1 = await seedProduct(adminToken, categoryId, { stock: 5 });
    await addToCart(userToken, p1, 5);
    // Mo phong nguoi khac mua bot: kho tut ve 2 (< 5 dang trong gio)
    await prisma.product.update({ where: { id: p1 }, data: { stock: 2 } });

    const res = await placeOrder(userToken).expect(400);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(await prisma.order.count()).toBe(0);
    expect(await stockOf(p1)).toBe(2); // khong bi tru
  });

  it("một item thiếu kho → TOÀN BỘ rollback, item còn lại không bị trừ", async () => {
    const pOk = await seedProduct(adminToken, categoryId, { name: "OK", stock: 10 });
    const pBad = await seedProduct(adminToken, categoryId, { name: "Bad", stock: 10 });
    await addToCart(userToken, pOk, 3);
    await addToCart(userToken, pBad, 5);
    // pBad tut kho ve 2 sau khi da vao gio
    await prisma.product.update({ where: { id: pBad }, data: { stock: 2 } });

    await placeOrder(userToken).expect(400);

    expect(await prisma.order.count()).toBe(0);
    expect(await stockOf(pOk)).toBe(10); // KHONG bi tru du da UPDATE truoc trong tx
    expect(await stockOf(pBad)).toBe(2);
  });

  it("BR5: giỏ có product đã xoá → 400 PRODUCT_UNAVAILABLE", async () => {
    const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
    await addToCart(userToken, p1, 1);
    // Admin xoa mem product sau khi da vao gio
    await api
      .delete(`/api/products/${p1}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const res = await placeOrder(userToken).expect(400);
    expect(res.body.error.code).toBe("PRODUCT_UNAVAILABLE");
    expect(await prisma.order.count()).toBe(0);
  });

  describe("GET /api/orders/:id — quyền xem", () => {
    let orderId: string;

    beforeEach(async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
      await addToCart(userToken, p1, 1);
      orderId = (await placeOrder(userToken).expect(201)).body.data.id;
    });

    it("chủ đơn xem được → 200", async () => {
      await api.get(`/api/orders/${orderId}`).set("Authorization", `Bearer ${userToken}`).expect(200);
    });

    it("user khác → 404 (không lộ tồn tại)", async () => {
      const { accessToken: otherToken } = await createLoggedInUser();
      const res = await api
        .get(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("admin xem được đơn của người khác → 200", async () => {
      await api.get(`/api/orders/${orderId}`).set("Authorization", `Bearer ${adminToken}`).expect(200);
    });
  });

  it("GET /api/orders — chỉ đơn của tôi, có phân trang", async () => {
    const p1 = await seedProduct(adminToken, categoryId, { stock: 100 });
    // User dat 2 don (moi don 1 item, key khac nhau)
    await addToCart(userToken, p1, 1);
    await placeOrder(userToken).expect(201);
    await addToCart(userToken, p1, 1);
    await placeOrder(userToken).expect(201);

    // User khac dat 1 don — khong duoc lot vao list cua userToken
    const { accessToken: otherToken } = await createLoggedInUser();
    await addToCart(otherToken, p1, 1);
    await placeOrder(otherToken).expect(201);

    const res = await api
      .get("/api/orders?page=1&limit=20")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(res.body.data[0].itemCount).toBe(1);
  });
});
