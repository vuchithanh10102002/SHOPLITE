import { Request, Response, Router } from "express";
import { dashboardService } from "./dashboard.service";
import { authenticate, requireRole } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../shared/asyncHandler";
import { sendSuccess } from "../../shared/response";

/**
 * GET /api/admin/dashboard — MOT endpoint, khong query param, khong body.
 *
 * Khong tach controller rieng nhu cac module khac: controller o day se la dung
 * mot dong `sendSuccess(res, await service())`. Mot file 30 dong chi de giu doi
 * xung ten thu muc thi la nghi thuc, khong phai cau truc. Them lai khi nao
 * endpoint nay co tham so that (vd ?days=7).
 */
const router = Router();

router.use(authenticate, requireRole("ADMIN"));

router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await dashboardService.getDashboard());
  }),
);

export default router;
