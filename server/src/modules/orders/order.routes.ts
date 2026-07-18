import { Router } from "express";
import { orderController } from "./order.controller";
import { authenticate, requireVerified } from "../../middlewares/auth.middleware";
import { validate, validateParams, validateQuery } from "../../middlewares/validate";
import { asyncHandler } from "../../shared/asyncHandler";
import { createOrderSchema, listOrderQuerySchema, orderIdSchema } from "./order.schemas";

// Đơn của CUSTOMER, mount tại /api/orders. Route admin tách file riêng
// (order.admin.routes.ts, mount /api/admin/orders) — khác tiền tố + khác quyền.
const router = Router();

// Mọi thao tác đơn là dữ liệu cá nhân → authenticate cho tất cả.
router.use(authenticate);

// POST /api/orders — đặt hàng. requireVerified: chưa xác thực email KHÔNG đặt
// được (BR4 — vẫn login/gom giỏ được). validate body (shippingAddress); header
// Idempotency-Key parse trong controller (không đi qua body/query/params).
router.post("/", requireVerified, validate(createOrderSchema), asyncHandler(orderController.create));

// GET /api/orders — đơn của tôi, phân trang.
router.get("/", validateQuery(listOrderQuerySchema), asyncHandler(orderController.list));

// GET /api/orders/:id — của tôi hoặc ADMIN; kèm items + timeline.
router.get("/:id", validateParams(orderIdSchema), asyncHandler(orderController.getById));

// POST /api/orders/:id/cancel — hủy đơn (BR2). Logic ở b6, hiện 501.
router.post("/:id/cancel", validateParams(orderIdSchema), asyncHandler(orderController.cancel));

export default router;
