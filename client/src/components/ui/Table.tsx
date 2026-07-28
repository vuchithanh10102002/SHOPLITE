import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Bang tu viet (Roadmap 6.1: "khong can TanStack Table cho <= 10 cot"). KHONG phai
 * data-grid — khong sort/resize/virtual scroll, chi la vo dung chung.
 *
 * Thu duy nhat dang goi la logic o day: khung cuon ngang. Bang admin 6-7 cot phai
 * cuon TRONG khung cua no, khong thi ca trang bi keo rong va moi trang khac lech theo.
 *
 * `compact` tat san min-width do (bang 2-3 cot trong the hep khong can 42rem, ep vao
 * thi cuon ngang ngay tren man hinh rong). Phai la MOT PROP chu khong phai truyen
 * `className="min-w-0"`: `cn()` chi noi chuoi (lib/cn.ts co y khong dung
 * tailwind-merge) nen hai class min-width cung ton tai, va cai thang la cai xep sau
 * trong file CSS — override kieu do im lang khong an thua.
 */
export function Table({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className={cn("w-full text-sm", !compact && "min-w-[42rem]", className)}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      // scope="col": screen reader doc duoc "cot Giá" khi di qua o du lieu.
      scope="col"
      className={cn(
        "border-b border-gray-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-gray-100 px-3 py-2.5 align-middle", className)} {...rest}>
      {children}
    </td>
  );
}

/** Dong "khong co du lieu" nam TRONG bang — giu nguyen header de nguoi dung con thay cot nao dang loc. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-gray-500">
        {children}
      </td>
    </tr>
  );
}

/** Skeleton dung so cot that — khung khong nhay khi du lieu ve. */
export function SkeletonRows({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <Td key={c}>
              <div className="h-4 animate-pulse rounded bg-gray-200" />
            </Td>
          ))}
        </tr>
      ))}
    </>
  );
}
