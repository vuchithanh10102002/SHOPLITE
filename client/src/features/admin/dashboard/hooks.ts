import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { ApiSuccess, DashboardData } from "@/api/types";

/**
 * MOT request cho ca man dashboard (bon khoi so lieu). Backend chay bay query
 * song song trong mot handler — tach thanh bon endpoint chi de "RESTful" hon se
 * thanh bon vong request tu trinh duyet ma khong nhanh hon mot giay nao.
 */
export function useDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiSuccess<DashboardData>>("/admin/dashboard");
      return res.data.data;
    },
    // So lieu kinh doanh doi cham; 60s la du tuoi va tranh ban lai mot chum
    // aggregate moi lan admin bam qua lai giua cac tab.
    staleTime: 60_000,
  });
}
