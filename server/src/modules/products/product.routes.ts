import { Router } from "express";
import { productController } from "./product.controller";
import { validate, validateParams, validateQuery } from "../../middlewares/validate";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../shared/asyncHandler";
import {
  createProductSchema,
  listProductQuerySchema,
  productIdSchema,
  productSlugSchema,
  updateProductSchema,
} from "./product.schemas";

const router = Router();

// Doc: public. Duyet hang khong can dang nhap.

// validateQuery bien doi that (clamp limit, "2" → 2, default sort/page) va nhet
// ket qua vao res.locals — controller doc lai bang getQuery. Xem validate.ts.
router.get("/", validateQuery(listProductQuerySchema), asyncHandler(productController.list));

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

export default router;
