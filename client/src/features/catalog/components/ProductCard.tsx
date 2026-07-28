import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { cloudinaryThumb, formatVnd, STOCK_STATUS_CLASS, STOCK_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Product } from "@/api/types";

/**
 * The san pham — dung chung o trang chu lan trang danh sach.
 *
 * Anh qua cloudinaryThumb de tai ban w_400 (f_auto/q_auto) thay vi anh goc vai MB.
 * `loading="lazy"` + khung `aspect-square` co dinh de anh tai sau khong lam nhay
 * layout (CLS).
 *
 * ═══ DA THU va DA BO: `eager` + fetchpriority="high" cho 4 the dau ═══
 * Lighthouse bao phan tu LCP cua /products la mot anh trong luoi va goi y bo lazy +
 * them fetchpriority. Do lai thi no TE HON, on dinh qua nhieu lan chay (LCP mobile):
 *
 *   lazy het (hien tai)               87–89  /  LCP 3.4s
 *   4 the dau eager + priority high   82–83  /  LCP 4.0–4.2s
 *   ... + decoding="sync"             75–76  /  LCP 5.4–5.6s
 *
 * Goi y do gia dinh MOT anh hero canh tranh voi thu khac; day la 8 anh KICH CO NHU
 * NHAU tren duong truyen that co — cho 4 anh cung uu tien cao thi chung chia deu bang
 * thong va cung ve MUON, ma LCP tinh theo cai ve SAU CUNG.
 *
 * Bai hoc: goi y cua cong cu do la GIA THUYET, phai do lai. Co anh hero that thi ap
 * dung cho RIENG no va do lai lan nua.
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
