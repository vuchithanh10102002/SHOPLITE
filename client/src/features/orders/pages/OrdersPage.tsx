import { Link, useSearchParams } from "react-router-dom";
import { Package } from "lucide-react";
import { errorMessage } from "@/api/client";
import { useOrders } from "../hooks";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { buttonClass } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { formatDateTime, formatVnd } from "@/lib/format";

/** Danh sach don cua toi. Trang hien tai nam trong URL nen F5 khong nhay ve dau. */
export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page")) || 1;

  const orders = useOrders(page);
  const items = orders.data?.data ?? [];
  const meta = orders.data?.meta;

  return (
    <div>
      <h1 className="text-xl font-semibold">Đơn hàng của tôi</h1>

      <div className="mt-4">
        {orders.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : orders.isError ? (
          <ErrorState
            message={errorMessage(orders.error, "Không tải được đơn hàng")}
            onRetry={() => orders.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Chưa có đơn hàng nào"
            description="Khi bạn đặt hàng, đơn sẽ xuất hiện ở đây."
            icon={Package}
            action={
              <Link to="/products" className={buttonClass("primary")}>
                Bắt đầu mua sắm
              </Link>
            }
          />
        ) : (
          <>
            <ul className="space-y-3">
              {items.map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/orders/${order.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Ma don la uuid — hien 8 ky tu dau cho de doc/doi chieu,
                          ban day van nam trong URL khi bam vao. */}
                      <p className="font-medium">#{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</p>
                    </div>

                    <p className="text-sm text-gray-600">{order.itemCount} sản phẩm</p>
                    <p className="font-semibold text-primary">{formatVnd(order.totalAmount)}</p>
                    <OrderStatusBadge status={order.status} />
                  </Link>
                </li>
              ))}
            </ul>

            {meta && (
              <Pagination
                meta={meta}
                disabled={orders.isFetching}
                onChange={(next) => setParams({ page: String(next) }, { replace: true })}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
