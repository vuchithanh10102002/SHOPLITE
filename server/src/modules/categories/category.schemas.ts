import { z } from "zod";
import { slugify } from "../../shared/slugify";

// slugify() tra "" khi ten khong con ky tu [a-z0-9] nao sau khi bo dau
// (vd "!!!", "日本"). Chan ngay tu input thay vi de service phai bia slug thay
// nguoi dung — sai tu dau vao thi bao loi o dau vao.
const name = z
  .string()
  .min(2, "Tên danh mục phải có ít nhất 2 ký tự")
  .max(100, "Tên danh mục tối đa 100 ký tự")
  .refine((v) => slugify(v).length > 0, "Tên phải chứa ít nhất một chữ cái hoặc số");

export const createCategorySchema = z.object({
  name,
  parentId: z.uuid("parentId không hợp lệ").optional(),
});

export const updateCategorySchema = z
  .object({
    name: name.optional(),
    // nullable: gui `parentId: null` la yeu cau chuyen category ve goc.
    // Phan biet voi `undefined` (khong dong toi parent) — xem service.
    parentId: z.uuid("parentId không hợp lệ").nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Phải có ít nhất một trường để cập nhật");

export const categoryIdSchema = z.object({
  id: z.uuid("id không hợp lệ"),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
