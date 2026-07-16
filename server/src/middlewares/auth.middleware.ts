import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../modules/auth/token.service";
import { Errors } from "../shared/errors";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        },
      });
    }

    const token = authHeader.substring(7);

    const payload = verifyAccessToken(token) as {
      sub: string;
      role: string;
    };

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      },
    });
  }
}

/**
 * Chan theo role. LUON dat sau `authenticate` — no doc `req.user` do authenticate gan.
 *
 *   router.post("/", authenticate, requireRole("ADMIN"), ...)
 *
 * 403 chu khong phai 404: user da dang nhap hop le, chi la khong du quyen. Giau
 * su ton tai cua resource (tra 404) chi co nghia khi ban than URL la bi mat —
 * /api/categories thi khong.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Errors.unauthorized());
    if (!roles.includes(req.user.role)) return next(Errors.forbidden());

    next();
  };
}