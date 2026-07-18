import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../shared/errors";
import { insertWithUniqueSlug } from "../../shared/unique-slug";
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

/** Slug @unique tren toan bang → KHONG loc deletedAt (xem unique-slug.ts). */
async function findTakenSlugs(base: string): Promise<Set<string>> {
  const rows = await prisma.category.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  return new Set(rows.map((r) => r.slug));
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

async function create(input: CreateCategoryInput) {
  if (input.parentId) await assertParentUsable(input.parentId);

  // zod da dam bao name slugify ra khac rong.
  const created = await insertWithUniqueSlug(input.name, findTakenSlugs, (slug) =>
    prisma.category.create({
      data: {
        name: input.name,
        slug,
        parentId: input.parentId ?? null,
      },
      select: categorySelect,
    }),
  );

  await cacheDel(TREE_KEY);

  return created;
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
