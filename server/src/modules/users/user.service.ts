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
  // De admin biet tai khoan co lich su mua hang khong truoc khi khoa. `_count` la
  // mot query JOIN duy nhat, khong phai N+1.
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
    // `mode: "insensitive"` o day la DUNG, khac product: user khong co cot
    // `nameNormalized` da bo dau. Doi lai "thanh" khong ra "Thành" — chap nhan o man
    // admin, nguoi ta thuong tim bang email.
    ...(q !== undefined && {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      // Khoa phu `id`: nhieu user tao cung mot giay (vd seed) thi thu tu khong xac
      // dinh → trang 2 lap dong cua trang 1. Cung ly do voi product list.
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
 * Khoa/mo tai khoan. MOT endpoint nhan `isActive` thay vi hai route block/unblock
 * (xem updateUserStatusSchema) → bam hai lan ra cung ket qua.
 *
 * Hai chan, deu co chu dich:
 *  - KHONG khoa duoc tai khoan ADMIN (ke ca chinh minh): mot admin khoa het cac
 *    admin con lai la khoa cung he thong. Muon ha mot admin thi doi role o DB truoc.
 *  - Khoa xong REVOKE het refresh token: khong thi ho van o trong phien cu them toi
 *    da 15 phut (access token da phat). Revoke cat duong gia han; 15 phut con lai la
 *    khoang ho da biet, doi lay viec khong phai tra ve DB moi request.
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
