import { Prisma } from "@prisma/client";

/**
 * Hoan kho tung item (cong tra so luong da tru luc dat hang). Dung chung o:
 *   - settlePayment nhanh FAIL (b5): thanh toan that bai → tra kho
 *   - huy don (b6): khach huy / admin chuyen CANCELLED → tra kho (BR2)
 * Mot cho de logic khong lech nhau.
 *
 * `increment` sinh `UPDATE ... SET stock = stock + n` — nguyen tu, khong doc-roi-ghi.
 * Khong can dieu kien (cong kho luon thanh cong), khac voi TRU kho luc dat hang
 * phai co `WHERE stock >= n` chong oversell.
 *
 * Nhan `tx` (KHONG phai prisma goc) de nam trong CUNG transaction voi buoc doi
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
