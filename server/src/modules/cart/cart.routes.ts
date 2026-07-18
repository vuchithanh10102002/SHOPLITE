import { Router } from "express";
import { cartController } from "./cart.controller";
import { validate, validateParams } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../shared/asyncHandler";
import { addCartItemSchema, cartItemIdSchema, updateCartItemSchema } from "./cart.schemas";

const router = Router();

// Toan bo cart la du lieu ca nhan → authenticate cho MOI route (router.use).
// KHONG can requireVerified: chua verify van duoc gom gio, chi khong dat hang
// duoc (requireVerified se gan o POST /orders — b2). KHONG requireRole: ca
// customer lan admin deu co gio rieng.
router.use(authenticate);

router.get("/", asyncHandler(cartController.get));

router.post("/items", validate(addCartItemSchema), asyncHandler(cartController.addItem));

router.patch(
  "/items/:id",
  validateParams(cartItemIdSchema),
  validate(updateCartItemSchema),
  asyncHandler(cartController.updateItem),
);

router.delete(
  "/items/:id",
  validateParams(cartItemIdSchema),
  asyncHandler(cartController.removeItem),
);

router.delete("/", asyncHandler(cartController.clear));

export default router;
