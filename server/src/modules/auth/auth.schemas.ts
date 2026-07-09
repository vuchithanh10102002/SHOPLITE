import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),

  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự"),

  fullName: z
    .string()
    .min(2, "Họ tên phải có ít nhất 2 ký tự")
    .max(100, "Họ tên tối đa 100 ký tự"),
});

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),

  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token là bắt buộc"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token là bắt buộc"),

  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8),

  newPassword: z.string().min(8),
});


export type RegisterInput = z.infer<typeof registerSchema>;

export type LoginInput = z.infer<typeof loginSchema>;

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;