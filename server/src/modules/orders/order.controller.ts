import { Request, Response } from "express";
import { AppError } from "../../shared/errors";
import { orderService } from "./order.service";
import {
  idempotencyKeySchema,
  listOrderQuerySchema,
  listAdminOrderQuerySchema,
} from "./order.schemas";
import { getQuery } from "../../middlewares/validate";

// req.user chac chan co: moi route order qua authenticate (xem routes).

async function create(req: Request, res: Response) {
  // Idempotency-Key di trong header → parse tay (validate middleware chi lo body).
  // Thieu/rong → ZodError → nem 400 qua badRequest.
  const parsed = idempotencyKeySchema.safeParse(req.header("Idempotency-Key"));
  if (!parsed.success) {
    throw new AppError(400, "MISSING_IDEMPOTENCY_KEY", parsed.error.issues[0].message);
  }

  const { order, replayed } = await orderService.createOrder(req.user.id, parsed.data, req.body);

  // Lan dau tao → 201. Goi lai cung key (replay) → 200: khong co gi moi duoc tao.
  res.status(replayed ? 200 : 201).json({ success: true, data: order });
}

async function list(req: Request, res: Response) {
  const query = getQuery(res, listOrderQuerySchema);
  const { data, meta } = await orderService.listMyOrders(req.user.id, query);
  res.json({ success: true, data, meta });
}

async function getById(req: Request, res: Response) {
  // validateParams(orderIdSchema) da ep :id la uuid → chac chan string.
  const order = await orderService.getOrderById(req.params.id as string, req.user);
  res.json({ success: true, data: order });
}

async function cancel(req: Request, res: Response) {
  const order = await orderService.cancelOrder(req.user.id, req.params.id as string);
  res.json({ success: true, data: order });
}

async function adminList(_req: Request, res: Response) {
  const query = getQuery(res, listAdminOrderQuerySchema);
  const { data, meta } = await orderService.adminListOrders(query);
  res.json({ success: true, data, meta });
}

async function adminUpdateStatus(req: Request, res: Response) {
  // validate(adminUpdateStatusSchema) da ep body.status vao 4 gia tri hop le.
  const order = await orderService.adminUpdateStatus(
    req.params.id as string,
    req.user.id,
    req.body.status,
  );
  res.json({ success: true, data: order });
}

export const orderController = {
  create,
  list,
  getById,
  cancel,
  adminList,
  adminUpdateStatus,
};
