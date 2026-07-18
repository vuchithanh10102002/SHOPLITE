import { Request, Response } from "express";
import { AppError } from "../../shared/errors";

/**
 * SKELETON (Phase 4 bước 2). Mục đích chỉ để LỘ RA 6 endpoint (handbook 6.5) —
 * thấy hình hài API + gắn đúng middleware (authenticate/requireVerified/
 * requireRole) trước khi có logic. Logic thật làm ở các bước sau:
 *   b4 create (transaction chống oversell) · b5 payment · b6 cancel + admin status.
 *
 * Trả 501 qua AppError → errorHandler bọc đúng envelope { success:false, error }.
 */
function notImplemented(): never {
  throw new AppError(501, "NOT_IMPLEMENTED", "Chức năng đang được xây dựng (Phase 4)");
}

async function create(_req: Request, _res: Response) {
  notImplemented();
}

async function list(_req: Request, _res: Response) {
  notImplemented();
}

async function getById(_req: Request, _res: Response) {
  notImplemented();
}

async function cancel(_req: Request, _res: Response) {
  notImplemented();
}

async function adminList(_req: Request, _res: Response) {
  notImplemented();
}

async function adminUpdateStatus(_req: Request, _res: Response) {
  notImplemented();
}

export const orderController = {
  create,
  list,
  getById,
  cancel,
  adminList,
  adminUpdateStatus,
};
