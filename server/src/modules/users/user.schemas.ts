import { z } from "zod";

// Bam khuon listProductQuerySchema: chuoi rong tu form/URL → undefined TRUOC khi
// coerce (neu khong `?page=` thanh page 0 → 400 vo co), clamp limit thay vi reject.
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export const listUserQuerySchema = z.object({
  // Tim theo email HOAC ho ten. Khong co cot normalized nhu product nen bo dau
  // khong tim duoc — chap nhan o man admin (xem user.service.ts).
  q: z.preprocess(blankToUndefined, z.string().trim().max(200).optional()),
  role: z.preprocess(blankToUndefined, z.enum(["CUSTOMER", "ADMIN"]).optional()),
  // KHONG z.coerce.boolean(): `Boolean("false") === true` → `?isActive=false` lai ra
  // true. Cung cai bay da chot o listProductQuerySchema.includeDeleted.
  isActive: z.preprocess(
    blankToUndefined,
    z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  ),
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

export const userIdSchema = z.object({
  id: z.uuid("id không hợp lệ"),
});

/**
 * Body la JSON nen `isActive` la boolean THAT — khong dinh bay chuoi "false" nhu
 * ben query string.
 *
 * MOT endpoint nhan ca hai chieu thay vi hai route block/unblock: client noi RO
 * trang thai muon co, bam hai lan ra cung ket qua — khong phai "toggle" ma hai admin
 * bam cung luc thi lat qua lat lai.
 */
export const updateUserStatusSchema = z.object({
  isActive: z.boolean("isActive phải là true hoặc false"),
});

export type ListUserQuery = z.infer<typeof listUserQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
