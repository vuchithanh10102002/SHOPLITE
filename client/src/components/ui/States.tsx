import type { ReactNode } from "react";
import { Loader2, PackageOpen, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * BA trang thai KHAC NHAU, nguoi moi hay gop lam mot (Handbook 7.4):
 *   loading — dang tai      → Skeleton (khong phai spinner giua man)
 *   empty   — tai xong, khong co du lieu → goi y hanh dong
 *   error   — tai that bai  → co nut thu lai
 * Gom vao mot file de moi man dung cung mot bo, khong moi noi mot kieu.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-gray-200", className)} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-gray-400", className)} aria-hidden />;
}

/** Man cho toan trang (vd dang bootstrap phien luc khoi dong app). */
export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Đang tải">
      <Spinner className="size-8" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = PackageOpen,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: typeof PackageOpen;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <Icon className="size-10 text-gray-300" aria-hidden />
      <p className="mt-3 font-medium text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <TriangleAlert className="size-10 text-red-400" aria-hidden />
      <p className="mt-3 font-medium text-red-900">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
