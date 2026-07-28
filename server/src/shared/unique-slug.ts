import { Prisma } from "@prisma/client";
import { Errors } from "./errors";
import { slugify } from "./slugify";

/**
 * Sinh slug duy nhat + insert, dung chung cho Category va Product.
 *
 * Tach ra khoi category.service KHONG phai vi DRY ma vi hai cai bay ben duoi
 * (probe-roi-van-phai-retry, khong-loc-deletedAt) qua tinh vi de ton tai o hai ban
 * copy. Khong nhet vao slugify.ts: file do la logic chuoi thuan, khong biet Prisma.
 */

/**
 * P2002 = vi pham unique constraint; errorHandler khong map loi Prisma nen khong
 * bat o day la roi vao nhanh 500. `meta.target` tuy phien ban co the la string[]
 * hoac string → ep ve text roi tim "slug".
 */
export function isSlugConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const target = err.meta?.target;
  const asText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return asText.includes("slug");
}

const MAX_SLUG_ATTEMPTS = 5;

/**
 * Tim slug con trong dang `base`, `base-2`, `base-3`...
 *
 * `findTaken` PHAI tra ve moi slug bat dau bang `base`, KHONG duoc loc
 * `deletedAt: null`: slug @unique tren toan bang, row da soft-delete VAN giu slug —
 * loc deletedAt se de xuat mot slug "trong" ma insert vao la vo unique constraint.
 */
async function findFreeSlug(
  base: string,
  findTaken: (base: string) => Promise<Set<string>>,
): Promise<string> {
  const taken = await findTaken(base);
  if (!taken.has(base)) return base;

  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Slugify `name`, tim slug trong, insert — retry khi dam unique constraint.
 *
 * Do slug trong roi VAN phai retry: giua luc do va luc insert, request khac co the
 * chiem mat slug do. Probe chi de giam va cham; retry moi la cai dam bao.
 *
 * Chu goi phai tu dam bao `name` slugify ra khac rong (zod da lo o schemas).
 */
export async function insertWithUniqueSlug<T>(
  name: string,
  findTaken: (base: string) => Promise<Set<string>>,
  insert: (slug: string) => Promise<T>,
): Promise<T> {
  const base = slugify(name);

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    try {
      return await insert(await findFreeSlug(base, findTaken));
    } catch (err) {
      if (isSlugConflict(err)) continue;
      throw err;
    }
  }

  throw Errors.conflict("Không tạo được slug duy nhất, vui lòng thử lại", "SLUG_CONFLICT");
}
