import { Request, Response } from "express";
import { cartService } from "./cart.service";
import { sendSuccess } from "../../shared/response";

// Khong try/catch: asyncHandler o routes bat reject → errorHandler.
// req.user.id chac chan co: moi route cart deu qua authenticate (xem routes).

async function get(req: Request, res: Response) {
  sendSuccess(res, await cartService.getCart(req.user.id));
}

async function addItem(req: Request, res: Response) {
  sendSuccess(res, await cartService.addItem(req.user.id, req.body), 201);
}

// validateParams(cartItemIdSchema) da ep :id la uuid → chac chan string.
function paramId(req: Request): string {
  return req.params.id as string;
}

async function updateItem(req: Request, res: Response) {
  sendSuccess(res, await cartService.updateItem(req.user.id, paramId(req), req.body.quantity));
}

async function removeItem(req: Request, res: Response) {
  sendSuccess(res, await cartService.removeItem(req.user.id, paramId(req)));
}

async function clear(req: Request, res: Response) {
  sendSuccess(res, await cartService.clear(req.user.id));
}

export const cartController = { get, addItem, updateItem, removeItem, clear };
