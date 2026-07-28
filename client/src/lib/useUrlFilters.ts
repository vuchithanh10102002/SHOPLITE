import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Bo loc song trong URL (Handbook 7.1) — F5 giu nguyen ket qua, copy link gui cho
 * nhau thi ben kia thay dung cai minh dang xem.
 *
 * BAY QUAN TRONG NHAT nam o `resetPage` (Roadmap 6.2, loi dau bang): doi bo loc ma
 * khong ve trang 1 thi nguoi dang o trang 5 loc lai con 2 trang → xin page=5 →
 * backend tra mang rong → man hinh bao "khong co du lieu" trong khi thuc te co. MAC
 * DINH la reset; chi nut phan trang truyen resetPage=false.
 *
 * Xoa han key khi gia tri rong (thay vi de `?q=`) cho khop cach backend coi chuoi
 * rong la "khong loc" (blankToUndefined trong cac *.schemas.ts).
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();

  const patch = useCallback(
    (next: Record<string, string>, resetPage = true) => {
      setParams(
        (prev) => {
          const merged = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(next)) {
            if (value) merged.set(key, value);
            else merged.delete(key);
          }
          if (resetPage) merged.delete("page");
          return merged;
        },
        // replace: doi bo loc khong nen sinh mot muc lich su moi — bam Back sau
        // khi go 5 chu trong o tim se phai bam 5 lan moi ra khoi trang.
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => setParams({}, { replace: true }), [setParams]);

  return { params, patch, clear };
}
