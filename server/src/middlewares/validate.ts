import { z } from "zod";
import { Request, Response, NextFunction } from "express";

function sendValidationError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: z.flattenError(error),
    },
  });
}

export function validate(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) return sendValidationError(res, result.error);

    req.body = result.data;
    next();
  };
}

/**
 * Validate route params (vd `/:id` phai la uuid).
 *
 * KHONG gan `req.params = result.data`: router Express quan ly req.params. Params
 * luon la string va schema o day chi kiem dinh dang chu khong bien doi, nen khong
 * gan lai cung khong mat gi.
 */
export function validateParams(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) return sendValidationError(res, result.error);

    next();
  };
}

/**
 * Validate query string (vd `?page=2&limit=20&sort=price_asc`).
 *
 * KHONG gan `req.query = result.data`: Express 5 dinh nghia req.query bang getter
 * KHONG CO SETTER, va hanh vi khi gan de PHU THUOC STRICT MODE (do thuc te tren
 * 5.2.1) — `npm run dev` (tsx, khong chen "use strict") NUOT IM LANG con
 * `build` + `start` (tsc alwaysStrict) nem TypeError. Tuc la chay ngon suot dev roi
 * chet dung khi len prod; do moi la ly do phai di duong khac.
 *
 * Cung KHONG bo qua ket qua nhu `validateParams`: schema o day BIEN DOI that ("2" →
 * 2, thieu page → 1, limit 999 → clamp 50), vut di roi doc lai req.query la nhan
 * lai string tho. Nen ket qua di qua res.locals — cung kenh voi res.locals.cacheHit.
 */
export function validateQuery(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) return sendValidationError(res, result.error);

    res.locals.query = result.data;
    next();
  };
}

/**
 * Doc lai ket qua cua validateQuery, co kieu day du. res.locals la
 * `Record<string, any>` nen doc thang ra `any` — mat het kieu ma TypeScript khong
 * keu mot tieng. Truyen lai chinh schema da validate de z.infer suy ra kieu: doi
 * schema thi controller do theo, khong troi lech am tham.
 */
export function getQuery<S extends z.ZodType>(
  res: Response,
  _schema: S,
): z.infer<S> {
  return res.locals.query;
}
