import { Router } from "express";
import { orderController } from "./order.controller";
import { authenticate, requireVerified } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../shared/asyncHandler";

// Đơn của CUSTOMER, mount tại /api/orders. Route admin tách file riêng
// (order.admin.routes.ts, mount /api/admin/orders) — khác tiền tố + khác quyền.
const router = Router();

// Mọi thao tác đơn là dữ liệu cá nhân → authenticate cho tất cả.
router.use(authenticate);

// POST /api/orders — đặt hàng. requireVerified: chưa xác thực email KHÔNG đặt
// được (BR4 — vẫn login/gom giỏ được). validate body + header Idempotency-Key
// sẽ thêm ở b4 khi có logic.
router.post("/", requireVerified, asyncHandler(orderController.create));

// GET /api/orders — đơn của tôi (pagination thêm ở bước có logic).
router.get("/", asyncHandler(orderController.list));

// GET /api/orders/:id — của tôi hoặc ADMIN; kèm items + timeline.
router.get("/:id", asyncHandler(orderController.getById));

// POST /api/orders/:id/cancel — hủy đơn (BR2).
router.post("/:id/cancel", asyncHandler(orderController.cancel));

export default router;
