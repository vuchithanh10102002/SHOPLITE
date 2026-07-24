import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck } from "lucide-react";
import { errorMessage } from "@/api/client";
import { useResetPassword } from "../hooks";
import { resetPasswordSchema, type ResetPasswordInput } from "../schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { buttonClass } from "@/components/ui/Button";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const reset = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    // Token den tu URL chu khong tu ban phim → nap san vao form de zod validate
    // cung mot cho, thay vi rai them mot nhanh if rieng.
    defaultValues: { token },
  });

  const onSubmit = handleSubmit((values) => reset.mutate(values));

  if (reset.isSuccess) {
    return (
      <div className="text-center">
        <CircleCheck className="mx-auto size-10 text-primary" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Đổi mật khẩu thành công</h1>
        <p className="mt-2 text-sm text-gray-600">
          Mật khẩu đã được cập nhật. Hãy đăng nhập bằng mật khẩu mới.
        </p>
        <Link to="/login" className={buttonClass("primary", "md", "mt-6")}>
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold">Liên kết không hợp lệ</h1>
        <p className="mt-2 text-sm text-gray-600">
          Đường dẫn thiếu mã đặt lại mật khẩu. Hãy yêu cầu gửi lại liên kết.
        </p>
        <Link to="/forgot-password" className={buttonClass("primary", "md", "mt-6")}>
          Gửi lại liên kết
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Đặt lại mật khẩu</h1>
      <p className="mt-1 text-sm text-gray-500">Nhập mật khẩu mới cho tài khoản của bạn.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <input type="hidden" {...register("token")} />

        <Input
          label="Mật khẩu mới"
          type="password"
          autoComplete="new-password"
          placeholder="Ít nhất 8 ký tự"
          error={errors.password?.message}
          {...register("password")}
        />

        {reset.isError && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
            {errorMessage(reset.error, "Đặt lại mật khẩu thất bại")}
          </p>
        )}

        <Button type="submit" loading={reset.isPending} className="w-full">
          Đổi mật khẩu
        </Button>
      </form>
    </>
  );
}
