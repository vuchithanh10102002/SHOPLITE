import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { CART_KEY } from "@/features/cart/hooks";
import type { ApiSuccess, Order, OrderSummary } from "@/api/types";
import type { CheckoutInput } from "./schemas";

/**
 * `lists` la TIEN TO chung cua moi trang danh sach — invalidate no lam moi ca 5
 * trang dang cache ma KHONG dung toi cache detail (neu invalidate ["orders"] thi
 * trang chi tiet vua ghi vao cache se bi refetch ngay, mot request thua).
 */
export const orderKeys = {
  all: ["orders"] as const,
  lists: ["orders", "list"] as const,
  list: (page: number) => ["orders", "list", page] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
};

export function useOrders(page: number) {
  return useQuery({
    queryKey: orderKeys.list(page),
    queryFn: async () => {
      const res = await api.get<ApiSuccess<OrderSummary[]>>("/orders", { params: { page } });
      return res.data; // giu ca `meta` cho phan trang
    },
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: async () => {
      const res = await api.get<ApiSuccess<Order>>(`/orders/${id}`);
      return res.data.data;
    },
    enabled: id.length > 0,
  });
}

/**
 * Dat hang. `idempotencyKey` do NGUOI GOI truyen vao chu khong sinh o day: hook
 * chay lai moi lan component render, sinh key trong nay thi moi lan bam la mot
 * key moi — dung hong y nghia idempotency. CheckoutPage giu key bang useMemo(...,
 * []) nen mot lan vao trang la MOT key, bam 10 lan van chi mot don (DoD Phase 5).
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: CheckoutInput & { idempotencyKey: string }) => {
      const res = await api.post<ApiSuccess<Order>>(
        "/orders",
        { shippingAddress: vars.shippingAddress },
        { headers: { "Idempotency-Key": vars.idempotencyKey } },
      );
      return res.data.data;
    },

    onSuccess: (order) => {
      // Don da tao → gio hang da bi don sach trong transaction ben server.
      queryClient.invalidateQueries({ queryKey: CART_KEY });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists });
      // Nem san detail vao cache de trang /orders/:id hien ngay, khong nhap nhay
      // mot vong skeleton cho du lieu vua cam tren tay.
      queryClient.setQueryData(orderKeys.detail(order.id), order);
    },
  });
}

/** Huy don (BR2). Backend tra don SAU khi huy → ghi thang vao cache detail. */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<ApiSuccess<Order>>(`/orders/${id}/cancel`);
      return res.data.data;
    },

    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      // Danh sach don co cot trang thai → phai lam moi, khong thi van thay "Đã
      // thanh toán" trong khi don da huy.
      queryClient.invalidateQueries({ queryKey: orderKeys.lists });
    },
  });
}
