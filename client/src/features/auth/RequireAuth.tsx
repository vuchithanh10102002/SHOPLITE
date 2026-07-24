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
 *  - status "loading": dang goi /auth/refresh luc boot → CHUA biet gi, phai CHO.
 *    Neu bo nhanh nay, moi lan F5 o /orders user se bi da ve /login trong chop mat
 *    roi moi quay lai — bug kinh dien cua kieu giu token trong memory.
 *  - chua dang nhap → /login?from=... de dang nhap xong quay lai dung cho.
 *  - sai role → trang 403, KHONG phai redirect /login: user DA dang nhap roi, day
 *    ho ve login la sai thong diep va ho se dang nhap lai vo ich.
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
