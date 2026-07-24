import { Link, Outlet } from "react-router-dom";
import { Store } from "lucide-react";

/** Layout gon cho Login/Register/Verify/Forgot/Reset — khong header/nav gay xao nhang. */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2 text-xl font-semibold text-primary">
        <Store className="size-6" aria-hidden />
        ShopLite
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <Outlet />
      </div>

      <Link to="/" className="mt-6 text-sm text-gray-500 hover:text-gray-700">
        ← Về trang chủ
      </Link>
    </div>
  );
}
