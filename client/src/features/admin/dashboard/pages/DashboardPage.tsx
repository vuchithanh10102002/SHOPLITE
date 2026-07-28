import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Package, Receipt, Users, Wallet } from "lucide-react";
import { errorMessage } from "@/api/client";
import { cn } from "@/lib/cn";
import { formatVnd, ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from "@/lib/format";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, Td, Th } from "@/components/ui/Table";
import { useDashboard } from "../hooks";
import type { DashboardData, OrderStatus } from "@/api/types";

/**
 * Mau cua VACH DU LIEU, khong phai mau thuong hieu: `--color-primary` (#065f46)
 * truot check "chroma floor" — o dang net 2px hay thanh nho no doc ra gan nhu xam.
 * #047857 la buoc ke ben trong CUNG ho mau va qua du kiem tra.
 *
 * Ca hai bieu do chi co MOT chuoi du lieu nen khong can bang mau phan loai, cung vi
 * the khong can legend.
 */
const MARK = "#047857";
const MARK_MUTED = "#a7d7c5"; // cac cot khong phai top-1 o bieu do ngang

const AXIS_TICK = { fill: "#6b7280", fontSize: 12 };

/** "12,5 tr" — truc tien ma ghi du chu so thi nhan de len nhau va khong ai doc. */
function compactVnd(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

/** '2026-07-25' → '25/07' (nhan truc); ngay VN do backend tinh san. */
function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      {/* So la thong tin chinh cua the → to va dam; nhan va chu thich lui ve sau. */}
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-400">{hint}</div>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  empty,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="font-medium">{title}</h2>
      <p className="text-xs text-gray-500">{subtitle}</p>

      {/* Chieu cao CO DINH tren the cha: ResponsiveContainer lay 100% chieu cao
          cua cha, cha khong co height thi bieu do cao 0px va khong ve gi ca
          (Roadmap 6.2, bay thu ba). */}
      <div className="mt-4 h-[240px]">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Chưa có dữ liệu để vẽ.
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const query = useDashboard();
  const data = query.data;

  // Backend tra tien la CHUOI (Decimal) — Recharts can number. Doi MOT lan o day,
  // chi de VE; moi con so quyet dinh van do server tinh.
  const revenueSeries = useMemo(
    () =>
      (data?.revenueDaily ?? []).map((p) => ({
        date: p.date,
        label: dayLabel(p.date),
        revenue: Number(p.revenue),
        orders: p.orders,
      })),
    [data],
  );

  const topSeries = useMemo(
    () =>
      (data?.topProducts ?? []).map((p) => ({
        name: p.name.length > 24 ? `${p.name.slice(0, 23)}…` : p.name,
        fullName: p.name,
        quantitySold: p.quantitySold,
        revenue: Number(p.revenue),
      })),
    [data],
  );

  if (query.isError) {
    return (
      <ErrorState
        message={errorMessage(query.error, "Không tải được số liệu")}
        onRetry={() => query.refetch()}
      />
    );
  }

  if (query.isPending || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  const totalOrders = data.ordersByStatus.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tổng quan</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Doanh thu"
          value={formatVnd(data.summary.revenueTotal)}
          icon={Wallet}
          hint="Chỉ tính đơn đã thanh toán, đang giao và hoàn thành"
        />
        <StatCard
          label="Đơn hàng"
          value={String(data.summary.orderCount)}
          icon={Receipt}
          hint="Mọi đơn đã phát sinh, kể cả đã hủy"
        />
        <StatCard label="Khách hàng" value={String(data.summary.customerCount)} icon={Users} />
        <StatCard
          label="Sản phẩm"
          value={String(data.summary.productCount)}
          icon={Package}
          hint="Không tính hàng đã xóa"
        />
      </div>

      <ChartCard
        title="Doanh thu 30 ngày"
        subtitle="Theo ngày, giờ Việt Nam. Ngày không bán được gì vẫn là một điểm bằng 0."
        empty={revenueSeries.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={revenueSeries} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            {/* Luoi CHI ngang va rat nhat: no la thu de doi chieu, khong phai thu
                de nhin. Luoi doc o day chi them nhieu net cho 30 diem. */}
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              // 30 nhan ngay canh nhau se de len nhau tren dien thoai → cach 4 ngay
              // moi ghi mot cai.
              interval={4}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={compactVnd}
            />
            <Tooltip
              // Chuot vao dau doc duoc so o do — mot bieu do HTML thi phai co lop
              // hover, khong bat nguoi dung doan theo pixel.
              // Recharts 3 khai bao `value: ValueType | undefined` (co the la
              // string/mang) — ep ve number ngay tai day thay vi chu thich kieu
              // cho callback, cach do khong qua duoc tsc.
              formatter={(value, _name, item) => [
                `${formatVnd(Number(value))} · ${item.payload.orders} đơn`,
                "Doanh thu",
              ]}
              labelFormatter={(_label, payload) => payload?.[0]?.payload.date ?? ""}
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={MARK}
              strokeWidth={2}
              // 30 diem ma cham nao cung ve thi duong bien mat duoi cac cham; chi
              // hien cham o diem dang tro toi.
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Top 5 sản phẩm bán chạy"
          subtitle="Theo số lượng đã bán, tên hiện tại của sản phẩm."
          empty={topSeries.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            {/* Thanh NAM NGANG: ten san pham tieng Viet dai, de doc thi phai nam
                ngang — cot doc se xoay nhan 45 do va gan nhu khong doc duoc. */}
            <BarChart
              data={topSeries}
              layout="vertical"
              margin={{ top: 0, right: 40, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={128}
              />
              <Tooltip
                cursor={{ fill: "#f9fafb" }}
                formatter={(value, _n, item) => [
                  `${Number(value)} sản phẩm · ${formatVnd(item.payload.revenue)}`,
                  "Đã bán",
                ]}
                labelFormatter={(_l, payload) => payload?.[0]?.payload.fullName ?? ""}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
              />
              <Bar dataKey="quantitySold" radius={[0, 4, 4, 0]} barSize={18}>
                {/* Chi thanh dan dau giu mau dam — 5 thanh cung mot mau dam la
                    nam lan nhan manh, tuc la khong nhan manh gi. */}
                {topSeries.map((row, i) => (
                  <Cell key={row.fullName} fill={i === 0 ? MARK : MARK_MUTED} />
                ))}
                {/* 5 thanh thi ghi so thang len duoc — khong phai doi chieu truc. */}
                <LabelList
                  dataKey="quantitySold"
                  position="right"
                  className="fill-gray-500 text-xs"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-medium">Đơn theo trạng thái</h2>
          <p className="text-xs text-gray-500">
            Đủ cả 5 trạng thái — “0 đơn” cũng là một thông tin.
          </p>

          <div className="mt-4">
            {totalOrders === 0 ? (
              <EmptyState
                title="Chưa có đơn hàng nào"
                description="Số liệu sẽ hiện ngay khi có đơn đầu tiên."
              />
            ) : (
              <Table compact>
                <thead>
                  <tr>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Số đơn</Th>
                    <Th className="text-right">Tỷ lệ</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.ordersByStatus.map((row) => (
                    <tr key={row.status} className="hover:bg-gray-50">
                      <Td>
                        <Link
                          to={`/admin/orders?status=${row.status}`}
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium hover:underline",
                            ORDER_STATUS_CLASS[row.status as OrderStatus],
                          )}
                        >
                          {ORDER_STATUS_LABEL[row.status as OrderStatus]}
                        </Link>
                      </Td>
                      <Td className="text-right tabular-nums">{row.count}</Td>
                      <Td className="text-right tabular-nums text-gray-500">
                        {Math.round((row.count / totalOrders) * 100)}%
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </section>
      </div>

      <RevenueTable rows={data.revenueDaily} />
    </div>
  );
}

/**
 * Bang so lieu tho cua bieu do duong, gap lai trong <details>.
 *
 * Hai ly do, khong phai trang tri: (1) bieu do la hinh anh — nguoi dung screen
 * reader can mot duong doc so that; (2) DoD Phase 6 doi doi chieu so lieu voi
 * query SQL chay tay trong psql, co bang nay thi doi chieu bang mat, khong phai
 * mo DevTools.
 */
function RevenueTable({ rows }: { rows: DashboardData["revenueDaily"] }) {
  const nonEmpty = rows.filter((r) => r.orders > 0);

  return (
    <details className="rounded-xl border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Xem số liệu doanh thu dạng bảng ({nonEmpty.length}/{rows.length} ngày có đơn)
      </summary>

      <div className="mt-3">
        <Table compact>
          <thead>
            <tr>
              <Th>Ngày</Th>
              <Th className="text-right">Số đơn</Th>
              <Th className="text-right">Doanh thu</Th>
            </tr>
          </thead>
          <tbody>
            {nonEmpty.length === 0 ? (
              <tr>
                <Td colSpan={3} className="py-6 text-center text-gray-500">
                  30 ngày qua chưa có đơn nào.
                </Td>
              </tr>
            ) : (
              nonEmpty.map((r) => (
                <tr key={r.date} className="hover:bg-gray-50">
                  <Td className="whitespace-nowrap">{r.date}</Td>
                  <Td className="text-right tabular-nums">{r.orders}</Td>
                  <Td className="text-right tabular-nums">{formatVnd(r.revenue)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </details>
  );
}
