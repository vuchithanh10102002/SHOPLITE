import bcrypt from "bcrypt";
import { prisma } from "../../lib/prisma";
import {
  generateAccessToken,
  generateEmailToken,
  generateRefreshToken,
  sha256,
} from "./token.service";
import { LoginInput, RegisterInput } from "./auth.schemas";
import { emailQueue } from "../../lib/queue";
import { addDays, addHours } from "date-fns";
import { randomUUID } from "node:crypto";
import { Errors } from "../../shared/errors";
import { env } from "../../config/env";
import logger from "../../lib/logger";

function hashPassword(password: string) {
  return bcrypt.hash(password, env.BCRYPT_COST);
}

async function register(data: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) throw Errors.emailExists();

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      passwordHash,
    },
  });

  const verifyToken = generateEmailToken();

  await prisma.emailToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(verifyToken),
      type: "VERIFY",
      expiresAt: addHours(new Date(), 24),
    },
  });

  await emailQueue.add("verify-email", {
    email: user.email,
    fullName: user.fullName,
    token: verifyToken,
  });

  return {
    message:
      "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
  };
}

/**
 * BR4: user chua verify VAN login duoc (chi khong dat hang duoc).
 * Claim `verified` di theo access token de middleware requireVerified doc o Phase 4.
 */
async function login(data: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  // So sanh password ngay ca khi khong tim thay user → tranh timing attack
  // lo ra email nao ton tai (bcrypt.compare voi hash gia van ton dung thoi gian).
  const passwordHash = user?.passwordHash ?? (await hashPassword(randomUUID()));
  const matched = await bcrypt.compare(data.password, passwordHash);

  if (!user || !matched) throw Errors.invalidCredentials();
  if (!user.isActive) throw Errors.forbidden();

  const accessToken = generateAccessToken({
    sub: user.id,
    role: user.role,
    verified: user.emailVerified,
  });

  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      familyId: randomUUID(), // moi lan login = mot chuoi rotation moi
      tokenHash: sha256(refreshToken),
      expiresAt: addDays(new Date(), 7),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  };
}

async function refresh(refreshToken: string) {
  // Token la chuoi ngau nhien, khong decode duoc → nguon chan ly duy nhat la DB.
  const tokenHash = sha256(refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!storedToken) throw Errors.unauthorized();

  // REUSE DETECTION: token da revoked ma van duoc dung → ke gian dang giu token cu.
  // Revoke ca family: moi phien sinh ra tu lan login do deu chet, buoc login lai.
  if (storedToken.revoked) {
    await prisma.refreshToken.updateMany({
      where: { familyId: storedToken.familyId },
      data: { revoked: true },
    });

    logger.warn(
      { userId: storedToken.userId, familyId: storedToken.familyId },
      "refresh token reuse detected — revoked toan bo family"
    );

    throw Errors.unauthorized();
  }

  if (storedToken.expiresAt < new Date()) throw Errors.unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: storedToken.userId },
  });

  if (!user || !user.isActive) throw Errors.unauthorized();

  const accessToken = generateAccessToken({
    sub: user.id,
    role: user.role,
    verified: user.emailVerified,
  });

  const newRefreshToken = generateRefreshToken();

  // Rotate: revoke token cu + tao token moi CUNG family, trong 1 transaction.
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: storedToken.familyId,
        tokenHash: sha256(newRefreshToken),
        expiresAt: addDays(new Date(), 7),
      },
    }),
  ]);

  return { accessToken, refreshToken: newRefreshToken };
}

async function logout(refreshToken: string | undefined) {
  // Logout phai idempotent: khong co cookie / token rac → van coi nhu thanh cong,
  // controller van clear cookie. Bao loi o day chi lam client mac ket.
  if (!refreshToken) return { message: "Đăng xuất thành công" };

  // updateMany (khong phai update): token khong ton tai → count 0, khong throw P2025.
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken) },
    data: { revoked: true },
  });

  return { message: "Đăng xuất thành công" };
}

async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  const message =
    "Nếu email tồn tại trong hệ thống, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.";

  // Luon tra 200 cung mot message — khong de lo email nao co trong he thong.
  if (!user) return { message };

  const token = generateEmailToken();

  await prisma.emailToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      type: "RESET",
      expiresAt: addHours(new Date(), 1),
    },
  });

  await emailQueue.add("reset-password", {
    email: user.email,
    fullName: user.fullName,
    token,
  });

  return { message };
}

/**
 * Doc email token dung 1 lan: tim theo hash, check dung type + chua het han.
 * Tra ve ban ghi de caller xoa trong cung transaction voi hanh dong chinh.
 */
async function consumeEmailToken(token: string, type: "VERIFY" | "RESET") {
  const emailToken = await prisma.emailToken.findUnique({
    where: { tokenHash: sha256(token) },
  });

  // Khong tim thay = token gia HOAC da dung roi (dung xong bi xoa) → cung mot loi.
  // Check `type` quan trong: khong the lay token VERIFY di doi mat khau.
  if (!emailToken || emailToken.type !== type) throw Errors.invalidToken();
  if (emailToken.expiresAt < new Date()) {
    throw Errors.invalidToken("Token đã hết hạn");
  }

  return emailToken;
}

async function verifyEmail(token: string) {
  const emailToken = await consumeEmailToken(token, "VERIFY");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: emailToken.userId },
      data: { emailVerified: true },
    }),
    prisma.emailToken.delete({ where: { id: emailToken.id } }),
  ]);

  return { message: "Xác thực email thành công" };
}

async function resetPassword(token: string, password: string) {
  const emailToken = await consumeEmailToken(token, "RESET");

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: emailToken.userId },
      data: { passwordHash },
    }),
    prisma.emailToken.delete({ where: { id: emailToken.id } }),
    // Doi password = moi phien cu phai chet (co the dang doi vi nghi bi lo).
    prisma.refreshToken.updateMany({
      where: { userId: emailToken.userId },
      data: { revoked: true },
    }),
  ]);

  return { message: "Đặt lại mật khẩu thành công" };
}

async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) throw Errors.unauthorized();

  const matched = await bcrypt.compare(oldPassword, user.passwordHash);

  if (!matched) {
    throw Errors.badRequest(
      "Mật khẩu hiện tại không đúng",
      "INVALID_CREDENTIALS"
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    }),
  ]);

  return { message: "Đổi mật khẩu thành công" };
}

export const authService = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
};
