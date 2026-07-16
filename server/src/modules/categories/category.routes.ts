import { Router } from "express";
import { categoryController } from "./category.controller";
import { validate } from "../../middlewares/validate";
import { validateParams } from "../../middlewares/validate";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../shared/asyncHandler";
import {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from "./category.schemas";

const router = Router();

// Doc: public. Ai cung phai thay duoc cay danh muc de duyet hang.
router.get("/", asyncHandler(categoryController.getTree));

// Ghi: chi ADMIN. requireRole doc req.user nen PHAI dat sau authenticate.
router.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  validate(createCategorySchema),
  asyncHandler(categoryController.create),
);

router.patch(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validateParams(categoryIdSchema),
  validate(updateCategorySchema),
  asyncHandler(categoryController.update),
);

router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validateParams(categoryIdSchema),
  asyncHandler(categoryController.remove),
);

export default router;
