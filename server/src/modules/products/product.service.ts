import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../shared/errors";
import { normalizeText } from "../../shared/slugify";
import { insertWithUniqueSlug } from "../../shared/unique-slug";
import { PageMeta } from "../../shared/response";
import { CacheResult, remember, getVersion, bumpVersion } from "../../lib/cache";
import { CreateProductInput, ListProductQuery, UpdateProductInput } from "./product.schemas";

// `stock` CO trong select (can de tinh stockStatus) nhung KHONG duoc ra khoi
// service — toPublicProduct() la cai chan.
const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  stock: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

export type StockStatus = "in_stock" | "low" | "out";

/** Nguong "sap het". Chon o day chu khong luu DB — chua co yeu cau cau hinh theo san pham. */
const LOW_STOCK_THRESHOLD = 5;

function stockStatusOf(stock: number): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "in_stock";
}

// ── Cache: version key (handbook 8.2, roadmap Phase 3 buoc 3) ────────────────
// MOT bien dem duy nhat cho CA list va detail: moi write chi `incr` no la ca hai
// loai key deu thanh "mo coi". Doi lay su don gian nay, sua 1 san pham lam bay
// TOAN BO detail cache chu khong rieng cai vua sua — o quy mo nay chap nhan
// duoc, va khoi phai biet slug luc delete. Day dung la huong "version cho ca
// list + detail" da chot.
const VER_KEY = "products:ver";

// TTL 60s (handbook 8.2) — luoi an toan cuoi. Ke ca incr co bug thi cache cu
// cung chi song them toi da mot nhip 60s.
const LIST_TTL = 60;
const DETAIL_TTL = 60;

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  stockStatus: StockStatus;
  category: { id: string; name: string; slug: string };
  createdAt: Date;
}

/**
 * CHO DUY NHAT hai viec xay ra:
 *
 *  1. Decimal → string. Prisma tra `price` la Decimal object; de no tu serialize
 *     ra JSON thi frontend nhan duoc thu khong doan truoc. Chot mot cho, khong
 *     rai `.toString()` moi controller (roadmap 3.2). Cung nho the ma gia tri
 *     dem vao cache da la string san — JSON round-trip khong lam bien dang.
 *  2. `stock` (so that, thong tin noi bo) → `stockStatus`. Handbook 6.3: public
 *     API khong duoc thay con so ton kho.
 *
 * Liet ke tay tung field chu KHONG `...rest`: spread thi mai sau them cot vao
 * schema Prisma la no tu dong lot ra API ma khong ai nhan ra.
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
    createdAt: row.createdAt,
  };
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

  // Co san pham moi → cache list/detail cu deu lac hau. Bump SAU khi DB ghi
  // xong (handbook 8.3: delete/version, khong update cache khi ghi).
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
      // Ghi `name` ma quen `nameNormalized` thi search van tra ket qua theo ten
      // CU — bug im lang, khong ai thay cho den luc co nguoi tim khong ra hang.
      // Hai cot nay khong bao gio duoc tach roi.
      //
      // Doi ten KHONG doi slug: slug da nam trong URL/link nguoi ta luu
      // (handbook 6.3, va la quyet dinh da chot o buoc 1 voi category).
      ...(input.name !== undefined && {
        name: input.name,
        nameNormalized: normalizeText(input.name),
      }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.stock !== undefined && { stock: input.stock }),
      // `null` = xoa mo ta; `undefined` = khong dong toi. Phai dung
      // `!== undefined` chu khong phai truthy check, neu khong `null` bi nuot.
      ...(input.description !== undefined && { description: input.description }),
    },
    select: productSelect,
  });

  // Day dung cai test DoD kiem: sua 1 san pham → version tang → list lan sau miss.
  await bumpVersion(VER_KEY);

  return toPublicProduct(updated);
}

/**
 * Soft delete. Khong chan nhu category (409 khi con san pham): product bi xoa
 * van con duoc tham chieu tu cart_items/order_items — don da dat phai giu duoc
 * lich su. Cart se hien co `isUnavailable` (handbook 6.4).
 */
async function remove(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw Errors.notFound("sản phẩm");

  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });

  // San pham vua an di khoi list/detail → cache cu con tra no ra la sai.
  await bumpVersion(VER_KEY);

  return { message: "Đã xóa sản phẩm" };
}

/**
 * Cache-aside bang version key. Tra kem `hit` de controller ghi cache_hit vao
 * request log — service KHONG dung toi `res`, controller la cho hai the gioi gap.
 *
 * Ver nam TRONG key (`products:detail:<ver>:<slug>`) nen khong can xoa gi khi
 * ghi: mot lan bumpVersion o create/update/remove la key cu thanh mo coi.
 *
 * loader() nem notFound TRUOC khi remember kip setex → 404 KHONG bi cache lai.
 * Dung y muon: neu cache negative, product vua tao xong van bao 404 het mot nhip
 * TTL.
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
 * Whitelist sort → orderBy. Gia tri sort KHONG BAO GIO duoc di thang vao
 * orderBy; zod da chan bang enum, day la lop chan thu hai.
 *
 * Khoa phu `id` o MOI nhanh: nhieu san pham cung gia thi `orderBy price` khong
 * xac dinh thu tu giua chung, Postgres duoc phep tra khac nhau giua 2 query →
 * trang 2 lap lai dong da thay o trang 1, hoac nuot mat dong. Phan trang on
 * dinh can mot khoa duy nhat o cuoi.
 */
const ORDER_BY: Record<ListProductQuery["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  price_asc: [{ price: "asc" }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { id: "asc" }],
  newest: [{ createdAt: "desc" }, { id: "asc" }],
};

/**
 * Chuoi khoa on dinh cho cache list — GOP tu cac field da validate, thu tu co
 * dinh. Hai request cung dieu kien phai ra cung mot chuoi; khac dieu kien phai
 * ra khac chuoi (neu khong: serve nham ket qua cua query khac).
 *
 * `q` di qua normalizeText GIONG HET luc query DB: "Áo" va "áo" cho cung ket
 * qua (deu tra cot nameNormalized chua "ao"); key theo `q` tho thi cache hai
 * slot y het nhau — dung nhung phi hit rate.
 *
 * Field vang mat → chuoi rong, KHONG phai chuoi "undefined": `?minPrice=0` va
 * `?minPrice=` phai ra khac nhau. sort/page/limit luon co (zod .default).
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

async function list(
  query: ListProductQuery,
): Promise<CacheResult<{ data: PublicProduct[]; meta: PageMeta }>> {
  const { q, categoryId, minPrice, maxPrice, sort, page, limit } = query;

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(categoryId && { categoryId }),
    // Search tren cot da bo dau, va PHAI normalize ca `q`: nguoi ta go "Áo" thi
    // "áo" khong khop gi voi cot nameNormalized (dang chua "ao").
    //
    // KHONG dung `mode: "insensitive"` nhu doan mau o Roadmap dong 275 — doan do
    // da bi chinh muc 3.2 bac bo, va la ly do cot nameNormalized ra doi. Hai ve
    // deu da lowercase nen mode chi thua.
    ...(q && { nameNormalized: { contains: normalizeText(q) } }),
    // `!== undefined` chu KHONG phai `minPrice &&`: minPrice = 0 la falsy, dung
    // truthy check thi `?minPrice=0` bi vut im lang.
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      price: {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      },
    }),
  };

  const ver = await getVersion(VER_KEY);
  const key = `products:list:${ver}:${paramsKey(query)}`;

  return remember(key, LIST_TTL, async () => {
    // 2 query song song — cung mot `where` de count va data khong the lech nhau.
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

    // page vuot so trang → data rong + meta dung, KHONG phai 404. "Trang 999
    // khong co gi" la mot cau tra loi hop le, khong phai loi.
    return {
      data: rows.map(toPublicProduct),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export const productService = { create, update, remove, getBySlug, list };
