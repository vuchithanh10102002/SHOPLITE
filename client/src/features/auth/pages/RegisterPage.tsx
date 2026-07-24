import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { errorMessage } from "@/api/client";
import { useRegister } from "../hooks";
import { registerSchema, type RegisterInput } from "../schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function RegisterPage() {
  const signup = useRegister();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit((values) => signup.mutate(values));

  // Dang ky xong KHONG tu dang nhap: BR4 muon nguoi dung di qua buoc xac thuc email.
  if (signup.isSuccess) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Kiểm tra email của bạn</h1>
        <p className="mt-2 text-sm text-gray-600">
          Chúng tôi đã gửi liên kết xác thực tới <strong>{getValues("email")}</strong>. Mở email và
          bấm vào liên kết để kích hoạt tài khoản.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-primary hover:underline">
          Về trang đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Tạo tài khoản</h1>
      <p className="mt-1 text-sm text-gray-500">Chỉ mất chưa đến một phút.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          label="Họ và tên"
          autoComplete="name"
          placeholder="Nguyễn Văn A"
          error={errors.fullName?.message}
          {...register("fullName")}
        />

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="ban@email.com"
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          placeholder="Ít nhất 8 ký tự"
          error={errors.password?.message}
          {...register("password")}
        />

        {signup.isError && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
            {errorMessage(signup.error, "Đăng ký thất bại")}
          </p>
        )}

        <Button type="submit" loading={signup.isPending} className="w-full">
          Đăng ký
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Đã có tài khoản?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
