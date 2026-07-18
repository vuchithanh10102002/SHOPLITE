import { describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { randomUUID } from "crypto";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser } from "../helpers/auth";
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

/** Dat 1 don (mac dinh mock charge thanh cong → PAID). Tra ve body.data. */
async function placePaidOrder(token: string, productId: string, qty = 1) {
  await addToCart(token, productId, qty);
  const res = await api
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ shippingAddress: ADDRESS })
    .expect(201);
  return res.body.data;
}

async function stockOf(productId: string): Promise<number> {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { stock: true } });
  return p!.stock;
}

function setStatus(adminToken: string, orderId: string, status: string) {
  return api
    .patch(`/api/admin/orders/${orderId}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status });
}

describe("Order huỷ + admin đổi trạng thái (Phase 4 b6)", () => {
  let adminToken: string;
  let userToken: string;
  let userEmail: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    ({ accessToken: userToken, email: userEmail } = await createLoggedInUser());
    const catRes = await api
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Thời trang" })
      .expect(201);
    categoryId = catRes.body.data.id;
  });

  describe("Khách huỷ đơn", () => {
    it("huỷ đơn PAID của mình → 200 CANCELLED, hoàn kho, history changedBy=user", async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
      const order = await placePaidOrder(userToken, p1, 3);
      expect(await stockOf(p1)).toBe(7); // da tru khi dat

      const res = await api
        .post(`/api/orders/${order.id}/cancel`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.status).toBe("CANCELLED");
      expect(res.body.data.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        "PENDING",
        "PAID",
        "CANCELLED",
      ]);
      expect(await stockOf(p1)).toBe(10); // hoan kho ve nguyen

      // changedBy la user huy don
      const last = await prisma.orderStatusHistory.findFirst({
        where: { orderId: order.id, toStatus: "CANCELLED" },
      });
      const user = await prisma.user.findUnique({ where: { email: userEmail } });
      expect(last!.changedBy).toBe(user!.id);
    });

    it("huỷ đơn của người khác → 404 (không lộ tồn tại)", async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
      const order = await placePaidOrder(userToken, p1, 1);

      const { accessToken: otherToken } = await createLoggedInUser();
      const res = await api
        .post(`/api/orders/${order.id}/cancel`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(await stockOf(p1)).toBe(9); // khong bi hoan kho
    });

    it("huỷ đơn đã CANCELLED → 409, không hoàn kho lần 2", async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
      // Ep thanh toan fail → don tu CANCELLED (da hoan kho ve 10)
      (paymentProvider.charge as Mock).mockRejectedValueOnce(new PaymentDeclinedError());
      const order = await placePaidOrder(userToken, p1, 4);
      expect(order.status).toBe("CANCELLED");
      expect(await stockOf(p1)).toBe(10);

      const res = await api
        .post(`/api/orders/${order.id}/cancel`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(409);
      expect(res.body.error.code).toBe("ORDER_NOT_CANCELLABLE");
      expect(await stockOf(p1)).toBe(10); // van 10, khong cong tra lan 2
    });

    it("huỷ đơn đã SHIPPED → 409 (BR2: SHIPPED không huỷ qua hệ thống)", async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
      const order = await placePaidOrder(userToken, p1, 2);
      await setStatus(adminToken, order.id, "SHIPPED").expect(200);

      const res = await api
        .post(`/api/orders/${order.id}/cancel`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(409);
      expect(res.body.error.code).toBe("ORDER_NOT_CANCELLABLE");
      expect(await stockOf(p1)).toBe(8); // khong hoan kho
    });
  });

  describe("Admin đổi trạng thái", () => {
    it("PAID → SHIPPED → COMPLETED hợp lệ, history changedBy=admin, kho không đổi", async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
      const order = await placePaidOrder(userToken, p1, 2);

      const shipped = await setStatus(adminToken, order.id, "SHIPPED").expect(200);
      expect(shipped.body.data.status).toBe("SHIPPED");

      const done = await setStatus(adminToken, order.id, "COMPLETED").expect(200);
      expect(done.body.data.status).toBe("COMPLETED");
      expect(done.body.data.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        "PENDING",
        "PAID",
        "SHIPPED",
        "COMPLETED",
      ]);
      expect(await stockOf(p1)).toBe(8); // doi trang thai binh thuong khong dung kho

      const hist = await prisma.orderStatusHistory.findFirst({
        where: { orderId: order.id, toStatus: "SHIPPED" },
      });
      const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      expect(hist!.changedBy).toBe(admin!.id);
    });

    it("nhảy cóc PAID → COMPLETED → 409 INVALID_STATUS_TRANSITION", async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
      const order = await placePaidOrder(userToken, p1, 1);

      const res = await setStatus(adminToken, order.id, "COMPLETED").expect(409);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("admin chuyển PAID → CANCELLED → hoàn kho (BR2)", async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
      const order = await placePaidOrder(userToken, p1, 3);
      expect(await stockOf(p1)).toBe(7);

      const res = await setStatus(adminToken, order.id, "CANCELLED").expect(200);
      expect(res.body.data.status).toBe("CANCELLED");
      expect(await stockOf(p1)).toBe(10);
    });

    it("đơn không tồn tại → 404", async () => {
      const res = await setStatus(adminToken, randomUUID(), "SHIPPED").expect(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("status rác trong body → 400 VALIDATION_ERROR", async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 10 });
      const order = await placePaidOrder(userToken, p1, 1);
      const res = await setStatus(adminToken, order.id, "FOO").expect(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Admin list đơn", () => {
    it("liệt kê mọi đơn (mọi user) + lọc theo status/userId", async () => {
      const p1 = await seedProduct(adminToken, categoryId, { stock: 100 });
      const myOrder = await placePaidOrder(userToken, p1, 1);

      const { accessToken: otherToken } = await createLoggedInUser();
      await placePaidOrder(otherToken, p1, 1);

      // Khong loc → thay ca 2 don
      const all = await api
        .get("/api/admin/orders")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(all.body.meta.total).toBe(2);
      expect(all.body.data[0]).toHaveProperty("userEmail");

      // Loc theo userId → chi don cua user do
      const user = await prisma.user.findUnique({ where: { email: userEmail } });
      const mine = await api
        .get(`/api/admin/orders?userId=${user!.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(mine.body.meta.total).toBe(1);
      expect(mine.body.data[0].id).toBe(myOrder.id);

      // Loc theo status=SHIPPED → chua co don nao SHIPPED
      const shipped = await api
        .get("/api/admin/orders?status=SHIPPED")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(shipped.body.meta.total).toBe(0);
    });
  });
});
