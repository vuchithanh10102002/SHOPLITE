import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

export function Forbidden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <ShieldOff className="size-12 text-gray-300" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">Không có quyền truy cập</h1>
      <p className="mt-2 max-w-md text-gray-600">
        Tài khoản của bạn không được phép xem trang này. Nếu bạn nghĩ đây là nhầm lẫn, hãy liên hệ
        quản trị viên.
      </p>
      <Link to="/" className={buttonClass("primary", "md", "mt-6")}>
        Về trang chủ
      </Link>
    </div>
  );
}
