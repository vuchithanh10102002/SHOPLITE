import { z } from "zod";

// bcrypt chi bam 72 byte dau: password dai hon bi cat am tham → chan tuong minh
// o validate thay vi de user tuong minh dat mat khau 100 ky tu.
const password = z
  .string()
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
  .max(72, "Mật khẩu tối đa 72 ký tự");

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
  // Login KHONG rang buoc do dai: mat khau cu (dat truoc khi doi rule) van phai
  // login duoc, va bao "mat khau phai >= 8 ky tu" o man login la lo thong tin thua.
  password: z.string().min(1, "Mật khẩu là bắt buộc"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token là bắt buộc"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token là bắt buộc"),
  password,
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Mật khẩu hiện tại là bắt buộc"),
  newPassword: password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
