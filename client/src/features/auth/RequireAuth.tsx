import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "./store";
import { FullPageSpinner } from "@/components/ui/States";
import { Forbidden } from "@/pages/Forbidden";
import type { Role } from "@/api/types";

/**
 * Guard route. LUU Y BAN CHAT (Handbook 7.2c): day chi la UX — bao mat that nam o
 * middleware backend. Ai xoa guard nay van chi nhan 401/403 tu API.
 *
 * Ba nhanh, khong phai hai:
 *  - "loading" (dang goi /auth/refresh luc boot) → phai CHO. Bo nhanh nay thi moi lan
 *    F5 o /orders user bi da ve /login trong chop mat roi moi quay lai.
 *  - chua dang nhap → /login?from=... de dang nhap xong quay lai dung cho.
 *  - sai role → trang 403, KHONG redirect /login: user DA dang nhap roi, day ho ve
 *    login la sai thong diep va ho se dang nhap lai vo ich.
 */
export function RequireAuth({ role }: { role?: Role }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === "loading") return <FullPageSpinner />;

  if (status === "anon") {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }

  if (role && user?.role !== role) return <Forbidden />;

  return <Outlet />;
}
