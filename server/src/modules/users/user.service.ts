import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../shared/errors";
import { PageMeta } from "../../shared/response";
import { ListUserQuery } from "./user.schemas";

/**
 * Quan ly nguoi dung — CHI admin (xem user.routes.ts). Pham vi co y hep theo
 * Roadmap 6.1 buoc 4: xem danh sach + khoa/mo tai khoan. KHONG co xoa (du lieu
 * user con duoc don hang tham chieu), KHONG cho doi role qua API (nang quyen la
 * viec phai lam co chu dich o DB, khong phai mot nut trong man admin).
 */

// passwordHash KHONG co trong select — khong phai "co roi loc o mapper", ma la
// khong bao gio doc len khoi DB. Cung tinh than nhu productSelect bo `publicId`.
const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  emailVerified: true,
  isActive: true,
  createdAt: true,
  // Dem don de admin biet tai khoan nay co lich su mua hang hay khong truoc khi
  // khoa. `_count` la mot query JOIN duy nhat, khong phai N+1.
  _count: { select: { orders: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: "CUSTOMER" | "ADMIN";
  emailVerified: boolean;
  isActive: boolean;
  orderCount: number;
  createdAt: Date;
}

// Liet ke tay tung field (khong `...rest`) — cung khuon toPublicProduct: them cot
// vao schema Prisma khong duoc tu dong lot ra API.
function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    emailVerified: row.emailVerified,
    isActive: row.isActive,
    orderCount: row._count.orders,
    createdAt: row.createdAt,
  };
}

async function listUsers(query: ListUserQuery): Promise<{ data: PublicUser[]; meta: PageMeta }> {
  const { q, role, isActive, page, limit } = query;

  const where: Prisma.UserWhereInput = {
    ...(role !== undefined && { role }),
    ...(isActive !== undefined && { isActive }),
    // `mode: "insensitive"` (ILIKE) o day la DUNG, khac product. Product co cot
    // `nameNormalized` da bo dau nen tim "ao" ra "Áo" — user khong co cot do,
    // ILIKE it nhat cho tim khong phan biet HOA/thuong. Bo dau van khong tim
    // duoc ("thanh" khong ra "Thành") — chap nhan o man admin, nguoi dung thuong
    // tim bang email.
    ...(q !== undefined && {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  // count + findMany song song: hai query doc lap, khong co ly do cho tuan tu.
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      // Khoa phu `id`: nhieu user tao cung mot giay (vd seed) thi orderBy
      // createdAt khong xac dinh thu tu giua chung → trang 2 lap dong cua trang 1.
      // Cung ly do da chot o product list.
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(toPublicUser),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

/**
 * Khoa/mo tai khoan.
 *
 * Vi sao MOT endpoint nhan `isActive` thay vi hai route block/unblock: xem
 * updateUserStatusSchema. Bam hai lan ra cung ket qua (idempotent).
 *
 * Hai chan, deu co chu dich:
 *  - KHONG khoa duoc tai khoan ADMIN (ke ca chinh minh): mot admin gian doi khoa
 *    het cac admin con lai la khoa cung he thong, khong con ai mo ra duoc. Muon
 *    ha mot admin thi doi role o DB truoc — viec do co y khong nam trong UI.
 *  - Khoa xong REVOKE het refresh token cua nguoi do. Neu khong, ho van o trong
 *    phien cu: `/auth/refresh` co kiem `isActive` (auth.service) nen se hong,
 *    nhung access token da phat thi song them toi da 15 phut. Revoke cat duong
 *    gia han; 15 phut con lai la khoang ho da biet, doi lay viec khong phai tra
 *    ve DB moi request.
 */
async function setUserStatus(userId: string, isActive: boolean): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user) throw Errors.notFound("người dùng");

  if (user.role === "ADMIN") {
    throw Errors.conflict("Không thể khóa/mở tài khoản quản trị viên", "CANNOT_LOCK_ADMIN");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: userSelect,
  });

  if (!isActive) {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  return toPublicUser(updated);
}

export const userService = {
  listUsers,
  setUserStatus,
};
