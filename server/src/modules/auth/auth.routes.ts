import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middlewares/validate";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.schemas";
import { authenticate } from "../../middlewares/auth.middleware";
import { rateLimit } from "../../middlewares/rate-limit";

const router = Router();

// Moi route mot counter rieng — dung chung mot instance rateLimit nghia la
// dung chung han muc: goi /register 5 lan la khong login duoc nua.
const registerLimit = rateLimit({ prefix: "auth:register", limit: 5, window: 60 });
const loginLimit = rateLimit({ prefix: "auth:login", limit: 10, window: 60 });
const forgotLimit = rateLimit({ prefix: "auth:forgot", limit: 3, window: 60 });
const resetLimit = rateLimit({ prefix: "auth:reset", limit: 5, window: 60 });

router.post("/register", registerLimit, validate(registerSchema), authController.register);
router.post("/login", loginLimit, validate(loginSchema), authController.login);
router.post("/verify-email", validate(verifyEmailSchema), authController.verifyEmail);

// /refresh va /logout doc refresh token tu cookie httpOnly, khong tu body → khong validate.
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

router.post("/forgot-password", forgotLimit, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", resetLimit, validate(resetPasswordSchema), authController.resetPassword);
router.post("/change-password", authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
