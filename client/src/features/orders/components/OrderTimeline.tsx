import { ORDER_STATUS_LABEL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { OrderHistory } from "@/api/types";

/**
 * Ve dung LICH SU THAT tu bang order_status_history, khong phai bon buoc co dinh to
 * mau san: don bi HUY khong di het cac buoc, ve khung co dinh se hien "Đang giao" mo
 * mo nhu thu sap xay ra trong khi no se KHONG BAO GIO xay ra.
 *
 * `history` da duoc backend sap theo createdAt tang dan.
 */
export function OrderTimeline({ history }: { history: OrderHistory[] }) {
  return (
    <ol className="relative space-y-5 border-l border-gray-200 pl-6">
      {history.map((h, i) => {
        const isLast = i === history.length - 1;

        return (
          <li key={`${h.toStatus}-${h.createdAt}`} className="relative">
            {/* Cham moc: -left-[1.6rem] de tam cham nam dung tren duong ke doc. */}
            <span
              className={cn(
                "absolute -left-[1.6rem] top-1 size-3 rounded-full border-2 border-white",
                isLast ? "bg-primary" : "bg-gray-300",
              )}
              aria-hidden
            />

            <p className={cn("text-sm font-medium", isLast ? "text-gray-900" : "text-gray-600")}>
              {ORDER_STATUS_LABEL[h.toStatus]}
            </p>

            <p className="text-xs text-gray-500">{formatDateTime(h.createdAt)}</p>

            {h.reason && <p className="mt-0.5 text-xs text-gray-600">{h.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}
