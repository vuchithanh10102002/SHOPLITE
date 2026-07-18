import { Request, Response } from "express";
import { productService } from "./product.service";
import { sendSuccess } from "../../shared/response";
import { getQuery } from "../../middlewares/validate";
import { listProductQuerySchema } from "./product.schemas";

// Khong try/catch: asyncHandler o routes da bat reject va day sang errorHandler.

async function list(_req: Request, res: Response) {
  // Query da qua validateQuery → doc lai TU res.locals (co kieu), KHONG doc
  // req.query (string tho). Xem validate.ts:validateQuery de biet vi sao.
  const { data, meta } = await productService.list(getQuery(res, listProductQuerySchema));

  sendSuccess(res, data, 200, meta);
}

// validateParams(productSlugSchema) da ep :slug khop SLUG_PATTERN → chac chan la
// string. @types/express v5 khai bao req.params[k] la `string | string[]`.
async function getBySlug(req: Request, res: Response) {
  sendSuccess(res, await productService.getBySlug(req.params.slug as string));
}

async function create(req: Request, res: Response) {
  sendSuccess(res, await productService.create(req.body), 201);
}

// Giong paramId ben category.controller: gom cast vao MOT cho, khong rai
// `as string` khap noi. validateParams(productIdSchema) da bao dam la uuid.
function paramId(req: Request): string {
  return req.params.id as string;
}

async function update(req: Request, res: Response) {
  sendSuccess(res, await productService.update(paramId(req), req.body));
}

async function remove(req: Request, res: Response) {
  sendSuccess(res, await productService.remove(paramId(req)));
}

export const productController = { list, getBySlug, create, update, remove };
