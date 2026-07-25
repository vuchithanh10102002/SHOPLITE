import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { AdminUser, ApiSuccess, Role } from "@/api/types";

export interface AdminUserParams {
  q?: string;
  role?: Role;
  isActive?: "true" | "false";
  page?: number;
}

export const adminUserKeys = {
  all: ["admin", "users"] as const,
  list: (params: AdminUserParams) => ["admin", "users", "list", params] as const,
};

export function useAdminUsers(params: AdminUserParams) {
  return useQuery({
    queryKey: adminUserKeys.list(params),
    queryFn: async () => {
      const res = await api.get<ApiSuccess<AdminUser[]>>("/admin/users", { params });
      return res.data; // giu ca `meta`
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Khoa/mo tai khoan. MOT endpoint nhan `isActive` (khong phai hai route
 * block/unblock): client noi RO trang thai muon co nen bam hai lan ra cung ket
 * qua. Neu la "toggle" thi hai admin bam cung luc se lat qua lat lai.
 *
 * Backend tu REVOKE het refresh token khi khoa — nguoi bi khoa mat duong gia han
 * phien ngay, chi con access token cu song them toi da 15 phut.
 */
export function useSetUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { id: string; isActive: boolean }) => {
      const res = await api.patch<ApiSuccess<AdminUser>>(`/admin/users/${vars.id}/status`, {
        isActive: vars.isActive,
      });
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}
