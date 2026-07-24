import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Menu, Package, ShoppingCart, Store, User as UserIcon, X } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";
import { useLogout } from "@/features/auth/hooks";
import { useCartCount } from "@/features/cart/hooks";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/", label: "Trang chủ", end: true },
  { to: "/products", label: "Sản phẩm", end: false },
];

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive ? "bg-primary-light text-primary" : "text-gray-700 hover:bg-gray-100",
  );
}

export function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const logout = useLogout();
  const navigate = useNavigate();
  const cartCount = useCartCount();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-primary">
            <Store className="size-5" aria-hidden />
            ShopLite
          </Link>

          <nav className="ml-4 hidden gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/cart"
              className="relative rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              aria-label={`Giỏ hàng${cartCount ? `, ${cartCount} sản phẩm` : ""}`}
            >
              <ShoppingCart className="size-5" aria-hidden />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            {status === "authed" && user ? (
              <div className="hidden items-center gap-1 md:flex">
                <Link
                  to="/orders"
                  className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
                  aria-label="Đơn hàng của tôi"
                >
                  <Package className="size-5" aria-hidden />
                </Link>

                {user.role === "ADMIN" && (
                  <Link to="/admin" className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Quản trị
                  </Link>
                )}

                <span className="max-w-[10rem] truncate px-2 text-sm text-gray-600">
                  {user.fullName}
                </span>

                <button
                  onClick={() => logout.mutate()}
                  className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
                  aria-label="Đăng xuất"
                >
                  <LogOut className="size-5" aria-hidden />
                </button>
              </div>
            ) : (
              status === "anon" && (
                <div className="hidden items-center gap-2 md:flex">
                  <Link to="/login" className={buttonClass("ghost", "sm")}>
                    Đăng nhập
                  </Link>
                  <Link to="/register" className={buttonClass("primary", "sm")}>
                    Đăng ký
                  </Link>
                </div>
              )
            )}

            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        {/* Menu mobile — DoD Phase 5 yeu cau hamburger hoat dong tren iPhone 12. */}
        {menuOpen && (
          <div className="border-t border-gray-200 bg-white px-4 py-2 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}

              {status === "authed" && user ? (
                <>
                  <NavLink to="/orders" className={navClass} onClick={() => setMenuOpen(false)}>
                    Đơn hàng của tôi
                  </NavLink>
                  {user.role === "ADMIN" && (
                    <NavLink to="/admin" className={navClass} onClick={() => setMenuOpen(false)}>
                      Quản trị
                    </NavLink>
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout.mutate();
                    }}
                    className="rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Đăng xuất ({user.fullName})
                  </button>
                </>
              ) : (
                status === "anon" && (
                  <>
                    <NavLink to="/login" className={navClass} onClick={() => setMenuOpen(false)}>
                      Đăng nhập
                    </NavLink>
                    <NavLink to="/register" className={navClass} onClick={() => setMenuOpen(false)}>
                      Đăng ký
                    </NavLink>
                  </>
                )
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-6 text-sm text-gray-500">
          <UserIcon className="size-4" aria-hidden />
          ShopLite — dự án học tập full stack.
          <button
            onClick={() => navigate("/products")}
            className="ml-auto text-primary hover:underline"
          >
            Xem sản phẩm
          </button>
        </div>
      </footer>
    </div>
  );
}
