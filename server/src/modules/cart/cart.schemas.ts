import { z } from "zod";

// quantity nguyen duong. min(1): PATCH quantity=0 KHONG cho — muon bo item thi
// dung DELETE, khong lam "xoa ngam" qua so 0 (mo ho, de lo). max chan cho lanh.
const quantity = z
  .int()
  .min(1, "Số lượng phải ≥ 1")
  .max(999, "Số lượng tối đa 999");

export const addCartItemSchema = z.object({
  productId: z.uuid("productId không hợp lệ"),
  quantity,
});

export const updateCartItemSchema = z.object({
  quantity,
});

// :id o day la id cua CART ITEM (khong phai productId) — khop /items/:id.
export const cartItemIdSchema = z.object({
  id: z.uuid("id không hợp lệ"),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
