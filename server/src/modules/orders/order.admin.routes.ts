import { Router } from "express";
import { orderController } from "./order.controller";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { validate, validateParams, validateQuery } from "../../middlewares/validate";
import { asyncHandler } from "../../shared/asyncHandler";
import {
  adminUpdateStatusSchema,
  listAdminOrderQuerySchema,
  orderIdSchema,
} from "./order.schemas";

// Route ADMIN, mount tai /api/admin/orders. Tach khoi order.routes.ts (customer,
// /api/orders) vi khac tien to + khac quyen: moi route o day deu requireRole ADMIN.
const router = Router();

// authenticate truoc, requireRole doc req.user nen PHAI dat sau. Dat o router.use
// cho ca cum thay vi lap lai tung route.
router.use(authenticate, requireRole("ADMIN"));

// GET /api/admin/orders — moi don, loc theo status/user, phan trang.
router.get("/", validateQuery(listAdminOrderQuerySchema), asyncHandler(orderController.adminList));

// PATCH /api/admin/orders/:id/status — doi trang thai don theo state machine (b6).
router.patch(
  "/:id/status",
  validateParams(orderIdSchema),
  validate(adminUpdateStatusSchema),
  asyncHandler(orderController.adminUpdateStatus),
);

export default router;
