import { Response } from "express";

/** De o day de moi cho phan trang deu tra cung mot shape. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Envelope thanh cong — doi xung voi errorHandler ({ success:false, error }). Co
 * field `success` du da co HTTP status de frontend chi doc MOT cho la biet
 * thanh/bai, interceptor xu ly mot lan cho ca hai duong.
 *
 *   sendSuccess(res, { accessToken, user })  → 200 { success:true, data }
 *   sendSuccess(res, user, 201)              → 201 { success:true, data }
 *   sendSuccess(res, products, 200, meta)    → 200 { success:true, data, meta }
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: PageMeta,
) {
  return res
    .status(status)
    .json(meta ? { success: true, data, meta } : { success: true, data });
}
