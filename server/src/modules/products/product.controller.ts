import { Request, Response } from "express";
import { productService } from "./product.service";
import { sendSuccess } from "../../shared/response";
import { Errors } from "../../shared/errors";
import { getQuery } from "../../middlewares/validate";
import { listProductQuerySchema } from "./product.schemas";

// Khong try/catch: asyncHandler o routes da bat reject va day sang errorHandler.

async function list(_req: Request, res: Response) {
  // Query doc TU res.locals (co kieu) chu KHONG tu req.query (string tho) — xem
  // validate.ts:validateQuery. `hit` di vao res.locals de httpLogger gan cache_hit
  // vao dong log: service khong biet gi ve `res`, controller la cho hai ben gap.
  const { value, hit } = await productService.list(getQuery(res, listProductQuerySchema));
  res.locals.cacheHit = hit;

  sendSuccess(res, value.data, 200, value.meta);
}

// CHO DUY NHAT bat `adminView` (chon shape AdminProduct + tach namespace cache) va
// cung la cho duy nhat honor `includeDeleted`. Route public goi list() khong truyen
// opts nen ca hai co khach gui len deu bi lo di — chong leo quyen + poison cache.
async function listAdmin(_req: Request, res: Response) {
  const query = getQuery(res, listProductQuerySchema);
  const { value, hit } = await productService.list(query, {
    adminView: true,
    includeDeleted: query.includeDeleted,
  });
  res.locals.cacheHit = hit;

  sendSuccess(res, value.data, 200, value.meta);
}

// Detail cho form sua ben admin: theo ID, thay ca hang da xoa, co `stock` — CHO DUY
// NHAT tra ve mot san pham kem con so ton kho.
async function getAdminById(req: Request, res: Response) {
  sendSuccess(res, await productService.getByIdAdmin(req.params.id as string));
}

// `as string`: @types/express v5 khai req.params[k] la `string | string[]`, con
// validateParams(productSlugSchema) da ep :slug khop SLUG_PATTERN.
async function getBySlug(req: Request, res: Response) {
  const { value, hit } = await productService.getBySlug(req.params.slug as string);
  res.locals.cacheHit = hit;

  sendSuccess(res, value);
}

async function create(req: Request, res: Response) {
  sendSuccess(res, await productService.create(req.body), 201);
}

// Gom cast vao MOT cho, khong rai `as string` khap noi (giong category.controller).
function paramId(req: Request): string {
  return req.params.id as string;
}

async function update(req: Request, res: Response) {
  sendSuccess(res, await productService.update(paramId(req), req.body));
}

async function remove(req: Request, res: Response) {
  sendSuccess(res, await productService.remove(paramId(req)));
}

// POST chu khong PATCH /:id: "khoi phuc" la HANH DONG chu khong phai sua field —
// client khong duoc gui `deletedAt` tuy y. Cung khuon voi POST /orders/:id/cancel.
async function restore(req: Request, res: Response) {
  sendSuccess(res, await productService.restore(paramId(req)));
}

// Khong gui field 'image' → req.file undefined → 400 tu te thay vi vo service roi
// no bao loi kho hieu.
async function addImage(req: Request, res: Response) {
  if (!req.file) throw Errors.badRequest("Thiếu file ảnh (field 'image')", "NO_FILE");

  sendSuccess(res, await productService.addImage(paramId(req), req.file), 201);
}

async function removeImage(req: Request, res: Response) {
  sendSuccess(res, await productService.removeImage(paramId(req), req.params.imageId as string));
}

export const productController = {
  list,
  listAdmin,
  getAdminById,
  getBySlug,
  create,
  update,
  remove,
  restore,
  addImage,
  removeImage,
};
