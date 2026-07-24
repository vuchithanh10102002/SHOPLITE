import { z } from "zod";

/**
 * CHEP NGUYEN VAN tu server/src/modules/auth/auth.schemas.ts (Handbook 7.3) — ke ca
 * message tieng Viet, de loi hien o client va loi backend tra ve giong het nhau.
 *
 * Khong import truc tiep duoc vi client/ va server/ la 2 workspace roi (Handbook 5
 * co goi y nang cap: tach package shared/ trong monorepo — chua lam o phase nay).
 * DOI LAI PHAI KY LUAT: sua rule ben backend thi sua ca o day.
 *
 * Zod ban o client ghim ^4.4.3 khop backend — v3/v4 khac API (.email() vs z.email()).
 */

const password = z
  .string()
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
  .max(72, "Mật khẩu tối đa 72 ký tự"); // bcrypt chi bam 72 byte dau

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password,
  fullName: z
    .string()
    .min(2, "Họ tên phải có ít nhất 2 ký tự")
    .max(100, "Họ tên tối đa 100 ký tự"),
});

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  // KHONG rang buoc do dai o man login: mat khau cu (dat truoc khi doi rule) van
  // phai dang nhap duoc, va bao "toi thieu 8 ky tu" o day la lo thong tin thua.
  password: z.string().min(1, "Mật khẩu là bắt buộc"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token là bắt buộc"),
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
