import { z } from "zod";

// Dia chi giao hang: bat buoc, do dai vua phai. Don gian o phase nay — chua tach
// tinh/huyen/xa, chi mot chuoi (Handbook 6.5 khong yeu cau dia chi co cau truc).
export const createOrderSchema = z.object({
  shippingAddress: z
    .string()
    .trim()
    .min(5, "Địa chỉ giao hàng quá ngắn")
    .max(500, "Địa chỉ giao hàng tối đa 500 ký tự"),
});

/**
 * Idempotency-Key di trong HEADER (khong phai body/query/params) → khong dung
 * duoc validate/validateQuery/validateParams. Controller doc `req.header(...)`
 * roi parse bang schema nay. Client tu sinh key (thuong la uuid) va gui lai Y
 * NGUYEN khi retry → server nhan ra "cung mot lan dat" ma khong tao don thu 2.
 */
export const idempotencyKeySchema = z
  .string({ error: "Thiếu header Idempotency-Key" })
  .trim()
  .min(1, "Idempotency-Key không được rỗng")
  .max(200, "Idempotency-Key quá dài");

// Phan trang đơn của tôi. Bám khuôn listProductQuerySchema: chuoi rong → undefined
// truoc khi coerce, clamp limit thay vi reject.
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export const listOrderQuerySchema = z.object({
  page: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive("page phải lớn hơn 0").default(1),
  ),
  limit: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .positive("limit phải lớn hơn 0")
      .default(DEFAULT_LIMIT)
      .transform((v) => Math.min(v, MAX_LIMIT)),
  ),
});

export const orderIdSchema = z.object({
  id: z.uuid("id không hợp lệ"),
});

// Admin đổi trạng thái: KHÔNG cho set PENDING (không transition nào tới PENDING);
// tính hợp lệ của bước chuyển do assertTransition (order.state) quyết, schema chỉ
// chặn giá trị rác. 4 đích khả dĩ.
export const adminUpdateStatusSchema = z.object({
  status: z.enum(["PAID", "SHIPPED", "COMPLETED", "CANCELLED"], "Trạng thái không hợp lệ"),
});

// Admin lọc đơn theo trạng thái / user (đủ cả 5 trạng thái để lọc). page/limit như trên.
export const listAdminOrderQuerySchema = z.object({
  page: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive("page phải lớn hơn 0").default(1),
  ),
  limit: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .positive("limit phải lớn hơn 0")
      .default(DEFAULT_LIMIT)
      .transform((v) => Math.min(v, MAX_LIMIT)),
  ),
  status: z.preprocess(
    blankToUndefined,
    z.enum(["PENDING", "PAID", "SHIPPED", "COMPLETED", "CANCELLED"]).optional(),
  ),
  userId: z.preprocess(blankToUndefined, z.uuid("userId không hợp lệ").optional()),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrderQuery = z.infer<typeof listOrderQuerySchema>;
export type AdminUpdateStatusInput = z.infer<typeof adminUpdateStatusSchema>;
export type ListAdminOrderQuery = z.infer<typeof listAdminOrderQuerySchema>;
