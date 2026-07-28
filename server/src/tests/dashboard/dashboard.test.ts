import { describe, it, expect, beforeEach } from "vitest";
import { OrderStatus } from "@prisma/client";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser } from "../helpers/auth";
import { prisma } from "../../lib/prisma";

/**
 * GET /api/admin/dashboard.
 *
 * Seed don THANG QUA PRISMA chu khong qua POST /orders: di duong API thi moi don deu
 * auto-settle nen khong dat duoc du 5 trang thai, va khong lui duoc `createdAt` ve
 * qua khu — ma bieu do 30 ngay phai co du lieu o nhieu ngay khac nhau moi kiem duoc.
 */

const AUTH = (t: string) => ({ Authorization: `Bearer ${t}` });

interface Dashboard {
  summary: { revenueTotal: string; orderCount: number; customerCount: number; productCount: number };
  revenueDaily: { date: string; revenue: string; orders: number }[];
  topProducts: { productId: string; name: string; quantitySold: number; revenue: string }[];
  ordersByStatus: { status: OrderStatus; count: number }[];
}

let seq = 0;

async function seedProduct(categoryId: string, name: string, price: string, over: { deletedAt?: Date } = {}) {
  seq += 1;
  return prisma.product.create({
    data: {
      categoryId,
      name,
      nameNormalized: name.toLowerCase(),
      slug: `sp-${seq}-${process.pid}`,
      price,
      stock: 100,
      deletedAt: over.deletedAt ?? null,
    },
  });
}

/** Mot don + cac dong hang cua no. `daysAgo` de dat don lui ve qua khu. */
async function seedOrder(
  userId: string,
  status: OrderStatus,
  items: { productId: string; productName: string; unitPrice: string; quantity: number }[],
  daysAgo = 0,
) {
  seq += 1;
  const total = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  return prisma.order.create({
    data: {
      userId,
      status,
      totalAmount: total.toFixed(2),
      idempotencyKey: `dash-${seq}`,
      shippingAddress: "123 Đường Test",
      createdAt,
      items: { create: items },
    },
  });
}

function get(token: string) {
  return api.get("/api/admin/dashboard").set(AUTH(token));
}

describe("Admin dashboard (Phase 6 bước 5)", () => {
  let adminToken: string;
  let userToken: string;
  let userId: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    const customer = await createLoggedInUser();
    userToken = customer.accessToken;
    userId = (await prisma.user.findUniqueOrThrow({ where: { email: customer.email } })).id;

    const cat = await prisma.category.create({
      data: { name: "Đồ gia dụng", slug: `dg-${process.pid}-${++seq}` },
    });
    categoryId = cat.id;
  });

  it("chưa đăng nhập → 401; khách thường → 403", async () => {
    await api.get("/api/admin/dashboard").expect(401);
    await get(userToken).expect(403);
  });

  it("trả về JSON hợp lệ — COUNT(*) của Postgres là bigint, quên ::int là 500", async () => {
    await seedOrder(userId, OrderStatus.PAID, []);

    const res = await get(adminToken).expect(200);
    const d: Dashboard = res.body.data;

    expect(typeof d.summary.orderCount).toBe("number");
    expect(d.revenueDaily.every((p) => typeof p.orders === "number")).toBe(true);
  });

  // ── summary ───────────────────────────────────────────────────────────────

  it("doanh thu CHỈ tính PAID/SHIPPED/COMPLETED — PENDING và CANCELLED không được cộng", async () => {
    const p = await seedProduct(categoryId, "Nồi chiên", "100000");
    const line = (qty: number) => [
      { productId: p.id, productName: p.name, unitPrice: "100000", quantity: qty },
    ];

    await seedOrder(userId, OrderStatus.PAID, line(1)); // 100k  ✓
    await seedOrder(userId, OrderStatus.SHIPPED, line(2)); // 200k  ✓
    await seedOrder(userId, OrderStatus.COMPLETED, line(3)); // 300k  ✓
    await seedOrder(userId, OrderStatus.PENDING, line(5)); // 500k  ✗ chua chac thanh
    await seedOrder(userId, OrderStatus.CANCELLED, line(9)); // 900k  ✗ da hoan kho

    const d: Dashboard = (await get(adminToken).expect(200)).body.data;

    expect(Number(d.summary.revenueTotal)).toBe(600000);
    // orderCount thi dem MOI don, ke ca huy — hai the canh nhau co y nghia khac nhau.
    expect(d.summary.orderCount).toBe(5);
  });

  it("customerCount chỉ đếm CUSTOMER, productCount bỏ hàng đã soft-delete", async () => {
    await seedProduct(categoryId, "Còn sống", "1000");
    await seedProduct(categoryId, "Đã xóa", "1000", { deletedAt: new Date() });

    const d: Dashboard = (await get(adminToken).expect(200)).body.data;

    expect(d.summary.productCount).toBe(1);
    expect(d.summary.customerCount).toBe(1); // admin cua beforeEach KHONG duoc tinh la khach
  });

  it("chưa bán được gì → revenueTotal là '0', không phải null", async () => {
    const d: Dashboard = (await get(adminToken).expect(200)).body.data;

    // _sum cua Prisma tra null khi khong co dong nao khop; thieu fallback thi FE
    // nhan null va hien "—" ngay khi shop moi mo.
    expect(Number(d.summary.revenueTotal)).toBe(0);
    expect(d.summary.revenueTotal).not.toBeNull();
  });

  // ── revenueDaily ──────────────────────────────────────────────────────────

  it("đủ 30 điểm liên tiếp kể cả ngày không bán được gì — line chart không nối qua khoảng trống", async () => {
    const p = await seedProduct(categoryId, "Nồi chiên", "100000");
    // Mot don hom nay, mot don 10 ngay truoc → o giua la 9 ngay TRONG.
    await seedOrder(userId, OrderStatus.PAID, [
      { productId: p.id, productName: p.name, unitPrice: "100000", quantity: 1 },
    ]);
    await seedOrder(
      userId,
      OrderStatus.PAID,
      [{ productId: p.id, productName: p.name, unitPrice: "100000", quantity: 2 }],
      10,
    );

    const d: Dashboard = (await get(adminToken).expect(200)).body.data;

    expect(d.revenueDaily).toHaveLength(30);
    // Ngay lien tiep, tang dan, khong trung, khong nhay coc.
    const days = d.revenueDaily.map((p2) => p2.date);
    expect([...days].sort()).toEqual(days);
    expect(new Set(days).size).toBe(30);
    for (let i = 1; i < days.length; i++) {
      const gap = (Date.parse(days[i]) - Date.parse(days[i - 1])) / 86_400_000;
      expect(gap).toBe(1);
    }

    // Cac ngay khong co don van co dong voi revenue "0".
    const empty = d.revenueDaily.filter((p2) => p2.orders === 0);
    expect(empty.length).toBe(28);
    expect(empty.every((p2) => Number(p2.revenue) === 0)).toBe(true);

    // Tong cua bieu do khop tong doanh thu (cung dinh nghia REVENUE_STATUSES).
    const sum = d.revenueDaily.reduce((s, p2) => s + Number(p2.revenue), 0);
    expect(sum).toBe(300000);
    expect(sum).toBe(Number(d.summary.revenueTotal));
  });

  it("đơn quá 30 ngày không lọt vào biểu đồ nhưng vẫn nằm trong tổng doanh thu", async () => {
    const p = await seedProduct(categoryId, "Nồi chiên", "100000");
    await seedOrder(
      userId,
      OrderStatus.PAID,
      [{ productId: p.id, productName: p.name, unitPrice: "100000", quantity: 4 }],
      45,
    );

    const d: Dashboard = (await get(adminToken).expect(200)).body.data;

    expect(d.revenueDaily.every((p2) => p2.orders === 0)).toBe(true);
    expect(Number(d.summary.revenueTotal)).toBe(400000); // summary khong gioi han 30 ngay
  });

  // ── topProducts ───────────────────────────────────────────────────────────

  it("top 5 xếp theo SỐ LƯỢNG bán, tối đa 5 dòng, chỉ tính đơn có doanh thu", async () => {
    const products = await Promise.all(
      ["A", "B", "C", "D", "E", "F"].map((n) => seedProduct(categoryId, `Sản phẩm ${n}`, "10000")),
    );

    // So luong tang dan: F ban nhieu nhat (6), A it nhat (1).
    for (const [i, p] of products.entries()) {
      await seedOrder(userId, OrderStatus.PAID, [
        { productId: p.id, productName: p.name, unitPrice: "10000", quantity: i + 1 },
      ]);
    }
    // Don CANCELLED cua san pham A voi so luong khong lo — neu bi tinh vao thi A
    // se leo len dau bang.
    await seedOrder(userId, OrderStatus.CANCELLED, [
      { productId: products[0].id, productName: products[0].name, unitPrice: "10000", quantity: 999 },
    ]);

    const d: Dashboard = (await get(adminToken).expect(200)).body.data;

    expect(d.topProducts).toHaveLength(5);
    expect(d.topProducts.map((t) => t.quantitySold)).toEqual([6, 5, 4, 3, 2]);
    expect(d.topProducts.map((t) => t.name)).not.toContain("Sản phẩm A");
    expect(Number(d.topProducts[0].revenue)).toBe(60000);
  });

  it("hiện TÊN HIỆN TẠI của sản phẩm, không phải tên snapshot lúc đặt", async () => {
    const p = await seedProduct(categoryId, "Tên cũ", "10000");
    await seedOrder(userId, OrderStatus.PAID, [
      { productId: p.id, productName: "Tên cũ", unitPrice: "10000", quantity: 1 },
    ]);
    await prisma.product.update({ where: { id: p.id }, data: { name: "Tên mới" } });

    const d: Dashboard = (await get(adminToken).expect(200)).body.data;

    // Admin nhin bang nay de quyet dinh nhap hang → phai tim ra san pham bang ten
    // dang hien tren shop. Snapshot van con nguyen trong don hang, khong mat.
    expect(d.topProducts[0].name).toBe("Tên mới");
  });

  // ── ordersByStatus ────────────────────────────────────────────────────────

  it("đủ 5 dòng trạng thái kể cả trạng thái không có đơn nào", async () => {
    await seedOrder(userId, OrderStatus.PAID, []);
    await seedOrder(userId, OrderStatus.PAID, []);

    const d: Dashboard = (await get(adminToken).expect(200)).body.data;

    expect(d.ordersByStatus).toHaveLength(5);
    expect(d.ordersByStatus.map((s) => s.status).sort()).toEqual(
      [...Object.values(OrderStatus)].sort(),
    );

    const byStatus = Object.fromEntries(d.ordersByStatus.map((s) => [s.status, s.count]));
    expect(byStatus.PAID).toBe(2);
    // Dong bien mat thi nguoi doc tuong minh nhin thieu — "CANCELLED: 0" la mot
    // thong tin, khong phai rac.
    expect(byStatus.CANCELLED).toBe(0);
    expect(byStatus.PENDING).toBe(0);
  });
});
