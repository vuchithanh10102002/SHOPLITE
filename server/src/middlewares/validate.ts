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
