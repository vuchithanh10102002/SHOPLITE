import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <SearchX className="size-12 text-gray-300" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">Không tìm thấy trang</h1>
      <p className="mt-2 text-gray-600">Đường dẫn bạn truy cập không tồn tại hoặc đã bị xóa.</p>
      <Link to="/" className={buttonClass("primary", "md", "mt-6")}>
        Về trang chủ
      </Link>
    </div>
  );
}
