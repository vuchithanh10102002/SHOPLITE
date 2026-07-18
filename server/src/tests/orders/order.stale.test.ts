import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { subMinutes } from "date-fns";
import { Prisma, OrderStatus } from "@prisma/client";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser } from "../helpers/auth";
import { prisma } from "../../lib/prisma";
import { orderService } from "../../modules/orders/order.service";

const ADDRESS = "123 Đường Test, Quận 1, TP.HCM";

async function seedProduct(adminToken: string, categoryId: string, over: Record<string, unknown> = {}) {
  const res = await api
    .post("/api/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Áo thun", categoryId, price: 100000, stock: 10, ...over })
    .expect(201);
  return res.body.data.id as string;
}

async function stockOf(productId: string): Promise<number> {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { stock: true } });
  return p!.stock;
}

/**
 * Dung mot don o trang thai/tuoi tuy y qua prisma (bo qua createOrder — vi
 * createOrder auto-settle nen khong bao gio de lai PENDING). Mo phong don da tru
 * kho: giam stock product tuong ung.
 */
async function seedOrder(
  userId: string,
  productId: string,
  opts: { quantity: number; ageMinutes: number; status?: OrderStatus },
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, price: true },
  });
  const status = opts.status ?? OrderStatus.PENDING;

  const order = await prisma.order.create({
    data: {
      userId,
      idempotencyKey: randomUUID(),
      shippingAddress: ADDRESS,
      totalAmount: new Prisma.Decimal(product!.price).times(opts.quantity),
      status,
      createdAt: subMinutes(new Date(), opts.ageMinutes),
      items: {
        create: [
          {
            productId,
            productName: product!.name,
            unitPrice: product!.price,
            quantity: opts.quantity,
          },
        ],
      },
      history: { create: { toStatus: status, reason: "seed" } },
    },
    select: { id: true },
  });

  // Gia lap b4 da tru kho khi dat don nay.
  await prisma.product.update({
    where: { id: productId },
    data: { stock: { decrement: opts.quantity } },
  });

  return order.id;
}

describe("Quét đơn PENDING treo (Phase 4 b7)", () => {
  let adminToken: string;
  let userId: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    const { email } = await createLoggedInUser();
    userId = (await prisma.user.findUnique({ where: { email }, select: { id: true } }))!.id;
    const catRes = await api
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Thời trang" })
      .expect(201);
    categoryId = catRes.body.data.id;
  });

  it("đơn PENDING quá 15' → CANCELLED, hoàn kho, history changedBy=null", async () => {
    const productId = await seedProduct(adminToken, categoryId, { stock: 10 });
    const orderId = await seedOrder(userId, productId, { quantity: 3, ageMinutes: 20 });
    expect(await stockOf(productId)).toBe(7); // da tru khi dat

    const cancelled = await orderService.cancelStalePendingOrders(15);
    expect(cancelled).toBe(1);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { history: { orderBy: { id: "asc" } } },
    });
    expect(order!.status).toBe("CANCELLED");
    expect(await stockOf(productId)).toBe(10); // hoan lai 3

    const cancelHist = order!.history.find((h) => h.toStatus === "CANCELLED");
    expect(cancelHist!.changedBy).toBeNull(); // job he thong, khong phai user
    expect(cancelHist!.reason).toContain("quá hạn");
  });

  it("đơn PENDING còn mới (5') → KHÔNG đụng", async () => {
    const productId = await seedProduct(adminToken, categoryId, { stock: 10 });
    const orderId = await seedOrder(userId, productId, { quantity: 2, ageMinutes: 5 });

    const cancelled = await orderService.cancelStalePendingOrders(15);
    expect(cancelled).toBe(0);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order!.status).toBe("PENDING");
    expect(await stockOf(productId)).toBe(8); // van tru, khong hoan
  });

  it("đơn PAID quá hạn → KHÔNG đụng (chỉ quét PENDING)", async () => {
    const productId = await seedProduct(adminToken, categoryId, { stock: 10 });
    const orderId = await seedOrder(userId, productId, {
      quantity: 4,
      ageMinutes: 30,
      status: OrderStatus.PAID,
    });

    const cancelled = await orderService.cancelStalePendingOrders(15);
    expect(cancelled).toBe(0);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order!.status).toBe("PAID");
    expect(await stockOf(productId)).toBe(6); // khong hoan
  });
});
