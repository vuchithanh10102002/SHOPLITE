import { Request, Response, NextFunction, CookieOptions } from "express";
import { authService } from "./auth.service";
import { env } from "../../config/env";
import { Errors } from "../../shared/errors";
import { sendSuccess } from "../../shared/response";

export const REFRESH_COOKIE = "refreshToken";

/**
 * httpOnly  → JS (va do do XSS) khong doc duoc token.
 * Path      → cookie chi duoc gui khi goi /api/auth/* → giam be mat tan cong,
 *             va khong dinh kem vao moi request API khac cho nang.
 * SameSite  → lax: chan CSRF co ban ma van cho dieu huong tu link ngoai.
 * Secure    → chi bat o prod; dev chay http://localhost nen phai tat.
 */
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngay, khop expiresAt trong DB
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions);
}

function clearRefreshCookie(res: Response) {
  // Phai clear voi CUNG path/options, khong trinh duyet se giu lai cookie cu.
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions, maxAge: undefined });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.register(req.body);

    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { accessToken, refreshToken, user } = await authService.login(req.body);

    setRefreshCookie(res, refreshToken);

    // refreshToken KHONG nam trong body — chi song trong cookie httpOnly.
    sendSuccess(res, { accessToken, user });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (!token) throw Errors.unauthorized();

    const result = await authService.refresh(token);

    setRefreshCookie(res, result.refreshToken);

    sendSuccess(res, { accessToken: result.accessToken });
  } catch (err) {
    // Refresh fail (het han / bi revoke / reuse) → cookie do da vo dung,
    // xoa luon de client khong lap vo han vong 401 → refresh → 401.
    clearRefreshCookie(res);

    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.logout(req.cookies?.[REFRESH_COOKIE]);

    clearRefreshCookie(res);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.forgotPassword(req.body.email);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.resetPassword(req.body.token, req.body.password);

    clearRefreshCookie(res);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    // userId LAY TU ACCESS TOKEN, khong bao gio tu body — neu tin body thi
    // bat ky user nao cung doi duoc mat khau cua user khac.
    const result = await authService.changePassword(
      req.user!.id,
      req.body.oldPassword,
      req.body.newPassword
    );

    clearRefreshCookie(res);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.verifyEmail(req.body.token);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export const authController = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
};
