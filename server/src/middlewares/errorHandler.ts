import { AppError } from "../shared/errors";
import { Request, Response, NextFunction } from "express";

export function errorHandler(err: unknown, req:  Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  
  req.log.error({ err }, 'unhandled error');           // log day du stack

  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: 'Có lỗi xảy ra, vui lòng thử lại' }, // KHONG lo stack
  });
}