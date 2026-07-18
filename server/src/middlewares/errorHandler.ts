import { AppError } from "../shared/errors";
import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";

export function errorHandler(err: unknown, req:  Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Multer nem loi rieng cua no (vd vuot fileSize) — dich sang 400 envelope, neu
  // khong se roi vao nhanh 500 ben duoi. fileFilter cua ta nem AppError nen da
  // bat o tren; day chu yeu cho LIMIT_FILE_SIZE.
  if (err instanceof MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "Ảnh vượt quá 5MB" : "Upload không hợp lệ";
    return res.status(400).json({
      success: false,
      error: { code: "UPLOAD_ERROR", message },
    });
  }

  req.log.error({ err }, 'unhandled error');           // log day du stack

  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: 'Có lỗi xảy ra, vui lòng thử lại' }, // KHONG lo stack
  });
}