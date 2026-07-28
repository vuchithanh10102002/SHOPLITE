import { QueryCache, QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { errorMessage } from "@/api/client";
import { toast } from "./toast";

/**
 * Cau hinh theo Handbook 7.2b.
 *
 * staleTime 30s: danh muc san pham khong can refetch moi lan focus lai tab.
 * retry: 1 — nhung KHONG retry loi 4xx: 401/403/404/400 co retry cung the, chi lam
 * cham va nhan doi rate-limit. Chi dang retry loi mang / 5xx.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },

  /**
   * Toast loi GLOBAL cho loi nao component khong tu xu ly. Bo qua 401 vi da co
   * interceptor refresh + RequireAuth lo — toast "Chua dang nhap" moi lan token het
   * han la lam phien vo co.
   */
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silent) return;

      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 401) return;

      toast.error(errorMessage(error, "Không tải được dữ liệu"));
    },
  }),
});
