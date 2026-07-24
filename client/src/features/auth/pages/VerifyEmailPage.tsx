import { Link, useSearchParams } from "react-router-dom";
import { CircleCheck, CircleX } from "lucide-react";
import { errorMessage } from "@/api/client";
import { useVerifyEmail } from "../hooks";
import { Spinner } from "@/components/ui/States";
import { buttonClass } from "@/components/ui/Button";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  // Hook tu goi API mot lan khi co token (xem chu thich trong useVerifyEmail):
  // khong useEffect, khong ref chan goi hai lan — QueryCache lo ca hai viec do.
  const verify = useVerifyEmail(token);

  if (!token) {
    return (
      <Result
        ok={false}
        title="Liên kết không hợp lệ"
        message="Đường dẫn thiếu mã xác thực. Hãy mở lại liên kết trong email."
      />
    );
  }

  if (verify.isPending) {
    return (
      <div className="flex flex-col items-center py-6">
        <Spinner className="size-8" />
        <p className="mt-3 text-sm text-gray-600">Đang xác thực email…</p>
      </div>
    );
  }

  if (verify.isError) {
    return (
      <Result
        ok={false}
        title="Xác thực thất bại"
        message={errorMessage(verify.error, "Mã xác thực không hợp lệ hoặc đã hết hạn.")}
      />
    );
  }

  return (
    <Result
      ok
      title="Xác thực thành công"
      message="Tài khoản của bạn đã được kích hoạt. Bây giờ bạn có thể đặt hàng."
    />
  );
}

function Result({ ok, title, message }: { ok: boolean; title: string; message: string }) {
  const Icon = ok ? CircleCheck : CircleX;

  return (
    <div className="text-center">
      <Icon className={ok ? "mx-auto size-10 text-primary" : "mx-auto size-10 text-red-500"} aria-hidden />
      <h1 className="mt-3 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
      <Link to="/login" className={buttonClass("primary", "md", "mt-6")}>
        Đăng nhập
      </Link>
    </div>
  );
}
