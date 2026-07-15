import { Response } from "express";

/**
 * Meta cho response danh sach (list). Phase 3 tro di dung cho GET /products...
 * De o day de moi cho phan trang deu tra cung mot shape.
 */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Envelope thanh cong — doi xung voi errorHandler ({ success:false, error }).
 *
 * Vi sao co field `success` du da co HTTP status: frontend chi can doc mot cho
 * (`res.data.success`) de biet thanh/bai, khong phai vua doan theo status vua
 * doan theo shape. Loi va thanh cong cung mot "hop dong", interceptor xu ly 1 lan.
 *
 *   sendSuccess(res, { accessToken, user })        → 200 { success:true, data }
 *   sendSuccess(res, user, 201)                     → 201 { success:true, data }
 *   sendSuccess(res, products, 200, meta)           → 200 { success:true, data, meta }
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
