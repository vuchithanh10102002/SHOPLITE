import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import type { Response } from "supertest";
import { api } from "../helpers/request";
import { createLoggedInAdmin } from "../helpers/auth";
import { prisma } from "../../lib/prisma";
import { generateAccessToken } from "../../modules/auth/token.service";

const ADDRESS = "123 Đường Test, Quận 1, TP.HCM";

/**
 * Concurrency test (Phase 4 b8) — DoD cuối phase: chứng minh chốt chống oversell
 * (conditional UPDATE trong tx, order.service.ts b4) đứng vững dưới đua thật, KHÔNG
 * chỉ trên lý thuyết.
 *
 * Vì sao seed user thẳng qua prisma + tự ký token (không dùng register/login API):
 * /register giới hạn 5 req/60s, /login 10 req/60s THEO IP (rate-limit.ts). Supertest
 * đi từ một IP → tạo 50 user qua API sẽ ăn 429 ngay từ user thứ 6. Seed prisma bỏ
 * qua rate limit, bỏ luôn bcrypt (nhanh). Token khớp shape authenticate đọc:
 * { sub, role, verified } (token.service + auth.middleware).
 */
function tokenFor(userId: string, role = "CUSTOMER"): string {
  return generateAccessToken({ sub: userId, role, verified: true });
}

interface Shopper {
  id: string;
  cartId: string;
  token: string;
}

/** Tạo N khách đã verify + giỏ rỗng qua prisma (bỏ qua rate limit + bcrypt). */
async function seedShoppers(count: number): Promise<Shopper[]> {
  const emails = Array.from({ length: count }, (_, i) => `rush${i}.${process.pid}@test.local`);

  await prisma.user.createMany({
    data: emails.map((email, i) => ({
      email,
      passwordHash: "seed-not-used", // login đi qua token tự ký, không qua bcrypt
      fullName: `Rush ${i}`,
      emailVerified: true,
    })),
  });
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, role: true },
  });

  await prisma.cart.createMany({ data: users.map((u) => ({ userId: u.id })) });
  const carts = await prisma.cart.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
    select: { id: true, userId: true },
  });
  const cartByUser = new Map(carts.map((c) => [c.userId, c.id]));

  return users.map((u) => ({ id: u.id, cartId: cartByUser.get(u.id)!, token: tokenFor(u.id, u.role) }));
}

function placeOrder(token: string): Promise<Response> {
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

/** Xoá sạch đơn từ vòng trước (con trước cha) — để đếm lại từ 0 mỗi vòng. */
async function clearOrders(): Promise<void> {
  await prisma.orderItem.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
}

describe("Order — concurrency chống oversell (Phase 4 b8)", () => {
  let adminToken: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    const catRes = await api
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Thời trang" })
      .expect(201);
    categoryId = catRes.body.data.id;
  });

  async function seedProduct(stock: number): Promise<string> {
    const res = await api
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Áo hot", categoryId, price: 100000, stock })
      .expect(201);
    return res.body.data.id;
  }

  it(
    "50 request đồng thời mua stock=10 → đúng 10 thành công + stock=0 (10 vòng liên tiếp)",
    async () => {
      const USERS = 50;
      const STOCK = 10;
      const ROUNDS = 10;

      const productId = await seedProduct(STOCK);
      const shoppers = await seedShoppers(USERS);

      for (let round = 0; round < ROUNDS; round++) {
        // Reset trạng thái đầu vòng: xoá đơn cũ, nạp lại kho, mỗi giỏ đúng 1 món.
        await clearOrders();
        await prisma.cartItem.deleteMany();
        await prisma.product.update({ where: { id: productId }, data: { stock: STOCK } });
        await prisma.cartItem.createMany({
          data: shoppers.map((s) => ({ cartId: s.cartId, productId, quantity: 1 })),
        });

        // 50 request BẮN CÙNG LÚC. Tất cả UPDATE cùng một product row → row lock
        // (ReadCommitted) serialize chúng: đúng STOCK cái trừ được kho, phần còn lại
        // thấy stock=0 → INSUFFICIENT_STOCK.
        const results = await Promise.all(shoppers.map((s) => placeOrder(s.token)));

        const ok = results.filter((r) => r.status === 201);
        const rejected = results.filter((r) => r.status === 400);

        const detail = `vòng ${round}: ${ok.length} OK / ${rejected.length} từ chối / ` +
          `${results.length - ok.length - rejected.length} status lạ`;

        expect(ok.length, detail).toBe(STOCK);
        expect(rejected.length, detail).toBe(USERS - STOCK);
        // Người thắng chốt PAID (settle đồng bộ b5, mock charge success); người thua đúng mã lỗi.
        for (const r of ok) expect(r.body.data.status).toBe("PAID");
        for (const r of rejected) expect(r.body.error.code).toBe("INSUFFICIENT_STOCK");

        // Bất biến cứng: không bao giờ bán quá kho, và đúng số đơn = số hàng.
        expect(await stockOf(productId), detail).toBe(0);
        expect(await prisma.order.count(), detail).toBe(STOCK);
      }
    },
    120_000, // 10 vòng × 50 tx serialize trên row lock — vượt xa timeout mặc định 5s.
  );

  it(
    "N request đồng thời CÙNG Idempotency-Key → đúng 1 đơn, trừ kho đúng 1 lần",
    async () => {
      const N = 25;
      const STOCK = 10;
      const QTY = 3;

      const productId = await seedProduct(STOCK);
      const [shopper] = await seedShoppers(1);
      await prisma.cartItem.create({
        data: { cartId: shopper.cartId, productId, quantity: QTY },
      });

      // MỘT key dùng chung cho cả N request → chốt idempotency 2 lớp (findUnique
      // trước tx + bắt P2002 sau tx) phải bảo đảm chỉ 1 đơn ra đời.
      const key = randomUUID();
      const results = await Promise.all(
        Array.from({ length: N }, () =>
          api
            .post("/api/orders")
            .set("Authorization", `Bearer ${shopper.token}`)
            .set("Idempotency-Key", key)
            .send({ shippingAddress: ADDRESS }),
        ),
      );

      // Bất biến (deterministic): đúng 1 đơn, kho trừ đúng 1 lần, đúng 1 response 201.
      // KHÔNG assert "mọi response 200": có race hợp lệ — loser đọc giỏ SAU khi winner
      // đã dọn giỏ trong tx → 400 CART_EMPTY. Không sai; đơn vẫn chỉ có 1.
      expect(await prisma.order.count()).toBe(1);
      expect(await stockOf(productId)).toBe(STOCK - QTY); // trừ QTY đúng một lần

      const created = results.filter((r) => r.status === 201);
      expect(created).toHaveLength(1); // đúng một request thực sự tạo đơn

      const theOrder = await prisma.order.findFirst({ select: { id: true } });
      // Mọi response 2xx đều trỏ về cùng một đơn (winner) — không đơn ma.
      for (const r of results) {
        if (r.status === 200 || r.status === 201) expect(r.body.data.id).toBe(theOrder!.id);
      }
    },
    60_000,
  );
});
