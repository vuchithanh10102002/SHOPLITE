import { Prisma, PaymentStatus, OrderStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { assertTransition } from "../orders/order.state";
import { paymentProvider, PaymentDeclinedError } from "./payment.provider";

interface SettleInput {
  id: string;
  totalAmount: Prisma.Decimal;
  items: { productId: string; quantity: number }[];
}

/**
 * Finalize don PENDING (da tru kho o b4). Goi cong thanh toan NGOAI transaction —
 * khong giu connection DB mo trong luc cho I/O 200-800ms (chiem connection, khoa
 * row). Sau khi co ket qua chay transaction thu 2 ghi lai:
 *   OK   → order PAID + payment COMPLETED + history
 *   FAIL → hoan kho tung item + order CANCELLED + payment FAILED + history (BR2)
 *
 * Moi UPDATE order deu kem `status='PENDING'` (rowCount===0 → bo qua toan bo):
 * chong DOUBLE-PROCESS khi job quet don treo (b7) da CANCELLED truoc, hoac lo goi
 * finalize hai lan. `payments.order_id` UNIQUE la lop chot chong double-charge.
 *
 * Ham nay KHONG nem loi nghiep vu (declined) — don da chuyen CANCELLED goi la xong.
 * Chi nem loi HE THONG (mang/DB) de caller/job xu ly; luc do don ket PENDING va
 * job quet don treo (b7) don sau. Day la khoang ho da biet (Handbook 6.5 Q3).
 */
async function settlePayment(order: SettleInput): Promise<void> {
  let txnId: string;
  try {
    ({ txnId } = await paymentProvider.charge(order.id, order.totalAmount));
  } catch (e) {
    if (!(e instanceof PaymentDeclinedError)) throw e; // loi he thong: khong nuot

    // --- FAIL: compensation ---
    assertTransition(OrderStatus.PENDING, OrderStatus.CANCELLED); // BR1 cho phep
    await prisma.$transaction(async (tx) => {
      const affected = await tx.$executeRaw`
        UPDATE orders SET status = 'CANCELLED', updated_at = now()
        WHERE id = ${order.id}::uuid AND status = 'PENDING'`;
      if (affected === 0) return; // don khong con PENDING → da xu ly, dung ghi de/hoan kho lan 2

      // BR2: hoan kho khi CANCELLED tu PENDING. Cong tra dung so da tru o b4.
      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE products SET stock = stock + ${item.quantity}, updated_at = now()
          WHERE id = ${item.productId}::uuid`;
      }
      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          status: PaymentStatus.FAILED,
          providerTxnId: null,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CANCELLED,
          reason: "Thanh toán thất bại",
        },
      });
    });
    return;
  }

  // --- OK ---
  assertTransition(OrderStatus.PENDING, OrderStatus.PAID); // BR1 cho phep
  await prisma.$transaction(async (tx) => {
    const affected = await tx.$executeRaw`
      UPDATE orders SET status = 'PAID', updated_at = now()
      WHERE id = ${order.id}::uuid AND status = 'PENDING'`;
    if (affected === 0) return; // don khong con PENDING → da xu ly, dung tao payment trung

    await tx.payment.create({
      data: {
        orderId: order.id,
        amount: order.totalAmount,
        status: PaymentStatus.COMPLETED,
        providerTxnId: txnId,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: OrderStatus.PENDING,
        toStatus: OrderStatus.PAID,
        reason: "Thanh toán thành công",
      },
    });
  });
}

export const paymentService = { settlePayment };
