import { Link } from "react-router-dom";
import { ImageOff, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { errorMessage } from "@/api/client";
import { useCart, useClearCart, useRemoveCartItem, useUpdateCartItem } from "../hooks";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { cartTotal, cloudinaryThumb, formatVnd } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CartItem } from "@/api/types";

const MAX_QUANTITY = 999;

export function CartPage() {
  const cart = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();

  if (cart.isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (cart.isError) {
    return (
      <ErrorState
        message={errorMessage(cart.error, "Không tải được giỏ hàng")}
        onRetry={() => cart.refetch()}
      />
    );
  }

  const items = cart.data.items;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Giỏ hàng đang trống"
        description="Thêm vài sản phẩm rồi quay lại đây nhé."
        icon={ShoppingCart}
        action={
          <Link to="/products" className={buttonClass("primary")}>
            Xem sản phẩm
          </Link>
        }
      />
    );
  }

  /**
   * BR5: san pham da bi go ban van HIEN trong gio (kem co `isUnavailable`) chu
   * khong tu bien mat — bien mat lang le thi nguoi dung tuong minh bam nham. Bu
   * lai, con mot mon nhu vay la CHAN thanh toan, vi backend se tu choi ca don.
   */
  const blocked = items.some((i) => i.isUnavailable);
  const total = cartTotal(items.filter((i) => !i.isUnavailable));

  function changeQuantity(item: CartItem, next: number) {
    if (next < 1 || next > MAX_QUANTITY) return;
    updateItem.mutate({ id: item.id, quantity: next });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Giỏ hàng</h1>
        <Button
          variant="ghost"
          size="sm"
          loading={clearCart.isPending}
          onClick={() => clearCart.mutate()}
        >
          <Trash2 className="size-4" aria-hidden />
          Xóa tất cả
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const thumb = cloudinaryThumb(item.image, 160);

          return (
            <div
              key={item.id}
              className={cn(
                "flex gap-3 rounded-xl border bg-white p-3",
                item.isUnavailable ? "border-red-200 bg-red-50/40" : "border-gray-200",
              )}
            >
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                {thumb ? (
                  <img src={thumb} alt="" className="size-full object-cover" />
                ) : (
                  <ImageOff className="size-6 text-gray-300" aria-hidden />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  to={`/products/${item.slug}`}
                  className={cn(
                    "line-clamp-2 text-sm font-medium hover:text-primary",
                    item.isUnavailable && "text-gray-500 line-through",
                  )}
                >
                  {item.name}
                </Link>

                {item.isUnavailable ? (
                  <p className="mt-1 text-xs text-red-700">
                    Sản phẩm đã ngừng bán — hãy xóa khỏi giỏ để thanh toán.
                  </p>
                ) : (
                  item.stockStatus === "out_of_stock" && (
                    <p className="mt-1 text-xs text-amber-700">
                      Tạm hết hàng — đặt lúc này có thể không thành công.
                    </p>
                  )
                )}

                <p className="mt-1 text-sm text-gray-600">{formatVnd(item.price)}</p>

                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-gray-300">
                    <button
                      onClick={() => changeQuantity(item, item.quantity - 1)}
                      // quantity = 0 la 400 o backend (muon bo thi dung DELETE) →
                      // chan tu day, khong de nguoi dung bam ra loi vo nghia.
                      disabled={item.quantity <= 1 || item.isUnavailable}
                      aria-label={`Giảm số lượng ${item.name}`}
                      className="p-1.5 text-gray-600 disabled:opacity-40"
                    >
                      <Minus className="size-4" aria-hidden />
                    </button>

                    <span className="w-9 text-center text-sm font-medium">{item.quantity}</span>

                    <button
                      onClick={() => changeQuantity(item, item.quantity + 1)}
                      disabled={item.quantity >= MAX_QUANTITY || item.isUnavailable}
                      aria-label={`Tăng số lượng ${item.name}`}
                      className="p-1.5 text-gray-600 disabled:opacity-40"
                    >
                      <Plus className="size-4" aria-hidden />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem.mutate({ id: item.id })}
                    className="text-sm text-gray-500 hover:text-red-600"
                  >
                    Xóa
                  </button>
                </div>
              </div>

              <p className="shrink-0 self-center text-sm font-semibold">
                {formatVnd(Number(item.price) * item.quantity)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Tạm tính</span>
          <span className="text-lg font-semibold text-primary">{formatVnd(total)}</span>
        </div>

        <p className="mt-1 text-xs text-gray-500">
          Tổng tiền cuối cùng do máy chủ tính lại lúc đặt hàng (BR3).
        </p>

        {blocked ? (
          <Button className="mt-4 w-full" disabled>
            Xóa sản phẩm ngừng bán để tiếp tục
          </Button>
        ) : (
          <Link to="/checkout" className={buttonClass("primary", "md", "mt-4 w-full")}>
            Thanh toán
          </Link>
        )}
      </div>
    </div>
  );
}
