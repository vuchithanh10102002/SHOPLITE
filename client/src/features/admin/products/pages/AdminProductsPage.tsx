import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { errorMessage } from "@/api/client";
import { useDebounce } from "@/lib/useDebounce";
import { useUrlFilters } from "@/lib/useUrlFilters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { formatVnd, cloudinaryThumb } from "@/lib/format";
import { flattenCategories, useCategories } from "@/features/catalog/hooks";
import { Button, buttonClass } from "@/components/ui/Button";
import { SELECT_CLASS } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyRow, SkeletonRows, Table, Td, Th } from "@/components/ui/Table";
import { ErrorState } from "@/components/ui/States";
import { useAdminProducts, useDeleteProduct, useRestoreProduct } from "../hooks";
import type { AdminProduct } from "@/api/types";

const COLS = 7;

/** Hanh dong dang cho xac nhan — mot state duy nhat cho ca xoa lan khoi phuc. */
type Pending = { kind: "delete" | "restore"; product: AdminProduct } | null;

export function AdminProductsPage() {
  const { params, patch, clear } = useUrlFilters();

  const q = params.get("q") ?? "";
  const categoryId = params.get("categoryId") ?? "";
  const includeDeleted = params.get("includeDeleted") === "true";
  const page = Number(params.get("page")) || 1;

  // O tim la state cuc bo roi debounce vao URL — go phim nao cung ghi URL thi
  // lich su trinh duyet day rac va request ban theo tung phim.
  const [search, setSearch] = useState(q);
  const debounced = useDebounce(search, 400);

  useEffect(() => {
    if (debounced !== q) patch({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- patch doc params moi lan render
  }, [debounced]);

  useEffect(() => {
    setSearch(q); // URL doi tu ben ngoai (Back/Forward, "Xoa bo loc") → keo vao o
  }, [q]);

  const categories = useCategories();
  const query = useAdminProducts({
    q: q || undefined,
    categoryId: categoryId || undefined,
    includeDeleted: includeDeleted ? "true" : "false",
    page,
  });

  const remove = useDeleteProduct();
  const restore = useRestoreProduct();
  const [pending, setPending] = useState<Pending>(null);

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;
  const busy = remove.isPending || restore.isPending;

  function confirmPending() {
    if (!pending) return;
    const { kind, product } = pending;
    const mutation = kind === "delete" ? remove : restore;

    mutation.mutate(product.id, {
      onSuccess: () => {
        setPending(null);
        toast.success(kind === "delete" ? `Đã xóa "${product.name}"` : `Đã khôi phục "${product.name}"`);
      },
      // Loi thi GIU modal mo va hien message ngay trong do: dong modal roi ban
      // mot toast do thi nguoi dung khong biet minh vua bam vao dong nao.
      onError: (error) => toast.error(errorMessage(error, "Không thực hiện được")),
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Sản phẩm</h1>

        <Link to="/admin/products/new" className={buttonClass("primary", "sm", "ml-auto")}>
          <Plus className="size-4" aria-hidden />
          Thêm sản phẩm
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên (không cần dấu)…"
            aria-label="Tìm sản phẩm"
            className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => patch({ categoryId: e.target.value })}
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

        <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => patch({ includeDeleted: e.target.checked ? "true" : "" })}
            className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          Hiện cả hàng đã xóa
        </label>

        {(q || categoryId || includeDeleted) && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Xóa bộ lọc
          </Button>
        )}
      </div>

      <div className="mt-4">
        {query.isError ? (
          <ErrorState
            message={errorMessage(query.error, "Không tải được danh sách sản phẩm")}
            onRetry={() => query.refetch()}
          />
        ) : (
          <Table className={cn(query.isFetching && "opacity-60 transition-opacity")}>
            <thead>
              <tr>
                <Th className="w-14">Ảnh</Th>
                <Th>Tên</Th>
                <Th>Danh mục</Th>
                <Th className="text-right">Giá</Th>
                <Th className="text-right">Tồn kho</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>

            <tbody>
              {query.isPending ? (
                <SkeletonRows cols={COLS} />
              ) : items.length === 0 ? (
                <EmptyRow colSpan={COLS}>
                  Không có sản phẩm nào khớp bộ lọc.
                </EmptyRow>
              ) : (
                items.map((p) => {
                  const deleted = p.deletedAt !== null;
                  const thumb = cloudinaryThumb(p.images[0]?.url ?? null, 80);

                  return (
                    <tr key={p.id} className={cn("hover:bg-gray-50", deleted && "bg-gray-50/60")}>
                      <Td>
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className={cn("size-10 rounded object-cover", deleted && "opacity-50")}
                          />
                        ) : (
                          <div className="size-10 rounded bg-gray-100" aria-hidden />
                        )}
                      </Td>

                      <Td>
                        <Link
                          to={`/admin/products/${p.id}/edit`}
                          className={cn(
                            "font-medium text-gray-900 hover:text-primary hover:underline",
                            // Gach ten hang da xoa — nhin luot qua bang la biet ngay
                            // dong nao khong con ban.
                            deleted && "text-gray-500 line-through",
                          )}
                        >
                          {p.name}
                        </Link>
                        <div className="text-xs text-gray-400">{p.slug}</div>
                      </Td>

                      <Td className="text-gray-600">{p.category.name}</Td>
                      <Td className="text-right tabular-nums">{formatVnd(p.price)}</Td>
                      <Td
                        className={cn(
                          "text-right tabular-nums",
                          p.stock === 0 ? "text-red-600" : p.stock <= 5 && "text-amber-600",
                        )}
                      >
                        {p.stock}
                      </Td>

                      <Td>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            deleted ? "bg-gray-200 text-gray-600" : "bg-primary-light text-primary",
                          )}
                        >
                          {deleted ? "Đã xóa" : "Đang bán"}
                        </span>
                      </Td>

                      <Td>
                        <div className="flex justify-end gap-1">
                          <Link to={`/admin/products/${p.id}/edit`} className={buttonClass("secondary", "sm")}>
                            Sửa
                          </Link>

                          {deleted ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setPending({ kind: "restore", product: p })}
                            >
                              <RotateCcw className="size-4" aria-hidden />
                              Khôi phục
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setPending({ kind: "delete", product: p })}
                              aria-label={`Xóa ${p.name}`}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        )}

        {meta && (
          <Pagination
            meta={meta}
            disabled={query.isFetching}
            onChange={(next) => {
              patch({ page: String(next) }, false);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        danger={pending?.kind === "delete"}
        title={pending?.kind === "delete" ? "Xóa sản phẩm?" : "Khôi phục sản phẩm?"}
        confirmLabel={pending?.kind === "delete" ? "Xóa" : "Khôi phục"}
        loading={busy}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
        message={
          pending?.kind === "delete" ? (
            <>
              Sản phẩm <b>{pending?.product.name}</b> sẽ bị ẩn khỏi cửa hàng. Đây là xóa mềm — đơn
              hàng cũ vẫn giữ nguyên và bạn khôi phục lại được bất cứ lúc nào.
            </>
          ) : (
            <>
              Sản phẩm <b>{pending?.product.name}</b> sẽ hiện lại trong cửa hàng và khách mua được
              ngay.
            </>
          )
        }
      />
    </div>
  );
}
