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
      verified?: boolean;
    };

    req.user = {
      id: payload.sub,
      role: payload.role,
      // Token cu (truoc khi them claim) co the thieu → coi nhu chua verified.
      // Token song 15' nen het rat nhanh, khong ket lai lau.
      verified: payload.verified ?? false,
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

/**
 * Chan neu email chua xac thuc (BR4: chua verify van login/gom gio duoc, nhung
 * KHONG dat hang duoc). LUON dat sau `authenticate` — doc `req.user.verified` do
 * authenticate lay tu claim trong access token.
 *
 *   router.post("/", authenticate, requireVerified, ...)
 *
 * 403 EMAIL_NOT_VERIFIED (khac 403 FORBIDDEN cua role) → frontend phan biet duoc
 * "cần xác thực email" voi "khong du quyen" de hien dung thong bao.
 */
export function requireVerified(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(Errors.unauthorized());
  if (!req.user.verified) return next(Errors.emailNotVerified());

  next();
}
