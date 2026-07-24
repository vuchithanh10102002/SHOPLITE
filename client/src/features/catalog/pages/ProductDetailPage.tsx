import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ImageOff, Minus, Plus, ShoppingCart } from "lucide-react";
import { errorCode, errorMessage } from "@/api/client";
import { useProduct } from "../hooks";
import { useAddToCart } from "@/features/cart/hooks";
import { useAuthStore } from "@/features/auth/store";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { cloudinaryThumb, formatVnd, STOCK_STATUS_CLASS, STOCK_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";

const MAX_QUANTITY = 999; // khop max cua cart.schemas.ts ben backend

export function ProductDetailPage() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const status = useAuthStore((s) => s.status);

  const product = useProduct(slug);
  const addToCart = useAddToCart();

  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  if (product.isPending) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square" />
        <div className="space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (product.isError) {
    // 404 la "san pham nay khong ton tai / da go ban" — mot ket qua binh thuong,
    // khong phai su co. Tach khoi nhanh loi that (mat mang, 500) de khong doa
    // nguoi dung bang khung do.
    if (errorCode(product.error) === "NOT_FOUND") {
      return (
        <EmptyState
          title="Sản phẩm không tồn tại"
          description="Sản phẩm có thể đã bị gỡ khỏi cửa hàng."
          action={
            <Link to="/products" className={buttonClass("primary")}>
              Xem sản phẩm khác
            </Link>
          }
        />
      );
    }

    return (
      <ErrorState
        message={errorMessage(product.error, "Không tải được sản phẩm")}
        onRetry={() => product.refetch()}
      />
    );
  }

  const data = product.data;
  const images = data.images;
  const mainImage = cloudinaryThumb(images[activeImage]?.url ?? null, 800);
  const soldOut = data.stockStatus === "out_of_stock";

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
          {mainImage ? (
            <img src={mainImage} alt={data.name} className="size-full object-cover" />
          ) : (
            <ImageOff className="size-10 text-gray-300" aria-hidden />
          )}
        </div>

        {images.length > 1 && (
          <div className="mt-3 flex gap-2">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActiveImage(i)}
                aria-label={`Ảnh ${i + 1}`}
                aria-current={i === activeImage}
                className={cn(
                  "size-16 overflow-hidden rounded-lg border",
                  i === activeImage ? "border-primary" : "border-gray-200",
                )}
              >
                <img
                  src={cloudinaryThumb(img.url, 160) ?? ""}
                  alt=""
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <Link
          to={`/products?categoryId=${data.category.id}`}
          className="text-sm text-primary hover:underline"
        >
          {data.category.name}
        </Link>

        <h1 className="mt-1 text-2xl font-semibold">{data.name}</h1>

        <p className="mt-3 text-2xl font-semibold text-primary">{formatVnd(data.price)}</p>

        <p className={cn("mt-1 text-sm", STOCK_STATUS_CLASS[data.stockStatus])}>
          {STOCK_STATUS_LABEL[data.stockStatus]}
        </p>

        {data.description && (
          // whitespace-pre-line: giu xuong dong admin go, van la text thuan.
          // KHONG dangerouslySetInnerHTML — DoD Phase 5 kiem chinh diem nay (XSS).
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {data.description}
          </p>
        )}

        <div className="mt-6">
          {status === "anon" ? (
            // Chua dang nhap: dan sang /login kem ?from de dang nhap xong quay lai
            // dung trang nay, khong bat nguoi ta tu tim lai san pham.
            <Link
              to={`/login?from=${encodeURIComponent(location.pathname)}`}
              className={buttonClass("primary", "lg")}
            >
              Đăng nhập để mua hàng
            </Link>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-gray-300">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Giảm số lượng"
                  className="p-2 text-gray-600 disabled:opacity-40"
                >
                  <Minus className="size-4" aria-hidden />
                </button>

                <span className="w-10 text-center text-sm font-medium" aria-live="polite">
                  {quantity}
                </span>

                <button
                  onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
                  disabled={quantity >= MAX_QUANTITY}
                  aria-label="Tăng số lượng"
                  className="p-2 text-gray-600 disabled:opacity-40"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>

              <Button
                size="lg"
                // Het hang thi chan ngay o FE cho de hieu; chot cung van la
                // check ton kho cua backend (va cuoi cung la transaction dat hang).
                disabled={soldOut}
                loading={addToCart.isPending}
                onClick={() => addToCart.mutate({ productId: data.id, quantity })}
              >
                <ShoppingCart className="size-4" aria-hidden />
                {soldOut ? "Hết hàng" : "Thêm vào giỏ"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
