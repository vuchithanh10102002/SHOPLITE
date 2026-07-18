import { OrderStatus } from "@prisma/client";
import { Errors } from "../../shared/errors";

/**
 * State machine don hang — code hoa BR1 (Handbook 6.5). Chi 5 chuyen hop le,
 * moi chuyen khac → 409 INVALID_STATUS_TRANSITION. Day la NGUON CHAN LY DUY NHAT
 * cho moi cho doi trang thai o cac buoc sau:
 *   b5 finalize payment (PENDING→PAID | PENDING→CANCELLED)
 *   b6 huy don (PENDING/PAID→CANCELLED) + admin doi trang thai (PAID→SHIPPED,
 *      SHIPPED→COMPLETED...)
 * Don moi luon vao PENDING (default o DB), khong nam trong bang nay vi khong
 * phai "chuyen" tu trang thai nao.
 *
 * COMPLETED/CANCELLED la trang thai cuoi (mang rong) → khong di dau duoc nua.
 *
 * TODO(FE): khi lam client, tach TRANSITIONS sang shared de dropdown admin import
 * chung, chi hien option hop le (Roadmap muc FE) — khong nhay coc duoc tu UI.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

/** True neu chuyen from→to hop le. Dung cho FE/admin liet ke option kha di. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Chan chuyen trang thai sai — throw AppError 409 de errorHandler boc envelope.
 * Goi TRONG transaction o service (b5/b6) TRUOC khi UPDATE status.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw Errors.invalidTransition(from, to);
}
