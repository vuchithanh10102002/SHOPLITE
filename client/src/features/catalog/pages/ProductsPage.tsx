import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/lib/useDebounce";
import { errorMessage } from "@/api/client";
import {
  flattenCategories,
  SORT_OPTIONS,
  useCategories,
  useProducts,
  type ProductSort,
} from "../hooks";
import { ProductCard } from "../components/ProductCard";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, ProductCardSkeleton } from "@/components/ui/States";
import { cn } from "@/lib/cn";

const SELECT_CLASS =
  "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary";

/**
 * Danh sach san pham. NGUON CHAN LY CUA BO LOC LA URL (Handbook 7.1), khong phai
 * useState: nho vay F5 giu nguyen ket qua, va nguoi dung copy link gui cho nhau
 * thi ben kia thay dung cai minh dang xem — DoD Phase 5 kiem dung diem nay
 * (`/products?q=nồi&sort=price_asc&page=2` → F5 → y nguyen).
 */
export function ProductsPage() {
  const [params, setParams] = useSearchParams();

  const q = params.get("q") ?? "";
  const categoryId = params.get("categoryId") ?? "";
  const sort = (params.get("sort") as ProductSort | null) ?? "newest";
  const page = Number(params.get("page")) || 1;

  // O tim kiem la ngoai le duy nhat duoc giu state cuc bo: go phim nao cung ghi
  // thang vao URL thi lich su trinh duyet day rac va request ban theo tung phim.
  const [search, setSearch] = useState(q);
  const debouncedSearch = useDebounce(search, 400);

  /**
   * Doi bo loc thi PHAI ve trang 1. Dang o trang 5 ma loc lai con 2 trang → xin
   * page=5 → backend tra mang rong → "khong tim thay san pham" trong khi thuc te
   * co. Loi nay im lang va rat de bo sot.
   *
   * Xoa han key khi gia tri rong thay vi de `?q=` — URL sach, va khop cach
   * backend coi chuoi rong la "khong loc" (blankToUndefined).
   */
  function patchParams(patch: Record<string, string>, resetPage = true) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (resetPage) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  // Debounce xong moi day vao URL. So sanh voi `q` hien tai de khong ghi de mot
  // gia tri y het (moi lan ghi la mot lan render + mot lan doi lich su).
  useEffect(() => {
    if (debouncedSearch !== q) patchParams({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- patchParams doc params moi lan render
  }, [debouncedSearch]);

  // Chieu nguoc lai: URL doi tu BEN NGOAI o tim kiem (bam Back/Forward, hoac nut
  // "Xoa bo loc") thi keo gia tri moi vao o. Khong gay ping-pong voi effect tren
  // vi hai ben hoi tu ve cung mot chuoi roi dung.
  useEffect(() => {
    setSearch(q);
  }, [q]);

  const categories = useCategories();
  const products = useProducts({
    q: q || undefined,
    categoryId: categoryId || undefined,
    sort,
    page,
  });

  const items = products.data?.data ?? [];
  const meta = products.data?.meta;
  const hasFilter = Boolean(q || categoryId) || sort !== "newest";

  return (
    <div>
      <h1 className="text-xl font-semibold">Sản phẩm</h1>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm sản phẩm (không cần dấu)…"
            aria-label="Tìm sản phẩm"
            className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => patchParams({ categoryId: e.target.value })}
          aria-label="Lọc theo danh mục"
          className={SELECT_CLASS}
        >
          <option value="">Tất cả danh mục</option>
          {flattenCategories(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => patchParams({ sort: e.target.value })}
          aria-label="Sắp xếp"
          className={SELECT_CLASS}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
            <X className="size-4" aria-hidden />
            Xóa bộ lọc
          </Button>
        )}
      </div>

      <div className="mt-6">
        {products.isPending ? (
          // Skeleton dung khung the that (khong spinner giua man) — mat khong bi
          // giat khi du lieu ve vi cho da dung san.
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.isError ? (
          <ErrorState
            message={errorMessage(products.error, "Không tải được danh sách sản phẩm")}
            onRetry={() => products.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Không có sản phẩm nào khớp"
            description="Thử bỏ bớt bộ lọc hoặc tìm bằng từ khóa ngắn hơn."
            action={
              hasFilter && (
                <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                  Xóa bộ lọc
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* keepPreviousData giu ket qua cu lúc dang tai trang moi; lam mo nhe
                de nguoi dung biet so lieu chua phai cua trang vua bam. */}
            <div
              className={cn(
                "grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-4",
                products.isFetching && "opacity-60",
              )}
            >
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            {meta && (
              <Pagination
                meta={meta}
                disabled={products.isFetching}
                onChange={(next) => {
                  patchParams({ page: String(next) }, false);
                  window.scrollTo({ top: 0 });
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
