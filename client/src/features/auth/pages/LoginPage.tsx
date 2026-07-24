import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { errorMessage } from "@/api/client";
import { useAuthStore } from "../store";
import { useLogin } from "../hooks";
import { loginSchema, type LoginInput } from "../schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const login = useLogin();

  // Chuyen huong ve dung cho user dinh vao truoc khi bi chan (RequireAuth gan ?from=).
  const from = params.get("from") || "/";

  // Da dang nhap roi ma vao /login (bam back, hoac go tay) → day thang ve dich.
  useEffect(() => {
    if (status === "authed") navigate(from, { replace: true });
  }, [status, from, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, { onSuccess: () => navigate(from, { replace: true }) });
  });

  // BR4: chua verify email VAN dang nhap duoc — backend tra 200 kem token. Cho nen
  // o day khong co nhanh xu ly rieng; chan chi xay ra luc DAT HANG (403).
  return (
    <>
      <h1 className="text-xl font-semibold">Đăng nhập</h1>
      <p className="mt-1 text-sm text-gray-500">Chào mừng bạn quay lại ShopLite.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {/* Loi CHUNG (INVALID_CREDENTIALS, TOO_MANY_REQUESTS) — khac loi tung field.
            Message tieng Viet lay thang tu envelope backend, khong viet lai o FE. */}
        {login.isError && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
            {errorMessage(login.error, "Đăng nhập thất bại")}
          </p>
        )}

        <Button type="submit" loading={login.isPending} className="w-full">
          Đăng nhập
        </Button>
      </form>

      <div className="mt-4 flex justify-between text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">
          Quên mật khẩu?
        </Link>
        <Link to="/register" className="text-primary hover:underline">
          Tạo tài khoản
        </Link>
      </div>
    </>
  );
}
