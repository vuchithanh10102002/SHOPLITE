import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export function requestId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const id =
    req.header("x-request-id") ??
    randomUUID();

  req.headers["x-request-id"] = id;

  res.setHeader("x-request-id", id);

  next();
}