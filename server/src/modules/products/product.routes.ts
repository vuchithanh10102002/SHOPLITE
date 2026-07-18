import { Router } from "express";
import { productController } from "./product.controller";
import { validate, validateParams, validateQuery } from "../../middlewares/validate";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { uploadSingle } from "../../middlewares/upload";
import { asyncHandler } from "../../shared/asyncHandler";
import {
  createProductSchema,
  listProductQuerySchema,
  productIdSchema,
  productImageParamsSchema,
  productSlugSchema,
  updateProductSchema,
} from "./product.schemas";

const router = Router();

// Doc: public. Duyet hang khong can dang nhap.

// validateQuery bien doi that (clamp limit, "2" → 2, default sort/page) va nhet
// ket qua vao res.locals — controller doc lai bang getQuery. Xem validate.ts.
router.get("/", validateQuery(listProductQuerySchema), asyncHandler(productController.list));

// Admin xem ca hang da xoa: /admin?includeDeleted=true. PHAI dat TREN "/:slug" —
// neu khong "admin" khop luon :slug (dung SLUG_PATTERN) → roi vao getBySlug →
// 404. Chi ADMIN; flag includeDeleted chi honor o day (xem controller.listAdmin).
router.get(
  "/admin",
  authenticate,
  requireRole("ADMIN"),
  validateQuery(listProductQuerySchema),
  asyncHandler(productController.listAdmin),
);

// `/:slug` PHAI dat SAU `/` — neu khong Express van khop dung, nhung de "/" ngay
// tren cho de doc. GET theo slug (khong phai id) — handbook muc 6.
router.get(
  "/:slug",
  validateParams(productSlugSchema),
  asyncHandler(productController.getBySlug),
);

// Ghi: chi ADMIN. requireRole doc req.user nen PHAI dat sau authenticate.
router.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  validate(createProductSchema),
  asyncHandler(productController.create),
);

router.patch(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validateParams(productIdSchema),
  validate(updateProductSchema),
  asyncHandler(productController.update),
);

router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validateParams(productIdSchema),
  asyncHandler(productController.remove),
);

// Upload anh: chi ADMIN. uploadSingle (multer) dat SAU requireRole — dung nhan
// buffer 5MB roi moi phat hien khong phai admin. Field form-data ten 'image'.
router.post(
  "/:id/images",
  authenticate,
  requireRole("ADMIN"),
  validateParams(productIdSchema),
  uploadSingle,
  asyncHandler(productController.addImage),
);

router.delete(
  "/:id/images/:imageId",
  authenticate,
  requireRole("ADMIN"),
  validateParams(productImageParamsSchema),
  asyncHandler(productController.removeImage),
);

export default router;
