import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { orderKeys } from "@/features/orders/hooks";
import type { AdminOrderSummary, ApiSuccess, Order, OrderStatus } from "@/api/types";

export interface AdminOrderParams {
  status?: OrderStatus;
  userId?: string;
  page?: number;
}

export const adminOrderKeys = {
  all: ["admin", "orders"] as const,
  list: (params: AdminOrderParams) => ["admin", "orders", "list", params] as const,
};

export function useAdminOrders(params: AdminOrderParams) {
  return useQuery({
    queryKey: adminOrderKeys.list(params),
    queryFn: async () => {
      const res = await api.get<ApiSuccess<AdminOrderSummary[]>>("/admin/orders", { params });
      return res.data; // giu ca `meta`
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Doi trang thai don (PATCH /api/admin/orders/:id/status).
 *
 * Backend tra ve don SAU khi doi, kem `allowedTransitions` moi — nen chi can
 * invalidate la bang tu cap nhat ca trang thai lan cac lua chon trong dropdown.
 *
 * Invalidate CA `orderKeys.all` (khu cua khach): admin doi PAID → SHIPPED thi
 * trang "Don hang cua toi" cua chinh admin do, neu dang mo o tab khac, phai thay
 * trang thai moi. Re, va tranh mot lop bug "so lieu hai man khong khop".
 */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { id: string; status: OrderStatus }) => {
      const res = await api.patch<ApiSuccess<Order>>(`/admin/orders/${vars.id}/status`, {
        status: vars.status,
      });
      return res.data.data;
    },

    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: adminOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.setQueryData(orderKeys.detail(order.id), order);
    },
  });
}
