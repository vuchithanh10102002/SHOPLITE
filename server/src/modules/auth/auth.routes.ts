import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middlewares/validate";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, refreshTokenSchema, registerSchema, resetPasswordSchema } from "./auth.schemas";
import { authenticate } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshTokenSchema), authController.refresh);
router.post("/logout", authController.logout);
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/change-password", authenticate, validate(changePasswordSchema), authController.changePassword);
router.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);
router.get(
  "/verify-email",
  authController.verifyEmail
);

export default router;