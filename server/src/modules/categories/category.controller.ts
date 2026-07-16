import { Request, Response } from "express";
import { categoryService } from "./category.service";
import { sendSuccess } from "../../shared/response";

// Khong try/catch: asyncHandler o routes da bat reject va day sang errorHandler.
async function getTree(_req: Request, res: Response) {
  const { value, hit } = await categoryService.getTree();

  // httpLogger doc res.locals.cacheHit → cache_hit di kem dong log ket thuc request.
  // Day la cho DUY NHAT service (khong biet gi ve Express) gap tang HTTP.
  res.locals.cacheHit = hit;

  sendSuccess(res, value);
}

async function create(req: Request, res: Response) {
  sendSuccess(res, await categoryService.create(req.body), 201);
}

// @types/express v5 khai bao req.params[k] la `string | string[]` (params lap lai).
// validateParams(categoryIdSchema) da ep :id phai la uuid roi nen o day chac chan
// la string — ep kieu mot cho, khong rai `as string` khap noi.
function paramId(req: Request): string {
  return req.params.id as string;
}

async function update(req: Request, res: Response) {
  sendSuccess(res, await categoryService.update(paramId(req), req.body));
}

async function remove(req: Request, res: Response) {
  sendSuccess(res, await categoryService.remove(paramId(req)));
}

export const categoryController = { getTree, create, update, remove };
