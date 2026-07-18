import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";

/**
 * Loi "the bi tu choi" — phan biet voi loi he thong (mang/DB). settlePayment CHI
 * coi PaymentDeclinedError la "fail nghiep vu" (→ hoan kho + CANCELLED); moi loi
 * khac nem tiep de khong nuot bug that.
 */
export class PaymentDeclinedError extends Error {
  constructor() {
    super("Thanh toán bị từ chối");
    this.name = "PaymentDeclinedError";
  }
}

export interface ChargeResult {
  txnId: string;
}

export interface PaymentProvider {
  charge(orderId: string, amount: Prisma.Decimal): Promise<ChargeResult>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cong thanh toan GIA LAP. Fail theo PAYMENT_FAIL_RATE de duong that bai duoc CHAY
 * THUONG XUYEN (Handbook 6.6) chu khong chi ton tai tren ly thuyet. Dat =1 de test
 * toan bo compensation, =0 khi demo.
 *
 * Tach sau interface PaymentProvider: khi thay cong that (VNPay/MoMo/Stripe) chi
 * thay implementation nay + them webhook IPN, khong dung toi settlePayment.
 */
export const paymentProvider: PaymentProvider = {
  async charge(_orderId, _amount) {
    await sleep(200 + Math.random() * 600);
    if (Math.random() < env.PAYMENT_FAIL_RATE) throw new PaymentDeclinedError();
    return { txnId: `txn_${randomUUID()}` };
  },
};
