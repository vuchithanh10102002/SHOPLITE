import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { errorCode, errorMessage } from "@/api/client";
import { CART_KEY, useCart } from "@/features/cart/hooks";
import { useAuthStore } from "@/features/auth/store";
import { useCreateOrder } from "../hooks";
import { checkoutSchema, type CheckoutInput } from "../schemas";
import { Button, buttonClass } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { cartTotal, formatVnd } from "@/lib/format";

export function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const cart = useCart();
  const createOrder = useCreateOrder();

  /**
   * MOT key cho MOT lan vao trang thanh toan: mang phu, bam hai lan, F5 giua chung →
   * cung key → backend tra lai chinh don cu thay vi tao don thu hai.
   *
   * `[]` la co y — key doi theo moi render thi idempotency mat sach tac dung. Dat hang
   * xong dieu huong sang /orders/:id nen component unmount, quay lai la mot lan dat
   * MOI va useMemo sinh key khac.
   */
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutInput>({ resolver: zodResolver(checkoutSchema) });

  const onSubmit = handleSubmit((values) => {
    createOrder.mutate(
      { ...values, idempotencyKey },
      {
        onSuccess: (order) => navigate(`/orders/${order.id}`, { replace: true }),
        onError: (error) => {
          // Kho da tut giua chung → nguoi dung phai thay so lieu moi cua gio thi
          // moi hieu vi sao don khong di duoc.
          if (errorCode(error) === "INSUFFICIENT_STOCK") {
            queryClient.invalidateQueries({ queryKey: CART_KEY });
          }
        },
      },
    );
  });

  if (cart.isPending) return <Skeleton className="h-64 w-full" />;

  // `isSuccess`: dat hang xong backend don sach gio → neu khong chan o day, man
  // hinh chop mot cai "gio trong" truoc khi kip dieu huong sang trang don hang.
  if (!createOrder.isSuccess && (!cart.data || cart.data.items.length === 0)) {
    return (
      <EmptyState
        title="Không có gì để thanh toán"
        description="Giỏ hàng của bạn đang trống."
        icon={ShoppingCart}
        action={
          <Link to="/products" className={buttonClass("primary")}>
            Xem sản phẩm
          </Link>
        }
      />
    );
  }

  const items = cart.data?.items ?? [];
  const total = cartTotal(items);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
      <div>
        <h1 className="text-xl font-semibold">Thanh toán</h1>

        {/* BR4: chua xac thuc email van mua sam duoc nhung KHONG dat hang duoc
            (backend chan bang requireVerified → 403 EMAIL_NOT_VERIFIED). Bao trước
            de nguoi dung khong go het dia chi roi moi an loi. */}
        {user && !user.emailVerified && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Tài khoản chưa xác thực email nên chưa thể đặt hàng. Hãy mở email xác thực đã gửi tới{" "}
            <strong>{user.email}</strong>.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
          <Textarea
            label="Địa chỉ giao hàng"
            rows={4}
            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
            error={errors.shippingAddress?.message}
            {...register("shippingAddress")}
          />

          {createOrder.isError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {errorMessage(createOrder.error, "Đặt hàng thất bại")}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            // Button tu disable khi loading — chan double-submit ngay tren UI;
            // Idempotency-Key la lop chan thu hai o phia server.
            loading={createOrder.isPending}
            className="w-full md:w-auto"
          >
            Đặt hàng
          </Button>

          <p className="text-xs text-gray-500">
            Thanh toán mô phỏng: hệ thống xử lý ngay và trả về kết quả thành công hoặc bị từ chối.
          </p>
        </form>
      </div>

      <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-medium">Đơn của bạn</h2>

        <ul className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-gray-700">
                {item.name} × {item.quantity}
              </span>
              <span className="shrink-0">{formatVnd(Number(item.price) * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-semibold">
          <span>Tạm tính</span>
          <span className="text-primary">{formatVnd(total)}</span>
        </div>

        <Link to="/cart" className="mt-3 inline-block text-sm text-primary hover:underline">
          ← Sửa giỏ hàng
        </Link>
      </aside>
    </div>
  );
}
