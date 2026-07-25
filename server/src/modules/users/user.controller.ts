import { Request, Response } from "express";
import { userService } from "./user.service";
import { sendSuccess } from "../../shared/response";
import { getQuery } from "../../middlewares/validate";
import { listUserQuerySchema } from "./user.schemas";

// Khong try/catch: asyncHandler o routes bat reject va day sang errorHandler.

async function list(_req: Request, res: Response) {
  // Query doc TU res.locals (da qua validateQuery, co kieu) chu khong phai
  // req.query (string tho) — xem validate.ts:validateQuery.
  const { data, meta } = await userService.listUsers(getQuery(res, listUserQuerySchema));
  sendSuccess(res, data, 200, meta);
}

// PATCH /:id/status — validateParams(userIdSchema) da ep :id la uuid,
// validate(updateUserStatusSchema) da ep body.isActive la boolean that.
async function updateStatus(req: Request, res: Response) {
  sendSuccess(res, await userService.setUserStatus(req.params.id as string, req.body.isActive));
}

export const userController = {
  list,
  updateStatus,
};
