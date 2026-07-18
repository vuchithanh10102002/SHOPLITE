import { Request, Response } from "express";
import { productService } from "./product.service";
import { sendSuccess } from "../../shared/response";
import { Errors } from "../../shared/errors";
import { getQuery } from "../../middlewares/validate";
import { listProductQuerySchema } from "./product.schemas";

// Khong try/catch: asyncHandler o routes da bat reject va day sang errorHandler.

async function list(_req: Request, res: Response) {
  // Query da qua validateQuery → doc lai TU res.locals (co kieu), KHONG doc
  // req.query (string tho). Xem validate.ts:validateQuery de biet vi sao.
  //
  // Service tra CacheResult: `hit` di vao res.locals de httpLogger gan cache_hit
  // vao dong log ket thuc request (giong het category.controller). Service khong
  // biet gi ve `res` — controller la cho hai the gioi gap.
  const { value, hit } = await productService.list(getQuery(res, listProductQuerySchema));
  res.locals.cacheHit = hit;

  sendSuccess(res, value.data, 200, value.meta);
}

// validateParams(productSlugSchema) da ep :slug khop SLUG_PATTERN → chac chan la
// string. @types/express v5 khai bao req.params[k] la `string | string[]`.
async function getBySlug(req: Request, res: Response) {
  const { value, hit } = await productService.getBySlug(req.params.slug as string);
  res.locals.cacheHit = hit;

  sendSuccess(res, value);
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

// multer da nap file vao req.file (memory storage). Khong gui field 'image' →
// req.file undefined → 400 tu te thay vi vo service roi no bao loi kho hieu.
async function addImage(req: Request, res: Response) {
  if (!req.file) throw Errors.badRequest("Thiếu file ảnh (field 'image')", "NO_FILE");

  sendSuccess(res, await productService.addImage(paramId(req), req.file), 201);
}

// validateParams(productImageParamsSchema) da ep :imageId la uuid.
async function removeImage(req: Request, res: Response) {
  sendSuccess(res, await productService.removeImage(paramId(req), req.params.imageId as string));
}

export const productController = {
  list,
  getBySlug,
  create,
  update,
  remove,
  addImage,
  removeImage,
};
