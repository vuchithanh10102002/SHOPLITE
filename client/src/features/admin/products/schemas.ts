import { z } from "zod";

/**
 * CHEP tu server/src/modules/products/product.schemas.ts — cung rule, cung
 * message tieng Viet (Handbook 7.3: validate hai lan, backend la chot cuoi).
 * Sua ben backend thi sua ca o day.
 *
 * KHAC ban backend mot cho co chu dich: backend co them
 * `.refine(slugify(name).length > 0)` — FE khong chep vi phai keo ca ham slugify
 * sang. Ten kieu "!!!" se bi backend tra 400 va form hien message do; hiem va
 * khong dang doi lay mot ban sao slugify de lech.
 */
const MAX_PRICE = 9_999_999_999.99;

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên sản phẩm phải có ít nhất 2 ký tự")
    .max(200, "Tên sản phẩm tối đa 200 ký tự"),

  categoryId: z.uuid("Vui lòng chọn danh mục"),

  /**
   * <input type="number"> qua react-hook-form `valueAsNumber` cho ra NaN khi o
   * trong. z.number() TU LOAI NaN (khong phai "expected number, received nan"
   * kho hieu — o day dat message tieng Viet cho ca hai truong hop).
   */
  price: z
    .number({ error: "Giá phải là số" })
    .positive("Giá phải lớn hơn 0")
    .max(MAX_PRICE, "Giá vượt quá giới hạn cho phép")
    .multipleOf(0.01, "Giá tối đa 2 chữ số thập phân"),

  // min(0) chu khong phai positive(): stock = 0 la "het hang", mot trang thai
  // hop le chu khong phai input sai.
  stock: z
    .number({ error: "Tồn kho phải là số" })
    .int("Tồn kho phải là số nguyên")
    .min(0, "Tồn kho không được âm"),

  description: z.string().max(5000, "Mô tả tối đa 5000 ký tự"),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * Kieu gui len API. `description` co BA trang thai va kieu phai noi duoc ca ba:
 * vang mat (khong dong toi), `null` (xoa mo ta), chuoi (dat mo ta) — xem toPayload.
 */
export interface ProductPayload {
  name: string;
  categoryId: string;
  price: number;
  stock: number;
  description?: string | null;
}

/**
 * `description: ""` tren form nghia la "khong co mo ta". Backend phan biet ba
 * thu: vang mat (khong dong toi), null (xoa mo ta), chuoi (dat mo ta).
 *  - Tao moi: chuoi rong → BO HAN field (khong gui "" xuong DB).
 *  - Sua: chuoi rong → gui `null` de XOA mo ta cu. Bo han thi backend hieu la
 *    "khong dong toi" va mo ta cu o lai — admin xoa het chu trong o roi bam Luu
 *    ma khong thay gi thay doi.
 */
export function toPayload(values: ProductFormValues, mode: "create" | "update"): ProductPayload {
  const description = values.description.trim();

  return {
    name: values.name,
    categoryId: values.categoryId,
    price: values.price,
    stock: values.stock,
    ...(description ? { description } : mode === "update" ? { description: null } : {}),
  };
}
