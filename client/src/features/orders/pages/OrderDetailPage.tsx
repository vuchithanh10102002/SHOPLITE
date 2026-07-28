import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { errorCode, errorMessage } from "@/api/client";
import { useCancelOrder, useOrder } from "../hooks";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { OrderTimeline } from "../components/OrderTimeline";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { toast } from "@/lib/toast";
import { formatDateTime, formatVnd } from "@/lib/format";

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "Chờ xử lý",
  COMPLETED: "Đã thanh toán",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn tiền",
};

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const order = useOrder(id);
  const cancelOrder = useCancelOrder();
  const [confirming, setConfirming] = useState(false);

  if (order.isPending) return <Skeleton className="h-96 w-full" />;

  if (order.isError) {
    // 404 o day vua la "khong co don nay", vua la don CUA NGUOI KHAC — backend co
    // y tra 404 thay vi 403 de khong lo su ton tai cua don nguoi khac (IDOR).
    if (errorCode(order.error) === "NOT_FOUND") {
      return (
        <EmptyState
          title="Không tìm thấy đơn hàng"
          description="Đơn không tồn tại hoặc không thuộc tài khoản của bạn."
          action={
            <Link to="/orders" className={buttonClass("primary")}>
              Về danh sách đơn
            </Link>
          }
        />
      );
    }

    return (
      <ErrorState
        message={errorMessage(order.error, "Không tải được đơn hàng")}
        onRetry={() => order.refetch()}
      />
    );
  }

  const data = order.data;
  // BR2 (chi don CHUA giao moi huy duoc) do BACKEND quyet dinh: `allowedTransitions`
  // sinh tu TRANSITIONS trong order.state.ts. FE khong giu ban sao nao cua state
  // machine, nen khong the lech voi server va an 409 tu gay ra.
  const canCancel = data.allowedTransitions.includes("CANCELLED");

  function handleCancel() {
    cancelOrder.mutate(id, {
      onSuccess: () => {
        setConfirming(false);
        toast.success("Đã hủy đơn hàng");
      },
      onError: (error) => {
        setConfirming(false);
        // 409 ORDER_NOT_CANCELLABLE: don vua doi trang thai o tab khac / admin vua
        // chuyen sang SHIPPED. Lay lai don de nut bien mat theo su that moi.
        toast.error(errorMessage(error, "Không hủy được đơn hàng"));
        order.refetch();
      },
    });
  }

  return (
    <div>
      <Link to="/orders" className="text-sm text-primary hover:underline">
        ← Đơn hàng của tôi
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Đơn #{data.id.slice(0, 8)}</h1>
        <OrderStatusBadge status={data.status} />
        <span className="text-sm text-gray-500">{formatDateTime(data.createdAt)}</span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-medium">Sản phẩm</h2>

            <ul className="mt-3 divide-y divide-gray-100">
              {data.items.map((item) => (
                // key theo productId: mot don khong the co 2 dong cung san pham
                // (cart gop bang upsert truoc khi dat).
                <li key={item.productId} className="flex justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    {/* Ten va gia la SNAPSHOT luc dat — doi ten/gia san pham sau do
                        KHONG lam doi don cu. Vi vay khong link sang trang san pham
                        bang ten nay: san pham co the da bi go ban. */}
                    <p className="text-gray-900">{item.productName}</p>
                    <p className="text-gray-500">
                      {formatVnd(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatVnd(Number(item.unitPrice) * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-semibold">
              <span>Tổng cộng</span>
              <span className="text-primary">{formatVnd(data.totalAmount)}</span>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-medium">Địa chỉ giao hàng</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{data.shippingAddress}</p>
          </section>

          {data.payment && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="font-medium">Thanh toán</h2>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Trạng thái</dt>
                  <dd>{PAYMENT_LABEL[data.payment.status] ?? data.payment.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Số tiền</dt>
                  <dd>{formatVnd(data.payment.amount)}</dd>
                </div>
                {data.payment.providerTxnId && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Mã giao dịch</dt>
                    <dd className="truncate font-mono text-xs">{data.payment.providerTxnId}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {canCancel && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              {confirming ? (
                <>
                  <p className="text-sm text-gray-700">
                    Hủy đơn này? Hàng sẽ được trả lại kho và thao tác không thể hoàn tác.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="danger" loading={cancelOrder.isPending} onClick={handleCancel}>
                      Xác nhận hủy
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirming(false)}>
                      Giữ đơn
                    </Button>
                  </div>
                </>
              ) : (
                // Xac nhan bang mot buoc phu ngay tren trang, KHONG dung
                // window.confirm: hop thoai cua trinh duyet chan toan bo JS va
                // khong style duoc theo giao dien.
                <Button variant="danger" onClick={() => setConfirming(true)}>
                  Hủy đơn hàng
                </Button>
              )}
            </section>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-medium">Trạng thái đơn</h2>
          <div className="mt-4">
            <OrderTimeline history={data.history} />
          </div>
        </aside>
      </div>
    </div>
  );
}
