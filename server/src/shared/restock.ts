import { Prisma } from "@prisma/client";

/**
 * Hoan kho tung item — dung chung cho settlePayment nhanh FAIL, khach huy don va
 * admin chuyen CANCELLED (BR2), de ba cho khong lech nhau.
 *
 * `increment` sinh `UPDATE ... SET stock = stock + n`, nguyen tu, khong can dieu
 * kien — khac TRU kho luc dat hang phai co `WHERE stock >= n` chong oversell.
 *
 * Nhan `tx` chu KHONG phai prisma goc, de nam trong CUNG transaction voi buoc doi
 * trang thai don — rollback thi kho cung tra lai nguyen.
 */
export async function restockItems(
  tx: Prisma.TransactionClient,
  items: { productId: string; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}
