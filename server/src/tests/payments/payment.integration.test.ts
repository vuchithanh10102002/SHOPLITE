import { describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { randomUUID } from "crypto";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser, emailJobs } from "../helpers/auth";
import { prisma } from "../../lib/prisma";
import { paymentProvider, PaymentDeclinedError } from "../../modules/payments/payment.provider";

const ADDRESS = "123 Đường Test, Quận 1, TP.HCM";

async function seedProduct(adminToken: string, categoryId: string, over: Record<string, unknown> = {}) {
  const res = await api
    .post("/api/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Áo thun", categoryId, price: 100000, stock: 10, ...over })
    .expect(201);
  return res.body.data.id as string;
}

function addToCart(token: string, productId: string, quantity: number) {
  return api.post("/api/cart/items").set("Authorization", `Bearer ${token}`).send({ productId, quantity });
}

function placeOrder(token: string) {
  return api
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ shippingAddress: ADDRESS });
}

async function stockOf(productId: string): Promise<number> {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { stock: true } });
  return p!.stock;
}

/** Cac job order-status da day vao queue (mock) cho orderId nay. */
function orderStatusJobs(orderId: string) {
  return emailJobs().filter((j) => j.name === "order-status" && j.data.orderId === orderId);
}

describe("Payment finalize (Phase 4 b5)", () => {
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

  it("thanh toán thành công → PAID, payment COMPLETED có txnId, history PENDING→PAID, email queued", async () => {
    const p1 = await seedProduct(adminToken, categoryId, { price: 100000, stock: 10 });
    await addToCart(userToken, p1, 2);

    const res = await placeOrder(userToken).expect(201);
    const order = res.body.data;

    expect(order.status).toBe("PAID");
    expect(order.payment).toMatchObject({ status: "COMPLETED", amount: "200000" });
    expect(order.payment.providerTxnId).toBe("txn_test_ok");
    expect(order.history.map((h: { toStatus: string }) => h.toStatus)).toEqual(["PENDING", "PAID"]);

    // Payment record that trong DB, order_id UNIQUE → dung 1 ban ghi
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    // Email order-status da queued (worker doc DB → trang thai that)
    expect(orderStatusJobs(order.id)).toHaveLength(1);
  });

  it("thanh toán thất bại → CANCELLED, HOÀN KHO, payment FAILED, history PENDING→CANCELLED, email queued", async () => {
    const p1 = await seedProduct(adminToken, categoryId, { price: 100000, stock: 10 });
    await addToCart(userToken, p1, 3);

    // Ep cong thanh toan tu choi 1 lan cho don nay.
    (paymentProvider.charge as Mock).mockRejectedValueOnce(new PaymentDeclinedError());

    const res = await placeOrder(userToken).expect(201);
    const order = res.body.data;

    expect(order.status).toBe("CANCELLED");
    expect(order.payment).toMatchObject({ status: "FAILED" });
    expect(order.payment.providerTxnId).toBeNull();
    expect(order.history.map((h: { toStatus: string }) => h.toStatus)).toEqual(["PENDING", "CANCELLED"]);

    // HOAN KHO: tru 3 o b4 roi cong tra 3 → ve nguyen 10
    expect(await stockOf(p1)).toBe(10);
    // Email van bao (don da huy) — worker doc DB thay CANCELLED
    expect(orderStatusJobs(order.id)).toHaveLength(1);
  });

  it("thất bại nhiều item → hoàn kho ĐỦ mọi item", async () => {
    const pA = await seedProduct(adminToken, categoryId, { name: "Sản phẩm A", stock: 10 });
    const pB = await seedProduct(adminToken, categoryId, { name: "Sản phẩm B", stock: 8 });
    await addToCart(userToken, pA, 4);
    await addToCart(userToken, pB, 5);

    (paymentProvider.charge as Mock).mockRejectedValueOnce(new PaymentDeclinedError());
    const res = await placeOrder(userToken).expect(201);

    expect(res.body.data.status).toBe("CANCELLED");
    expect(await stockOf(pA)).toBe(10);
    expect(await stockOf(pB)).toBe(8);
  });
});
