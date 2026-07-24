import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import type { PageMeta } from "@/api/types";

/**
 * Phan trang toi gian: Truoc / "Trang x / y" / Sau.
 *
 * Khong ve day so trang: backend tra `totalPages` nen ve duoc, nhung voi catalog
 * co vai chuc trang thi day so day man hinh ma khong giup gi hon. Them khi nao
 * that su can nhay xa.
 *
 * `meta` la envelope tu backend (shared/response.ts) — nguon duy nhat cua page/
 * totalPages, KHONG tu dem o client.
 */
export function Pagination({
  meta,
  onChange,
  disabled = false,
}: {
  meta: PageMeta;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  // Mot trang thi khong hien gi — thanh dieu huong tro thanh rac thi thoi.
  if (meta.totalPages <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Phân trang">
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled || meta.page <= 1}
        onClick={() => onChange(meta.page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
        Trước
      </Button>

      {/* aria-live: doi trang bang nut thi screen reader doc duoc vi tri moi. */}
      <span className="text-sm text-gray-600" aria-live="polite">
        Trang {meta.page} / {meta.totalPages}
      </span>

      <Button
        variant="secondary"
        size="sm"
        disabled={disabled || meta.page >= meta.totalPages}
        onClick={() => onChange(meta.page + 1)}
      >
        Sau
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}
