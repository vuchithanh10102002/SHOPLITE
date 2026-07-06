import { Request, Response, NextFunction } from "express";
import { AppError } from "../shared/errors";

export function notFound(req: Request, res: Response, next: NextFunction) {
    next(new AppError(
        404,
        "NOT_FOUND",
        "Route không tồn tại"
    ));
}