import { z } from "zod";
import { slugify } from "../../shared/slugify";

// slugify() tra "" khi ten khong con ky tu [a-z0-9] nao sau khi bo dau
// (vd "!!!", "日本"). Chan ngay tu input vi slug product cung sinh tu name —
// giong het ly do o category.schemas.
const name = z
  .string()
  .min(2, "Tên sản phẩm phải có ít nhất 2 ký tự")
  .max(200, "Tên sản phẩm tối đa 200 ký tự")
  .refine((v) => slugify(v).length > 0, "Tên phải chứa ít nhất một chữ cái hoặc số");

/**
 * Cot `price` la Decimal(12, 2) → 12 chu so tong, 2 chu so thap phan, con lai
 * 10 chu so phan nguyen. Khong chan tran o zod thi gia vuot nguong lot xuong
 * Prisma va no o tang DB → roi vao nhanh 500 thay vi 400 tu te.
 */
const MAX_PRICE = 9_999_999_999.99;

// z.positive() cua zod 4 tra ve mot CHECK ($ZodCheckGreaterThan), khong phai
// schema — no la manh de nhet vao .check(). Muon mot schema so thi phai di tu
// z.number(). Cung bay do: z.int()/z.uuid() lai LA schema that.
const price = z
  .number()
  .positive("Giá phải lớn hơn 0")
  .max(MAX_PRICE, "Giá vượt quá giới hạn cho phép")
  .multipleOf(0.01, "Giá tối đa 2 chữ số thập phân");

// min(0) chu khong phai positive(): stock = 0 la "het hang", mot trang thai
// hop le, khong phai input sai.
const stock = z.int().min(0, "Tồn kho không được âm");

const description = z.string().max(5000, "Mô tả tối đa 5000 ký tự");

const categoryId = z.uuid("categoryId không hợp lệ");

export const createProductSchema = z.object({
  name,
  categoryId,
  price,
  stock,
  description: description.optional(),
});

// PATCH = sua mot phan, nen MOI field deu optional. De sot mot field required
// thi doi moi cai ten cung bi 400 vi thieu field khong lien quan — va cai
// .refine() ben duoi thanh code chet (field required thi luon co mat).
export const updateProductSchema = z
  .object({
    name: name.optional(),
    categoryId: categoryId.optional(),
    price: price.optional(),
    stock: stock.optional(),
    // nullable: gui `description: null` la yeu cau xoa mo ta.
    // Phan biet voi `undefined` (khong dong toi) — service phai xu ly rieng,
    // giong `parentId` ben category.
    description: description.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Phải có ít nhất một trường để cập nhật");

export const productIdSchema = z.object({
  id: z.uuid("id không hợp lệ"),
});

// Route xoa anh mang CA hai param: /products/:id/images/:imageId. Validate ca
// hai la uuid truoc khi vao controller.
export const productImageParamsSchema = z.object({
  id: z.uuid("id không hợp lệ"),
  imageId: z.uuid("imageId không hợp lệ"),
});

/**
 * Khop dung cai ma slugify() sinh ra: chu thuong/so, gach noi ngan GIUA cac
 * cum, khong gach o hai dau, khong gach doi.
 *
 * GET /products/:slug tra theo slug chu khong theo id (handbook muc 6) — nen o
 * day KHONG dung z.uuid() nhu productIdSchema.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productSlugSchema = z.object({
  slug: z.string().regex(SLUG_PATTERN, "slug không hợp lệ"),
});

/**
 * Frontend bind filter vao URL nen field rong gui len la CHUOI RONG, khong
 * phai vang mat: `?minPrice=&page=`.
 *
 * z.coerce.number() bien "" thanh 0 chu khong phai undefined (Number("") === 0),
 * nen `?page=` se thanh page 0 → rot .positive() → 400 vo co. Phai bo chuoi
 * rong TRUOC khi coerce. Bat ca chuoi toan khoang trang cho chac.
 */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export const listProductQuerySchema = z
  .object({
    q: z.preprocess(blankToUndefined, z.string().trim().optional()),
    categoryId: z.preprocess(blankToUndefined, categoryId.optional()),
    minPrice: z.preprocess(
      blankToUndefined,
      z.coerce.number().nonnegative("minPrice không được âm").optional(),
    ),
    maxPrice: z.preprocess(
      blankToUndefined,
      z.coerce.number().nonnegative("maxPrice không được âm").optional(),
    ),
    // Whitelist cung: gia tri sort KHONG BAO GIO duoc di thang vao orderBy cua
    // Prisma. Service map enum nay sang object orderBy.
    sort: z.preprocess(
      blankToUndefined,
      z.enum(["price_asc", "price_desc", "newest"]).default("newest"),
    ),
    page: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().positive("page phải lớn hơn 0").default(1),
    ),
    // CLAMP chu khong reject: `?limit=999` ra 50 im lang, khong phai 400.
    // .transform() dat SAU .default() de ca hai duong (co gui / khong gui) deu
    // di qua clamp.
    limit: z.preprocess(
      blankToUndefined,
      z.coerce
        .number()
        .int()
        .positive("limit phải lớn hơn 0")
        .default(DEFAULT_LIMIT)
        .transform((v) => Math.min(v, MAX_LIMIT)),
    ),
    // Chi co hieu luc o route admin (controller public KHONG truyen no xuong
    // service). KHONG dung z.coerce.boolean(): Boolean("false") === true — moi
    // chuoi khac rong deu thanh true, `?includeDeleted=false` lai ra true (bug
    // im lang). So khop chuoi tuong minh: chi "true" moi la true.
    includeDeleted: z.preprocess(
      blankToUndefined,
      z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
    ),
  })
  .refine(
    (q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice,
    "minPrice không được lớn hơn maxPrice",
  );

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductQuery = z.infer<typeof listProductQuerySchema>;
