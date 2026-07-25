import { Router } from "express";
import { userController } from "./user.controller";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { validate, validateParams, validateQuery } from "../../middlewares/validate";
import { asyncHandler } from "../../shared/asyncHandler";
import { listUserQuerySchema, updateUserStatusSchema, userIdSchema } from "./user.schemas";

// Mount tai /api/admin/users — cung khuon order.admin.routes.ts: tien to /admin
// noi ro day la khu quan tri, va requireRole dat mot lan o router.use cho ca cum
// thay vi lap lai tung route (bo sot mot dong la thung mot lo quyen).
const router = Router();

router.use(authenticate, requireRole("ADMIN"));

// GET /api/admin/users?q=&role=&isActive=&page=&limit=
router.get("/", validateQuery(listUserQuerySchema), asyncHandler(userController.list));

// PATCH /api/admin/users/:id/status — { isActive: boolean }. Khong phai PATCH
// /:id: day la MOT hanh dong tren tai khoan, khong phai sua field tuy y (client
// khong duoc gui `role` hay `emailVerified` len). Cung khuon POST /orders/:id/cancel.
router.patch(
  "/:id/status",
  validateParams(userIdSchema),
  validate(updateUserStatusSchema),
  asyncHandler(userController.updateStatus),
);

export default router;
