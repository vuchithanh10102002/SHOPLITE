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
 *
 * ═══ DA THU va DA BO: `eager` + fetchpriority="high" cho 4 the dau ═══
 * Lighthouse mobile (Phase 7 buoc 5) bao phan tu LCP cua /products la mot anh
 * trong luoi, kem 3 goi y: dung lazy cho anh LCP, them fetchpriority=high, cho
 * anh xuat hien som trong HTML. Da lam thu dung vay va DO LAI — no lam TE HON,
 * on dinh qua nhieu lan chay (Performance / LCP mobile, cung mot may, cung data):
 *
 *   lazy het (hien tai)               87–89  /  LCP 3.4s
 *   4 the dau eager + priority high   82–83  /  LCP 4.0–4.2s
 *   ... + decoding="sync"             75–76  /  LCP 5.4–5.6s
 *
 * (Ba dong tren do LIEN TIEP trong cung mot buoi, luc anh seed con la 600x400 —
 * so sanh voi NHAU thi dung, con doi chieu voi bang trong README thi khong, vi
 * sau do anh seed doi sang 400x400.)
 *
 * Vi sao goi y dung cua Lighthouse lai sai o day: no gia dinh MOT anh LCP lon
 * (anh hero) canh tranh voi thu khac. Luoi nay la 8 anh KICH CO NHU NHAU tren
 * mot duong truyen bi that co — cho 4 anh cung uu tien cao thi chung chia deu
 * bang thong va cung ve MUON, ma LCP tinh theo cai ve SAU CUNG. De mac dinh thi
 * trinh duyet tai lech nhau, anh dau xong som hon. `decoding="sync"` con tra gia
 * them vi ep giai ma tren main thread truoc khi ve khung hinh.
 *
 * Bai hoc: goi y cua cong cu do la GIA THUYET, phai do lai moi biet. Neu sau nay
 * co anh banner/hero that thi ap dung lai cho RIENG anh do (mot anh, khong phai
 * ca luoi) va do lai lan nua.
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
