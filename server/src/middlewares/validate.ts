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
 * KHONG gan `req.params = result.data` nhu ben `validate`: router cua Express
 * quan ly req.params, ghi de vao do la dam vao ruot framework. Params luon la
 * string va schema o day chi kiem tra dinh dang chu khong bien doi, nen khong
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
 * KHONG gan `req.query = result.data`: Express 5 dinh nghia req.query bang
 * getter KHONG CO SETTER (Express 4 cho gan thoai mai). Da do thuc te tren
 * express 5.2.1 — hanh vi khi gan de PHU THUOC STRICT MODE, va do la cho ban:
 *
 *   - `npm run dev` (tsx/esbuild, khong chen "use strict") → gan de bi NUOT
 *     IM LANG. Khong loi, khong warning, req.query van la string tho.
 *   - `npm run build` + `npm start` (tsc co strict:true → alwaysStrict → chen
 *     "use strict") → nem TypeError: "Cannot set property query of
 *     #<IncomingMessage> which has only a getter".
 *
 * Tuc la gan de chay "ngon" suot qua trinh dev roi chet dung khi len prod.
 * Day la ly do phai di duong khac, chu khong phai vi no throw.
 *
 * Cung KHONG bo qua ket qua nhu `validateParams`: ben do schema chi kiem tra
 * dinh dang nen doc lai req.params van dung. Ben nay schema BIEN DOI that —
 * "2" → 2, thieu page → 1, limit 999 → clamp 50. Vut result.data di roi doc
 * lai req.query la nhan lai string tho, mat sach phep bien doi.
 *
 * Nen ket qua di qua res.locals — dung kenh ma res.locals.cacheHit da dung.
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
 * Doc lai ket qua cua validateQuery, co kieu day du.
 *
 * res.locals la `Record<string, any>` nen doc thang ra `any` — mat het kieu ma
 * TypeScript khong keu mot tieng. Truyen lai chinh schema da validate de z.infer
 * suy ra kieu: doi schema thi controller do theo, khong troi lech am tham.
 *
 * Cung la ly do gom cast vao MOT cho, giong `paramId` ben category.controller.
 */
export function getQuery<S extends z.ZodType>(
  res: Response,
  _schema: S,
): z.infer<S> {
  return res.locals.query;
}
