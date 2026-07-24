import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/api/types";

/** Nhan trang thai don — mot kieu duy nhat cho danh sach, chi tiet va timeline. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        ORDER_STATUS_CLASS[status],
      )}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
