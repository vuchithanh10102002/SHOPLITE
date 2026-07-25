import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "@/api/client";
import { useUrlFilters } from "@/lib/useUrlFilters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { formatDateTime, formatVnd, ORDER_STATUS_LABEL } from "@/lib/format";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { Button } from "@/components/ui/Button";
import { SELECT_CLASS } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyRow, SkeletonRows, Table, Td, Th } from "@/components/ui/Table";
import { ErrorState } from "@/components/ui/States";
import { useAdminOrders, useUpdateOrderStatus } from "../hooks";
import type { AdminOrderSummary, OrderStatus } from "@/api/types";

const COLS = 7;

const STATUS_FILTERS: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "COMPLETED", "CANCELLED"];

/**
 * Hai buoc chuyen KHONG LUI LAI DUOC — phai hoi truoc khi lam.
 * (CANCELLED va COMPLETED la hai trang thai cuoi trong TRANSITIONS: tu do khong
 * di dau duoc nua, va CANCELLED con hoan kho.)
 */
const IRREVERSIBLE: OrderStatus[] = ["CANCELLED", "COMPLETED"];

type Pending = { order: AdminOrderSummary; status: OrderStatus } | null;

export function AdminOrdersPage() {
  const { params, patch, clear } = useUrlFilters();

  const status = (params.get("status") as OrderStatus | null) ?? "";
  const page = Number(params.get("page")) || 1;

  const query = useAdminOrders({
    status: status || undefined,
    page,
  });
  const changeStatus = useUpdateOrderStatus();
  const [pending, setPending] = useState<Pending>(null);

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;

  function apply(order: AdminOrderSummary, next: OrderStatus) {
    changeStatus.mutate(
      { id: order.id, status: next },
      {
        onSuccess: () => {
          setPending(null);
          toast.success(`Đơn đã chuyển sang "${ORDER_STATUS_LABEL[next]}"`);
        },
        onError: (error) => {
          setPending(null);
          // 409 INVALID_STATUS_TRANSITION / ORDER_STATUS_CHANGED: co the ai do
          // vua doi don nay o tab khac. Message tieng Viet tu backend noi ro.
          toast.error(errorMessage(error, "Không đổi được trạng thái"));
        },
      },
    );
  }

  /** Chon trong dropdown: viec kho lui thi hoi, con lai lam luon. */
  function choose(order: AdminOrderSummary, next: OrderStatus) {
    if (IRREVERSIBLE.includes(next)) setPending({ order, status: next });
    else apply(order, next);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Đơn hàng</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => patch({ status: e.target.value })}
          aria-label="Lọc theo trạng thái"
          className={SELECT_CLASS}
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        {status && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Xóa bộ lọc
          </Button>
        )}

        {meta && <span className="ml-auto text-sm text-gray-500">{meta.total} đơn</span>}
      </div>

      <div className="mt-4">
        {query.isError ? (
          <ErrorState
            message={errorMessage(query.error, "Không tải được danh sách đơn")}
            onRetry={() => query.refetch()}
          />
        ) : (
          <Table className={cn(query.isFetching && "opacity-60 transition-opacity")}>
            <thead>
              <tr>
                <Th>Mã đơn</Th>
                <Th>Khách hàng</Th>
                <Th className="text-right">Số món</Th>
                <Th className="text-right">Tổng tiền</Th>
                <Th>Trạng thái</Th>
                <Th>Đặt lúc</Th>
                <Th className="text-right">Đổi trạng thái</Th>
              </tr>
            </thead>

            <tbody>
              {query.isPending ? (
                <SkeletonRows cols={COLS} />
              ) : items.length === 0 ? (
                <EmptyRow colSpan={COLS}>Không có đơn nào khớp bộ lọc.</EmptyRow>
              ) : (
                items.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <Td>
                      {/* Trang chi tiet don dung chung voi khach: backend cho ADMIN
                          xem don cua bat ky ai (IDOR check: cua toi HOAC admin). */}
                      <Link
                        to={`/orders/${o.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {o.id.slice(0, 8)}…
                      </Link>
                    </Td>

                    <Td className="max-w-[14rem] truncate text-gray-700">{o.userEmail}</Td>
                    <Td className="text-right tabular-nums">{o.itemCount}</Td>
                    <Td className="text-right tabular-nums font-medium">{formatVnd(o.totalAmount)}</Td>
                    <Td>
                      <OrderStatusBadge status={o.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-gray-500">{formatDateTime(o.createdAt)}</Td>

                    <Td>
                      <div className="flex justify-end">
                        {o.allowedTransitions.length === 0 ? (
                          // Trang thai cuoi (COMPLETED/CANCELLED): khong con buoc
                          // nao — hien chu thay vi mot dropdown rong bam duoc.
                          <span className="text-xs text-gray-400">Đã kết thúc</span>
                        ) : (
                          <select
                            // `value=""` co dinh + onChange: day la mot MENU HANH
                            // DONG chu khong phai o nhap. Neu de no giu gia tri vua
                            // chon thi sau khi doi xong, o select se hien mot trang
                            // thai "da chon" khac voi badge ben canh.
                            value=""
                            disabled={changeStatus.isPending}
                            onChange={(e) => {
                              const next = e.target.value as OrderStatus;
                              if (next) choose(o, next);
                            }}
                            aria-label={`Đổi trạng thái đơn ${o.id.slice(0, 8)}`}
                            className={cn(SELECT_CLASS, "h-8 py-0 text-xs")}
                          >
                            {/* CHI hien cac buoc backend cho phep — danh sach do
                                chinh la TRANSITIONS trong order.state.ts, tra qua
                                API. FE khong giu ban sao nao nen khong the lech,
                                va nguoi dung khong bam nham de an 409. */}
                            <option value="">Đổi sang…</option>
                            {o.allowedTransitions.map((s) => (
                              <option key={s} value={s}>
                                {ORDER_STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))
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
        danger={pending?.status === "CANCELLED"}
        title={pending?.status === "CANCELLED" ? "Hủy đơn này?" : "Hoàn thành đơn này?"}
        confirmLabel={pending?.status === "CANCELLED" ? "Hủy đơn" : "Hoàn thành"}
        loading={changeStatus.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && apply(pending.order, pending.status)}
        message={
          pending?.status === "CANCELLED" ? (
            <>
              Đơn <b>{pending?.order.id.slice(0, 8)}…</b> của {pending?.order.userEmail} sẽ chuyển
              sang <b>Đã hủy</b> và toàn bộ hàng được <b>hoàn lại kho</b>. Không lùi lại được.
            </>
          ) : (
            <>
              Đơn <b>{pending?.order.id.slice(0, 8)}…</b> sẽ chuyển sang <b>Hoàn thành</b>. Đây là
              trạng thái cuối — sau đó không đổi sang trạng thái nào khác được nữa.
            </>
          )
        }
      />
    </div>
  );
}
