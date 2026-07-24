import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { cloudinaryThumb, formatVnd, STOCK_STATUS_CLASS, STOCK_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Product } from "@/api/types";

/**
 * The san pham — dung chung o trang chu lan trang danh sach, mot noi sua la ca
 * hai doi.
 *
 * Anh: backend tra mang `images` da sap theo sortOrder, lay tam anh dau. Qua
 * cloudinaryThumb de tai ban w_400 (f_auto/q_auto) thay vi anh goc vai MB.
 * `loading="lazy"` + khung `aspect-square` co dinh: anh tai sau KHONG lam nhay
 * layout (CLS) vi cho da duoc giu san.
 */
export function ProductCard({ product }: { product: Product }) {
  const thumb = cloudinaryThumb(product.images[0]?.url ?? null);
  const soldOut = product.stockStatus === "out_of_stock";

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-primary hover:shadow-sm"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-gray-100">
        {thumb ? (
          <img
            src={thumb}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <ImageOff className="size-8 text-gray-300" aria-hidden />
        )}
      </div>

      <div className="space-y-1 p-3">
        {/* line-clamp-2: ten dai khong duoc lam the cao thap khac nhau trong luoi. */}
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-gray-900">
          {product.name}
        </p>
        <p className="font-semibold text-primary">{formatVnd(product.price)}</p>
        <p className={cn("text-xs", STOCK_STATUS_CLASS[product.stockStatus])}>
          {soldOut ? "Hết hàng" : STOCK_STATUS_LABEL[product.stockStatus]}
        </p>
      </div>
    </Link>
  );
}
