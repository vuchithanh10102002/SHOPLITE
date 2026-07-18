import { Prisma, OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../shared/errors";
import { PageMeta } from "../../shared/response";
import { emailQueue } from "../../lib/queue";
import { paymentService } from "../payments/payment.service";
import { CreateOrderInput, ListOrderQuery } from "./order.schemas";

// ---- Public shapes (lo tap con field, khong bao gio ...rest) ----

export interface PublicOrderItem {
  productId: string;
  productName: string; // SNAPSHOT luc dat — KHONG doc ten product hien tai
  unitPrice: string; // SNAPSHOT gia luc dat, Decimal → string
  quantity: number;
}

export interface PublicOrderHistory {
  fromStatus: OrderStatus | null; // ban ghi dau (tao don) khong co trang thai truoc
  toStatus: OrderStatus;
  reason: string | null;
  createdAt: Date;
}

export interface PublicPayment {
  status: PaymentStatus;
  amount: string; // Decimal → string
  providerTxnId: string | null;
  createdAt: Date;
}

export interface PublicOrder {
  id: string;
  status: OrderStatus;
  totalAmount: string; // Decimal → string
  shippingAddress: string;
  createdAt: Date;
  items: PublicOrderItem[];
  history: PublicOrderHistory[];
  payment: PublicPayment | null; // null truoc khi finalize; co sau b5
}

// Detail lay ca userId (kiem IDOR) + items + history. userId KHONG lo ra ngoai.
const orderDetailSelect = {
  id: true,
  userId: true,
  status: true,
  totalAmount: true,
  shippingAddress: true,
  createdAt: true,
  items: {
    select: { productId: true, productName: true, unitPrice: true, quantity: true },
    orderBy: { id: "asc" },
  },
  history: {
    select: { fromStatus: true, toStatus: true, reason: true, createdAt: true },
    orderBy: { id: "asc" },
  },
  payment: { select: { status: true, amount: true, providerTxnId: true, createdAt: true } },
} satisfies Prisma.OrderSelect;

type OrderDetailRow = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;

function toPublicOrder(row: OrderDetailRow): PublicOrder {
  return {
    id: row.id,
    status: row.status,
    totalAmount: row.totalAmount.toString(),
    shippingAddress: row.shippingAddress,
    createdAt: row.createdAt,
    items: row.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      unitPrice: i.unitPrice.toString(),
      quantity: i.quantity,
    })),
    history: row.history.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      reason: h.reason,
      createdAt: h.createdAt,
    })),
    payment: row.payment && {
      status: row.payment.status,
      amount: row.payment.amount.toString(),
      providerTxnId: row.payment.providerTxnId,
      createdAt: row.payment.createdAt,
    },
  };
}

// Summary cho list: nhe hon detail, khong keo items/history.
export interface PublicOrderSummary {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  itemCount: number;
  createdAt: Date;
}

const orderSummarySelect = {
  id: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

type OrderSummaryRow = Prisma.OrderGetPayload<{ select: typeof orderSummarySelect }>;

function toPublicOrderSummary(row: OrderSummaryRow): PublicOrderSummary {
  return {
    id: row.id,
    status: row.status,
    totalAmount: row.totalAmount.toString(),
    itemCount: row._count.items,
    createdAt: row.createdAt,
  };
}

/**
 * Dat hang — TRAI TIM cua phase (Handbook 6.5). Chong oversell bang conditional
 * UPDATE trong transaction, idempotent qua Idempotency-Key.
 *
 * Tra ve { order, replayed }: replayed=true khi la lan goi lai cung key (khong
 * tao don moi) → controller van tra 200/201 binh thuong, khong bao loi.
 *
 * Luu y: don dung o PENDING sau buoc nay. Goi payment (→ PAID / hoan kho +
 * CANCELLED) lam o b5, NGOAI transaction nay.
 */
async function createOrder(
  userId: string,
  idempotencyKey: string,
  input: CreateOrderInput,
): Promise<{ order: PublicOrder; replayed: boolean }> {
  // 1. IDEMPOTENCY replay: da co don voi (userId, key) → tra luon, khong tao lai.
  const existing = await prisma.order.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    select: orderDetailSelect,
  });
  if (existing) return { order: toPublicOrder(existing), replayed: true };

  // Doc gio + product cua tung item. KHONG loc deletedAt o day de con phat hien
  // item cua product da xoa (BR5) — chan checkout thay vi de trong tuot.
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      id: true,
      items: {
        select: {
          quantity: true,
          product: { select: { id: true, name: true, price: true, deletedAt: true } },
        },
      },
    },
  });
  if (!cart || cart.items.length === 0) {
    throw Errors.badRequest("Giỏ hàng trống", "CART_EMPTY");
  }

  // BR5: co item cua product da soft-delete → khong cho dat. Bao ro san pham nao.
  const dead = cart.items.find((i) => i.product.deletedAt !== null);
  if (dead) {
    throw Errors.badRequest(`"${dead.product.name}" không còn được bán`, "PRODUCT_UNAVAILABLE");
  }

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        // 2. Tru kho tung item bang CONDITIONAL UPDATE (check-and-set nguyen tu).
        // KHONG SELECT-roi-IF-roi-UPDATE (TOCTOU race). KHONG updateMany (khong
        // biet item nao fail). rowCount === 0 nghia la stock < quantity HOAC vua
        // bi xoa → throw → auto ROLLBACK ca cac tru kho truoc do.
        for (const item of cart.items) {
          const affected = await tx.$executeRaw`
            UPDATE products SET stock = stock - ${item.quantity}, updated_at = now()
            WHERE id = ${item.product.id}::uuid
              AND stock >= ${item.quantity}
              AND deleted_at IS NULL`;
          if (affected === 0) throw Errors.insufficientStock(item.product.name);
        }

        // 3. Total tinh o SERVER bang Decimal (khong tin so client gui). Gia lay
        // tu DB (product.price), nhan so luong, cong don — khong dinh sai so float.
        const total = cart.items.reduce(
          (sum, i) => sum.plus(i.product.price.times(i.quantity)),
          new Prisma.Decimal(0),
        );

        // 4. Order + items(SNAPSHOT) + history PENDING — mot lenh create long nhau.
        const order = await tx.order.create({
          data: {
            userId,
            idempotencyKey,
            shippingAddress: input.shippingAddress,
            totalAmount: total,
            status: OrderStatus.PENDING,
            items: {
              create: cart.items.map((i) => ({
                productId: i.product.id,
                productName: i.product.name, // SNAPSHOT: doi ten product sau nay khong doi don cu
                unitPrice: i.product.price, // SNAPSHOT: gia luc mua, khong doc gia hien tai
                quantity: i.quantity,
              })),
            },
            history: { create: { toStatus: OrderStatus.PENDING, reason: "Đơn được tạo" } },
          },
          select: orderDetailSelect,
        });

        // 5. Xoa gio SAU khi dat thanh cong — trong cung tx, rollback thi gio con nguyen.
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    // Ghi chu chu dich: KHONG bumpVersion(products) o day du stock da doi. Order la
    // ghi cua customer, rat thuong xuyen — bump moi don se dap sach cache product
    // lien tuc, hong muc dich cache. stockStatus hien thi tre toi da 60s (TTL) la
    // chap nhan duoc; chan cung that su nam o conditional UPDATE tren, khong o cache.

    // FINALIZE (b5): goi thanh toan NGOAI tx tru kho → PAID hoac hoan kho +
    // CANCELLED. Don dong bo o day nen response phan anh trang thai cuoi.
    await paymentService.settlePayment({
      id: created.id,
      totalAmount: created.totalAmount,
      items: created.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    // Email SAU khi settle va NGOAI moi transaction — email khong hoan tac duoc
    // neu tx rollback. Payload chi mang orderId; worker doc DB → trang thai THAT
    // (PAID/CANCELLED) tai luc gui. Ca duong thanh cong lan that bai deu bao.
    await emailQueue.add("order-status", { orderId: created.id });

    // Doc lai detail de phan anh status cuoi + payment record vua tao trong settle.
    const settled = await prisma.order.findUnique({
      where: { id: created.id },
      select: orderDetailSelect,
    });
    return { order: toPublicOrder(settled!), replayed: false };
  } catch (e) {
    // 6. RACE cung idempotency key: 2 request cung vao (ca hai thay "chua ton tai"
    // o buoc 1), 1 thang, 1 vuong UNIQUE(userId, key) → P2002. Con lai roll back
    // sach (ke ca tru kho). Tra ve don ke thang da tao → client thay ket qua nhat
    // quan du goi 2 lan.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const winner = await prisma.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        select: orderDetailSelect,
      });
      if (winner) return { order: toPublicOrder(winner), replayed: true };
    }
    throw e;
  }
}

/**
 * Chi tiet mot don. IDOR: don CUA TOI hoac ADMIN moi xem duoc; nguoi khac → 404
 * (khong lo su ton tai), giong rang buoc cart.userId.
 */
async function getOrderById(
  id: string,
  requester: { id: string; role: string },
): Promise<PublicOrder> {
  const order = await prisma.order.findUnique({ where: { id }, select: orderDetailSelect });
  if (!order || (order.userId !== requester.id && requester.role !== "ADMIN")) {
    throw Errors.notFound("đơn hàng");
  }
  return toPublicOrder(order);
}

/** Don cua toi, moi nhat truoc. Khoa phu `id` cho phan trang on dinh (bam khuon product list). */
async function listMyOrders(
  userId: string,
  query: ListOrderQuery,
): Promise<{ data: PublicOrderSummary[]; meta: PageMeta }> {
  const { page, limit } = query;
  const where: Prisma.OrderWhereInput = { userId };

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderSummarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(toPublicOrderSummary),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export const orderService = { createOrder, getOrderById, listMyOrders };
