import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, Package, Receipt, Store, Users, X } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";
import { useLogout } from "@/features/auth/hooks";
import { cn } from "@/lib/cn";

/**
 * Khung khu quan tri, tach hoan toan khoi MainLayout: khong gio hang, khong nav mua
 * sam — day la cong cu lam viec, khong phai cua hang.
 *
 * Guard nam o <RequireAuth role="ADMIN"> boc ben ngoai trong App.tsx chu khong o day,
 * de sai quyen thi thay trang 403 SACH thay vi mot sidebar admin rong tuech.
 */
const NAV = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Sản phẩm", icon: Package, end: false },
  { to: "/admin/orders", label: "Đơn hàng", icon: Receipt, end: false },
  { to: "/admin/users", label: "Người dùng", icon: Users, end: false },
];

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive ? "bg-primary text-white" : "text-gray-700 hover:bg-gray-100",
  );
}

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={navClass} onClick={() => setMenuOpen(false)}>
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="flex h-14 items-center gap-2 px-4">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
            aria-label="Menu quản trị"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>

          <Link to="/admin" className="flex items-center gap-2 font-semibold text-primary">
            <Store className="size-5" aria-hidden />
            ShopLite <span className="text-gray-400">Quản trị</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            {/* Duong ve cua hang: admin cung la nguoi mua thu, khong nen phai go tay URL. */}
            <Link
              to="/"
              className="hidden rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 sm:block"
            >
              ← Về cửa hàng
            </Link>

            <span className="max-w-[10rem] truncate px-2 text-sm text-gray-600">
              {user?.fullName}
            </span>

            <button
              onClick={() => logout.mutate()}
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              aria-label="Đăng xuất"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        {menuOpen && <div className="border-t border-gray-200 px-4 py-2 md:hidden">{nav}</div>}
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          {/* sticky: bang san pham dai vai man hinh, sidebar phai theo kip. */}
          <div className="sticky top-20">{nav}</div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* min-w-0 la bat buoc: khong co no, bang rong ben trong flex item se
              day ca layout gian ra thay vi tu cuon trong khung cua no. */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
