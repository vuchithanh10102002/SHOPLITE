import { Prisma } from "@prisma/client";
import { Readable } from "node:stream";
import type { UploadApiResponse } from "cloudinary";
import { prisma } from "../../lib/prisma";
import { cloudinary } from "../../lib/cloudinary";
import { Errors } from "../../shared/errors";
import { normalizeText } from "../../shared/slugify";
import { stockStatusOf, StockStatus } from "../../shared/stock";
import { assertRealImage } from "../../shared/image-magic";
import { insertWithUniqueSlug } from "../../shared/unique-slug";
import { PageMeta } from "../../shared/response";
import { CacheResult, remember, getVersion, bumpVersion } from "../../lib/cache";
import { CreateProductInput, ListProductQuery, UpdateProductInput } from "./product.schemas";

// `stock` va `deletedAt` CO trong select (can de tinh stockStatus / danh dau hang
// da xoa cho admin) nhung KHONG duoc ra khoi service — toPublicProduct() la cai
// chan. `publicId` cua anh KHONG select: id noi bo de xoa Cloudinary.
const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  stock: true,
  createdAt: true,
  deletedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    select: { id: true, url: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

// StockStatus da tach sang shared/stock.ts (cart cung xai); re-export cho cho quen.
export type { StockStatus };

// MOT bien dem chung cho CA list lan detail: moi write chi `incr` la ca hai loai
// key thanh mo coi. Doi lai su don gian nay: sua 1 san pham lam bay TOAN BO detail
// cache — chap nhan duoc o quy mo nay, va khoi phai biet slug luc delete.
const VER_KEY = "products:ver";

// Luoi an toan cuoi: incr co bug thi cache cu cung chi song them mot nhip.
const LIST_TTL = 60;
const DETAIL_TTL = 60;

export interface PublicImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  stockStatus: StockStatus;
  category: { id: string; name: string; slug: string };
  images: PublicImage[];
  createdAt: Date;
}

/**
 * CHO DUY NHAT hai viec xay ra: Decimal → string (chot mot cho, va nho the gia tri
 * vao cache da la string nen JSON round-trip khong lam bien dang), va `stock` →
 * `stockStatus` (handbook 6.3: public API khong duoc thay con so ton kho).
 *
 * Liet ke tay tung field chu KHONG `...rest`: spread thi mai sau them cot vao
 * schema Prisma la no tu dong lot ra API ma khong ai nhan ra. Ap dung cho ca
 * `images` ben trong.
 */
function toPublicProduct(row: ProductRow): PublicProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price.toString(),
    stockStatus: stockStatusOf(row.stock),
    category: row.category,
    images: row.images.map((img) => ({ id: img.id, url: img.url, sortOrder: img.sortOrder })),
    createdAt: row.createdAt,
  };
}

/**
 * = public + `deletedAt` + `stock`, chi cac ham tra AdminProduct moi lo hai field
 * nay. Man admin can biet cai nao da xoa va con bao nhieu hang; `stockStatus`
 * khong du de quyet dinh nhap hang, va form sua can gia tri that de do vao input.
 *
 * POST/PATCH /products van tra PublicProduct (co test khoa
 * `not.toHaveProperty("stock")`) — doi shape o do la pha hop dong da co.
 */
export interface AdminProduct extends PublicProduct {
  deletedAt: Date | null;
  stock: number;
}

function toAdminProduct(row: ProductRow): AdminProduct {
  return { ...toPublicProduct(row), deletedAt: row.deletedAt, stock: row.stock };
}

/** Slug @unique tren toan bang → KHONG loc deletedAt (xem unique-slug.ts). */
async function findTakenSlugs(base: string): Promise<Set<string>> {
  const rows = await prisma.product.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  return new Set(rows.map((r) => r.slug));
}

async function assertCategoryUsable(categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true },
  });
  if (!category) throw Errors.notFound("danh mục");
}

async function create(input: CreateProductInput): Promise<PublicProduct> {
  await assertCategoryUsable(input.categoryId);

  const created = await insertWithUniqueSlug(input.name, findTakenSlugs, (slug) =>
    prisma.product.create({
      data: {
        name: input.name,
        // name va nameNormalized PHAI di cung nhau — xem update().
        nameNormalized: normalizeText(input.name),
        slug,
        description: input.description ?? null,
        price: input.price,
        stock: input.stock,
        categoryId: input.categoryId,
      },
      select: productSelect,
    }),
  );

  // Bump SAU khi DB ghi xong (handbook 8.3: delete/version, khong update cache khi ghi).
  await bumpVersion(VER_KEY);

  return toPublicProduct(created);
}

async function update(id: string, input: UpdateProductInput): Promise<PublicProduct> {
  const current = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!current) throw Errors.notFound("sản phẩm");

  if (input.categoryId !== undefined) await assertCategoryUsable(input.categoryId);

  const updated = await prisma.product.update({
    where: { id },
    data: {
      // Ghi `name` ma quen `nameNormalized` thi search van tra ket qua theo ten CU —
      // bug im lang. Hai cot nay khong bao gio duoc tach roi.
      //
      // Doi ten KHONG doi slug: slug da nam trong URL nguoi ta luu (handbook 6.3).
      ...(input.name !== undefined && {
        name: input.name,
        nameNormalized: normalizeText(input.name),
      }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.stock !== undefined && { stock: input.stock }),
      // `null` = xoa mo ta; `undefined` = khong dong toi. Phai dung `!== undefined`
      // chu khong phai truthy check, neu khong `null` bi nuot.
      ...(input.description !== undefined && { description: input.description }),
    },
    select: productSelect,
  });

  await bumpVersion(VER_KEY);

  return toPublicProduct(updated);
}

/**
 * Soft delete. Khong chan nhu category (409 khi con san pham): product bi xoa van
 * con duoc tham chieu tu cart_items/order_items — don da dat phai giu duoc lich su.
 * Cart hien no kem co `isUnavailable` (handbook 6.4).
 */
async function remove(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw Errors.notFound("sản phẩm");

  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });

  await bumpVersion(VER_KEY);

  return { message: "Đã xóa sản phẩm" };
}

/**
 * Doi xung voi remove(): chi xoa dau `deletedAt`. Ba duong tu choi:
 *  - khong co id → 404.
 *  - co nhung dang song → 409, KHONG im lang tra "thanh cong": admin bam Khoi phuc
 *    mot dong dang song nghia la UI dang hien sai trang thai, nuot di thi khong ai biet.
 *  - danh muc cua no da bi xoa → 409: tha ra thi san pham hien o list public nhung
 *    khong nam trong cay danh muc nao. Bat admin doi danh muc truoc.
 */
async function restore(id: string): Promise<AdminProduct> {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, deletedAt: true, category: { select: { deletedAt: true } } },
  });
  if (!product) throw Errors.notFound("sản phẩm");
  if (product.deletedAt === null) {
    throw Errors.conflict("Sản phẩm đang hoạt động, không cần khôi phục", "PRODUCT_NOT_DELETED");
  }
  if (product.category.deletedAt !== null) {
    throw Errors.conflict(
      "Danh mục của sản phẩm đã bị xóa — đổi danh mục trước khi khôi phục",
      "CATEGORY_UNAVAILABLE",
    );
  }

  const restored = await prisma.product.update({
    where: { id },
    data: { deletedAt: null },
    select: productSelect,
  });

  await bumpVersion(VER_KEY);

  // AdminProduct: nguoi goi la man admin, ho can `deletedAt` (gio null) de cap nhat
  // dong trong bang ma khong phai fetch lai.
  return toAdminProduct(restored);
}

/**
 * Detail cho man admin: theo ID, THAY ca hang da xoa, co `stock` — `GET /:slug`
 * public khong cho cai nao (no loc `deletedAt: null` va giau stock).
 *
 * KHONG cache: doi lai form luon doc so ton kho MOI NHAT. Cache o day nghia la
 * admin sua gia dua tren so lieu cu toi 60s.
 */
async function getByIdAdmin(id: string): Promise<AdminProduct> {
  const row = await prisma.product.findUnique({ where: { id }, select: productSelect });
  if (!row) throw Errors.notFound("sản phẩm");

  return toAdminProduct(row);
}

/**
 * Cache-aside bang version key. Tra kem `hit` de controller ghi cache_hit vao
 * request log — service KHONG dung toi `res`.
 *
 * loader() nem notFound TRUOC khi remember kip setex → 404 KHONG bi cache lai; neu
 * cache negative thi product vua tao xong van bao 404 het mot nhip TTL.
 */
async function getBySlug(slug: string): Promise<CacheResult<PublicProduct>> {
  const ver = await getVersion(VER_KEY);
  const key = `products:detail:${ver}:${slug}`;

  return remember(key, DETAIL_TTL, async () => {
    const row = await prisma.product.findFirst({
      where: { slug, deletedAt: null },
      select: productSelect,
    });
    if (!row) throw Errors.notFound("sản phẩm");

    return toPublicProduct(row);
  });
}

/**
 * Whitelist sort → orderBy (zod da chan bang enum, day la lop thu hai).
 *
 * Khoa phu `id` o MOI nhanh: nhieu san pham cung gia thi Postgres duoc phep tra
 * thu tu khac nhau giua 2 query → trang 2 lap lai dong da thay o trang 1, hoac
 * nuot mat dong.
 */
const ORDER_BY: Record<ListProductQuery["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  price_asc: [{ price: "asc" }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { id: "asc" }],
  newest: [{ createdAt: "desc" }, { id: "asc" }],
};

/**
 * Chuoi khoa on dinh cho cache list: cung dieu kien phai ra cung mot chuoi, khac
 * dieu kien phai ra khac chuoi (neu khong: serve nham ket qua cua query khac).
 *
 * `q` di qua normalizeText GIONG HET luc query DB — key theo `q` tho thi "Áo" va
 * "áo" cache hai slot y het nhau. Field vang mat → chuoi rong, KHONG phai
 * "undefined": `?minPrice=0` va `?minPrice=` phai ra khac nhau.
 */
function paramsKey(q: ListProductQuery): string {
  return [
    normalizeText(q.q ?? ""),
    q.categoryId ?? "",
    q.minPrice ?? "",
    q.maxPrice ?? "",
    q.sort,
    q.page,
    q.limit,
  ].join("|");
}

/**
 * HAI TRUC DOC LAP, dung gop lam mot:
 *  - `adminView` = AI hoi → quyet dinh SHAPE tra ve va NAMESPACE cache.
 *  - `includeDeleted` = LOC GI → chi quyet dinh `where`.
 *
 * Truoc day mot co `includeDeleted` ganh ca hai viec, va do la BUG that: admin mo
 * bang voi o "hien ca hang da xoa" CHUA tick thi nhan PublicProduct → FE doc
 * `deletedAt` thay `undefined`, `undefined !== null` la TRUE nen MOI dong hien
 * "Da xoa". Bo loc khong duoc phep doi hop dong du lieu cua endpoint.
 */
async function list(
  query: ListProductQuery,
  opts?: { adminView?: boolean; includeDeleted?: boolean },
): Promise<CacheResult<{ data: PublicProduct[]; meta: PageMeta }>> {
  const { q, categoryId, minPrice, maxPrice, sort, page, limit } = query;

  const adminView = opts?.adminView ?? false;
  // Chi nhanh admin moi duoc thay hang da xoa.
  const includeDeleted = adminView && (opts?.includeDeleted ?? false);

  const where: Prisma.ProductWhereInput = {
    ...(!includeDeleted && { deletedAt: null }),
    ...(categoryId && { categoryId }),
    // Search tren cot da bo dau, va PHAI normalize ca `q`. KHONG dung
    // `mode: "insensitive"` (doan mau Roadmap dong 275 da bi muc 3.2 bac bo — hai
    // ve deu da lowercase nen mode chi thua).
    ...(q && { nameNormalized: { contains: normalizeText(q) } }),
    // `!== undefined` chu KHONG phai `minPrice &&`: minPrice = 0 la falsy.
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      price: {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      },
    }),
  };

  const ver = await getVersion(VER_KEY);
  // BAY POISONING: nhanh key bam theo `adminView`, KHONG theo `includeDeleted` — neu
  // khong thi ban AdminProduct (co `stock`!) nam trong o cache public va duoc phuc vu
  // cho khach. `includeDeleted` van phai co MAT trong key vi no doi tap dong tra ve.
  const key = adminView
    ? `products:list:adm:${includeDeleted}:${ver}:${paramsKey(query)}`
    : `products:list:${ver}:${paramsKey(query)}`;

  return remember(key, LIST_TTL, async () => {
    // Cung mot `where` de count va data khong the lech nhau.
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: productSelect,
        orderBy: ORDER_BY[sort],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // page vuot so trang → data rong + meta dung, KHONG phai 404.
    return {
      data: rows.map(adminView ? toAdminProduct : toPublicProduct),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

/**
 * upload_stream tra ve mot Writable — phai bom buffer vao roi doi callback, khong
 * co gi await san, nen boc trong Promise.
 */
function uploadToCloudinary(buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "shoplite/products", resource_type: "image" },
      (err, result) =>
        err || !result ? reject(err ?? new Error("Cloudinary upload thất bại")) : resolve(result),
    );
    Readable.from(buffer).pipe(stream);
  });
}

async function addImage(productId: string, file: Express.Multer.File): Promise<PublicImage> {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw Errors.notFound("sản phẩm");

  // Lop chan THAT (mimetype client khai chi la lop re): byte dau file phai dung la
  // anh. Chan TRUOC khi cham Cloudinary — file gia khong bao gio len storage.
  assertRealImage(file.buffer);

  // Dem thay vi max+1: chua co tinh nang sap xep lai nen them tuan tu cho cung ket
  // qua. Bay da biet: 2 upload dong thoi ra cung sortOrder.
  const sortOrder = await prisma.productImage.count({ where: { productId } });

  const uploaded = await uploadToCloudinary(file.buffer);

  const image = await prisma.productImage.create({
    data: {
      productId,
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      sortOrder,
    },
    select: { id: true, url: true, sortOrder: true },
  });

  await bumpVersion(VER_KEY);

  return image;
}

async function removeImage(productId: string, imageId: string) {
  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
    select: { id: true, publicId: true },
  });
  if (!image) throw Errors.notFound("ảnh");

  // Cloudinary TRUOC, DB SAU: destroy fail thi DB con giu tham chieu, khong bo lai
  // anh mo coi tren storage (Handbook 4.6). Thu tu nguoc lai la cach ro ri anh cu.
  await cloudinary.uploader.destroy(image.publicId);

  await prisma.productImage.delete({ where: { id: image.id } });

  await bumpVersion(VER_KEY);

  return { message: "Đã xóa ảnh" };
}

export const productService = {
  create,
  update,
  remove,
  restore,
  getByIdAdmin,
  getBySlug,
  list,
  addImage,
  removeImage,
};
