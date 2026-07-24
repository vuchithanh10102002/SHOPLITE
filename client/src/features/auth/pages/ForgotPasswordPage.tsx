import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { errorMessage } from "@/api/client";
import { useForgotPassword } from "../hooks";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ForgotPasswordPage() {
  const forgot = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit((values) => forgot.mutate(values));

  // Backend LUON tra 200 du email co ton tai hay khong (chong do email co trong he
  // thong). Man hinh nay phai noi y het sac trung tinh — dung "neu email ton tai".
  if (forgot.isSuccess) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Đã gửi hướng dẫn</h1>
        <p className="mt-2 text-sm text-gray-600">
          Nếu email bạn nhập có trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu. Hãy kiểm
          tra hộp thư.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-primary hover:underline">
          Về trang đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Quên mật khẩu</h1>
      <p className="mt-1 text-sm text-gray-500">
        Nhập email đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="ban@email.com"
          error={errors.email?.message}
          {...register("email")}
        />

        {forgot.isError && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
            {errorMessage(forgot.error, "Không gửi được email")}
          </p>
        )}

        <Button type="submit" loading={forgot.isPending} className="w-full">
          Gửi liên kết
        </Button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </>
  );
}
