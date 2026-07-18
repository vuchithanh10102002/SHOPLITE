import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import { TRANSITIONS, canTransition, assertTransition } from "../../modules/orders/order.state";
import { AppError } from "../../shared/errors";

/**
 * Unit test THUAN (khong DB) cho state machine BR1. Ma tran 5x5 = 25 case: moi
 * cap (from,to) phai khop dung ky vong allow/chan cua TRANSITIONS. Chot chan de
 * b5/b6 khong lo tay cho phep chuyen sai (vd PENDING→SHIPPED nhay coc qua PAID).
 */
describe("order state machine (BR1)", () => {
  const allStates = [
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.SHIPPED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ] as const;

  for (const from of allStates) {
    for (const to of allStates) {
      const allowed = TRANSITIONS[from].includes(to);
      it(`${from} → ${to}: ${allowed ? "OK" : "CHAN"}`, () => {
        expect(canTransition(from, to)).toBe(allowed);
        if (allowed) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow();
        }
      });
    }
  }

  // Chot cung so chuyen hop le = 5 (Handbook BR1). Neu ai them/bot nhanh trong
  // TRANSITIONS ma quen, test nay do do — vong lap tren chi kiem "khop bang",
  // khong biet bang co dung so luong khong.
  it("dung 5 chuyen hop le, khong hon khong kem", () => {
    const total = allStates.reduce((n, s) => n + TRANSITIONS[s].length, 0);
    expect(total).toBe(5);
  });

  it("assertTransition sai → AppError 409 INVALID_STATUS_TRANSITION", () => {
    try {
      assertTransition(OrderStatus.PENDING, OrderStatus.SHIPPED);
      expect.unreachable("le ra phai throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const err = e as AppError;
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe("INVALID_STATUS_TRANSITION");
    }
  });

  it("trang thai cuoi COMPLETED/CANCELLED khong di dau duoc", () => {
    expect(TRANSITIONS[OrderStatus.COMPLETED]).toEqual([]);
    expect(TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
  });
});
