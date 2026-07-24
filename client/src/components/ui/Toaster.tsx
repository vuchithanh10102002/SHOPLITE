import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type ToastKind } from "@/lib/toast";
import { cn } from "@/lib/cn";

const STYLE: Record<ToastKind, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-gray-200 bg-white text-gray-900",
};

const ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

/** Dat MOT lan o App. Doc tu store nen goi duoc ca tu ngoai React (queryClient). */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    // aria-live: screen reader doc thong bao moi ma khong cuop focus cua nguoi dung.
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-3 text-sm shadow-lg",
              STYLE[t.kind],
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Đóng thông báo"
              className="shrink-0 rounded p-0.5 hover:bg-black/5"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
