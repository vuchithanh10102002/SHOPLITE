import { Router } from "express";
import { orderController } from "./order.controller";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../shared/asyncHandler";

// Route ADMIN, mount tai /api/admin/orders. Tach khoi order.routes.ts (customer,
// /api/orders) vi khac tien to + khac quyen: moi route o day deu requireRole ADMIN.
const router = Router();

// authenticate truoc, requireRole doc req.user nen PHAI dat sau. Dat o router.use
// cho ca cum thay vi lap lai tung route.
router.use(authenticate, requireRole("ADMIN"));

// GET /api/admin/orders — moi don, co filter theo status/user (them o buoc co logic).
router.get("/", asyncHandler(orderController.adminList));

// PATCH /api/admin/orders/:id/status — doi trang thai don (b6). Chuyen trang thai
// hop le + ghi timeline lam o buoc co logic.
router.patch("/:id/status", asyncHandler(orderController.adminUpdateStatus));

export default router;
