import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/**
 * So lieu cho man dashboard admin (Roadmap 6.1 buoc 5).
 *
 * DoD Phase 6 doi "so lieu khop query SQL chay tay trong psql" — nen moi con so
 * o day deu di kem cau SQL tuong duong ngay tren cho tinh no, va cac cau raw
 * duoc viet de copy thang sang psql chay lai duoc.
 *
 * HAI QUY UOC XUYEN SUOT (dung lam nguoc):
 *
 * 1. TIEN LUON LA STRING. Postgres tra `numeric`; de Prisma/JSON tu lo thi ra
 *    float — sai so ngay khi cong don. Cac cau raw cast `::text` tai cho.
 *
 * 2. COUNT(*) cua Postgres la bigint → Prisma tra ve `BigInt` cua JS, va
 *    `JSON.stringify(1n)` NEM "Do not know how to serialize a BigInt". Route se
 *    500 ma khong ai doan ra tai dau. Moi cot dem deu `::int` ngay trong SQL.
 */

/**
 * "Doanh thu" = don DA thu duoc tien. PENDING chua chac thanh, CANCELLED da hoan
 * kho va khong thu duoc dong nao — dem vao la tu thoi phong bao cao.
 *
 * Mot bien duy nhat, dung cho CA 4 the, bieu do 30 ngay lan top san pham: ba cho
 * dung ba dinh nghia khac nhau thi so lieu tren cung mot man se khong cong lai
 * duoc voi nhau.
 */
const REVENUE_STATUSES = [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED];

/**
 * Bieu do 30 ngay tinh theo NGAY VIET NAM, khong phai ngay UTC. Don dat luc 06:00
 * ngay 25 gio VN la 23:00 ngay 24 gio UTC — de nguyen UTC thi doanh thu buoi sang
 * bi day het ve hom truoc.
 *
 * Prisma map DateTime thanh `timestamp(3)` KHONG co time zone, luu gio UTC. Voi
 * kieu do, `created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'` la SAI CHIEU — no coi con
 * so dang co la gio VN roi doi di. Phai gan nhan UTC truoc rooi moi doi:
 * `created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'`.
 */
const TZ = "Asia/Ho_Chi_Minh";

const REVENUE_DAYS = 30;

export interface DashboardSummary {
  revenueTotal: string;
  orderCount: number;
  customerCount: number;
  productCount: number;
}

export interface RevenuePoint {
  date: string; // 'YYYY-MM-DD' theo gio VN
  revenue: string;
  orders: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantitySold: number;
  revenue: string;
}

export interface StatusCount {
  status: OrderStatus;
  count: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  revenueDaily: RevenuePoint[];
  topProducts: TopProduct[];
  ordersByStatus: StatusCount[];
}

/**
 * Doanh thu tung ngay trong 30 ngay gan nhat.
 *
 * `generate_series` sinh du 30 dong RUOC roi LEFT JOIN don vao — ngay khong ban
 * duoc gi van co dong `revenue: "0"`. Neu chi GROUP BY don co that, bieu do se
 * NOI LIEN hai ngay cach nhau mot tuan thanh mot doan thang di len, nhin nhu
 * ban deu moi ngay. Do la loi "duong noi qua khoang trong" kinh dien cua line chart.
 *
 * Chay tay de doi chieu (DoD):
 *   docker exec -i shoplite-postgres psql -U postgres -d shoplite -c "<cau duoi>"
 */
async function revenueDaily(): Promise<RevenuePoint[]> {
  return prisma.$queryRaw<RevenuePoint[]>`
    SELECT to_char(d.day, 'YYYY-MM-DD')            AS "date",
           COALESCE(SUM(o.total_amount), 0)::text  AS "revenue",
           COUNT(o.id)::int                        AS "orders"
    FROM generate_series(
           (now() AT TIME ZONE ${TZ})::date - (${REVENUE_DAYS - 1} || ' days')::interval,
           (now() AT TIME ZONE ${TZ})::date,
           '1 day'::interval
         ) AS d(day)
    LEFT JOIN orders o
      ON (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::date = d.day::date
     -- Dieu kien loc don PHAI nam trong ON, khong phai WHERE: o WHERE thi dong
     -- ngay khong co don (o.* toan NULL) bi loai luon → mat cac ngay rong, dung
     -- lai dung cai bay LEFT JOIN vua tranh o tren.
     AND o.status::text IN (${Prisma.join(REVENUE_STATUSES)})
    GROUP BY d.day
    ORDER BY d.day
  `;
}

/**
 * Top 5 san pham ban chay (theo SO LUONG, khong theo doanh thu — mot mon dat tien
 * ban duoc 1 cai se de len dinh bang "ban chay" mot cach vo nghia).
 *
 * `p.name` la ten HIEN TAI (join products), khong phai `oi.product_name` la
 * snapshot luc dat. Co chu y: admin nhin bang nay de quyet dinh nhap hang, ho can
 * ten hien tai de tim ra san pham; ban ghi don hang moi la cho snapshot co gia tri.
 * Product da soft-delete van tinh vao doanh so da ban — no da ban that.
 */
async function topProducts(): Promise<TopProduct[]> {
  return prisma.$queryRaw<TopProduct[]>`
    SELECT oi.product_id                             AS "productId",
           p.name                                    AS "name",
           SUM(oi.quantity)::int                     AS "quantitySold",
           SUM(oi.quantity * oi.unit_price)::text    AS "revenue"
    FROM order_items oi
    JOIN orders o   ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status::text IN (${Prisma.join(REVENUE_STATUSES)})
    GROUP BY oi.product_id, p.name
    -- Khoa phu p.name: hai san pham cung so luong ban thi thu tu giua chung khong
    -- xac dinh, moi lan tai lai bang nhay lung tung. Cung ly do da chot o list.
    -- (Khong dung dau backtick trong comment SQL: ca cau nay nam trong mot
    --  template literal, mot dau backtick la dong chuoi giua chung.)
    ORDER BY "quantitySold" DESC, p.name ASC
    LIMIT 5
  `;
}

async function getDashboard(): Promise<DashboardData> {
  const revenueWhere = { status: { in: REVENUE_STATUSES } };

  // Sau query doc lap → chay song song. Tuan tu thi thoi gian cong don, ma khong
  // cai nao can ket qua cua cai nao.
  const [revenueAgg, orderCount, customerCount, productCount, statusGroups, daily, top] =
    await Promise.all([
      // SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status IN (...);
      prisma.order.aggregate({ where: revenueWhere, _sum: { totalAmount: true } }),
      // SELECT COUNT(*) FROM orders;  ← MOI don, ke ca huy: day la "so don da
      // phat sinh", khac voi doanh thu. Hai the canh nhau co y do khac nhau.
      prisma.order.count(),
      // SELECT COUNT(*) FROM users WHERE role='CUSTOMER';
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      // SELECT COUNT(*) FROM products WHERE deleted_at IS NULL;
      prisma.product.count({ where: { deletedAt: null } }),
      // SELECT status, COUNT(*) FROM orders GROUP BY status;
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      revenueDaily(),
      topProducts(),
    ]);

  // groupBy chi tra ve trang thai CO don. Bang tren man admin phai du 5 dong —
  // "CANCELLED: 0" la mot thong tin, con dong bien mat thi nguoi doc tuong minh
  // nhin thieu. Nen bat dau tu enum va do so vao.
  const counts = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const ordersByStatus: StatusCount[] = Object.values(OrderStatus).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));

  return {
    summary: {
      // _sum tra null khi khong co dong nao khop (khong phai 0) → phai co
      // fallback, neu khong FE nhan `null` va hien "—" ngay khi shop chua ban gi.
      revenueTotal: (revenueAgg._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
      orderCount,
      customerCount,
      productCount,
    },
    revenueDaily: daily,
    topProducts: top,
    ordersByStatus,
  };
}

export const dashboardService = {
  getDashboard,
};
