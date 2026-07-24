import { z } from "zod";

/**
 * CHEP tu server/src/modules/orders/order.schemas.ts — cung rule, cung message
 * tieng Viet, de loi hien ngay tren form giong het loi backend tra ve neu lot
 * qua duoc (Handbook 7.3). Sua ben backend thi sua ca o day.
 *
 * .trim() nam TRUOC min(5): "     " (5 khoang trang) phai rot, khong duoc tinh
 * la dia chi hop le.
 */
export const checkoutSchema = z.object({
  shippingAddress: z
    .string()
    .trim()
    .min(5, "Địa chỉ giao hàng quá ngắn")
    .max(500, "Địa chỉ giao hàng tối đa 500 ký tự"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
