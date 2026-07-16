import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../shared/errors";
import { slugify } from "../../shared/slugify";
import { CacheResult, cacheDel, remember } from "../../lib/cache";
import { CreateCategoryInput, UpdateCategoryInput } from "./category.schemas";

/**
 * MOT key duy nhat — GET /categories khong co query param nao.
 *
 * Vi the o day dung DEL, KHONG dung version key: version key sinh ra de invalidate
 * cac key co vo so bien the query param ma khong phai SCAN (handbook 8.2). Mot key
 * thi DEL thang la xong. Version key se dung o products list (Phase 3 buoc 3).
 */
const TREE_KEY = "categories:tree";

/** 5 phut — roadmap Phase 3 buoc 1. Cay danh muc doi vai lan mot thang. */
const TREE_TTL = 5 * 60;

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
} satisfies Prisma.CategorySelect;

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
}

/**
 * P2002 = vi pham unique constraint. errorHandler khong map loi Prisma, nen
 * P2002 khong bat o day se roi vao nhanh 500.
 *
 * `meta.target` tuy phien ban/driver co the la string[] hoac string → ep ve text
 * roi tim "slug" cho chac.
 */
function isSlugConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const target = err.meta?.target;
  const asText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return asText.includes("slug");
}

/**
 * Tim slug con trong dang `base`, `base-2`, `base-3`...
 *
 * KHONG loc `deletedAt: null`: cot slug @unique tren toan bang, category da
 * soft-delete VAN giu slug cua no. Loc deletedAt o day se de xuat mot slug
 * trong tren giay to nhung insert vao la vo unique constraint.
 */
async function findFreeSlug(base: string): Promise<string> {
  const rows = await prisma.category.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;

  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Cha phai ton tai, va phai la cap 1 — cha da co cha nghia la con nay se la cap 3. */
async function assertParentUsable(parentId: string) {
  const parent = await prisma.category.findFirst({
    where: { id: parentId, deletedAt: null },
    select: { id: true, parentId: true },
  });

  if (!parent) throw Errors.notFound("danh mục cha");
  if (parent.parentId) {
    throw Errors.badRequest("Danh mục chỉ được sâu tối đa 2 cấp", "MAX_DEPTH_EXCEEDED");
  }
}

const MAX_SLUG_ATTEMPTS = 5;

async function create(input: CreateCategoryInput) {
  if (input.parentId) await assertParentUsable(input.parentId);

  const base = slugify(input.name); // zod da dam bao khac rong

  // Do slug trong roi VAN phai retry: giua luc do va luc insert, mot request khac
  // co the chiem mat slug do. Probe chi de giam va cham; retry moi la cai dam bao.
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    try {
      const created = await prisma.category.create({
        data: {
          name: input.name,
          slug: await findFreeSlug(base),
          parentId: input.parentId ?? null,
        },
        select: categorySelect,
      });

      await cacheDel(TREE_KEY);

      return created;
    } catch (err) {
      if (isSlugConflict(err)) continue;
      throw err;
    }
  }

  throw Errors.conflict("Không tạo được slug duy nhất, vui lòng thử lại", "SLUG_CONFLICT");
}

async function update(id: string, input: UpdateCategoryInput) {
  const current = await prisma.category.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, parentId: true },
  });
  if (!current) throw Errors.notFound("danh mục");

  // `undefined` = khong dong toi parent; `null` = chuyen ve goc.
  if (input.parentId !== undefined && input.parentId !== current.parentId) {
    if (input.parentId === id) {
      throw Errors.badRequest("Danh mục không thể là cha của chính nó", "INVALID_PARENT");
    }

    if (input.parentId) {
      await assertParentUsable(input.parentId);

      // Category dang co con ma bi gan cha → cay thanh 3 cap.
      const childCount = await prisma.category.count({
        where: { parentId: id, deletedAt: null },
      });
      if (childCount > 0) {
        throw Errors.badRequest(
          "Danh mục đang có danh mục con nên không thể chuyển thành cấp 2",
          "MAX_DEPTH_EXCEEDED",
        );
      }
    }
  }

  // Doi `name` KHONG doi `slug`: slug da nam trong URL/link nguoi ta luu, doi la
  // gay 404 o cho khac. Slug chot mot lan luc tao.
  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
    },
    select: categorySelect,
  });

  await cacheDel(TREE_KEY);

  return updated;
}

async function remove(id: string) {
  const category = await prisma.category.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!category) throw Errors.notFound("danh mục");

  const [childCount, productCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id, deletedAt: null } }),
    prisma.product.count({ where: { categoryId: id, deletedAt: null } }),
  ]);

  if (childCount > 0) {
    throw Errors.conflict("Danh mục còn danh mục con, không thể xóa", "CATEGORY_NOT_EMPTY");
  }
  if (productCount > 0) {
    throw Errors.conflict("Danh mục còn sản phẩm, không thể xóa", "CATEGORY_NOT_EMPTY");
  }

  await prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });

  // Invalidate SAU khi DB ghi xong. Xoa cache truoc khi ghi la tu ban chan: giua
  // hai buoc do co request khac doc DB (con du lieu cu) roi nap lai cache cu.
  await cacheDel(TREE_KEY);

  return { message: "Đã xóa danh mục" };
}

/** Ca cay (2 cap) trong 1 query — build quan he o JS, khong recursive query. */
async function loadTree(): Promise<CategoryNode[]> {
  const rows = await prisma.category.findMany({
    where: { deletedAt: null },
    select: categorySelect,
    orderBy: { name: "asc" },
  });

  const nodes = new Map<string, CategoryNode>();
  for (const r of rows) {
    nodes.set(r.id, { id: r.id, name: r.name, slug: r.slug, children: [] });
  }

  const roots: CategoryNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    // Cha bi soft-delete → khong co trong `nodes`. Treo con len goc thay vi de no
    // bien mat khoi cay (khong ai xoa no ca).
    const parent = r.parentId ? nodes.get(r.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

/**
 * Tra kem `hit` de controller ghi cache_hit vao request log.
 *
 * Service KHONG dung toi `res` — no khong duoc biet gi ve Express. Controller la
 * cho duy nhat noi hai the gioi do gap nhau.
 */
async function getTree(): Promise<CacheResult<CategoryNode[]>> {
  return remember(TREE_KEY, TREE_TTL, loadTree);
}

export const categoryService = { create, update, remove, getTree };
