import type { CartItem, OrderStatus, StockStatus } from "@/api/types";

/**
 * Tien te: backend tra CHUOI (Decimal → string) de khong dinh sai so float.
 * Chi doi sang number ngay tai day, dung de HIEN THI. Khong dung ket qua nay lam
 * dau vao tinh toan roi gui nguoc len server — tong tien luon do server tinh (BR3).
 */
export function formatVnd(amount: string | number): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "—";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Tong tien gio — backend KHONG tra tong (PublicCart chi co `items`), FE tu cong.
 * Cong bang number la chap nhan duoc o day vi chi de HIEN THI; con so quyet dinh
 * van do server tinh lai luc dat hang.
 */
export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

// ─── Nhan tieng Viet ───────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  SHIPPED: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

/** Mau badge theo trang thai — dung chung cho danh sach lan timeline. */
export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  SHIPPED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-primary-light text-primary",
  CANCELLED: "bg-gray-200 text-gray-600",
};

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: "Còn hàng",
  low_stock: "Sắp hết hàng",
  out_of_stock: "Hết hàng",
};

export const STOCK_STATUS_CLASS: Record<StockStatus, string> = {
  in_stock: "text-emerald-700",
  low_stock: "text-amber-700",
  out_of_stock: "text-gray-500",
};

/**
 * Anh Cloudinary: chen transform vao URL de tai dung kich thuoc can dung.
 * `f_auto` (webp/avif neu trinh duyet ho tro) + `q_auto` — Handbook 7.4.
 * URL khong phai Cloudinary thi tra nguyen (vd anh seed tu nguon khac).
 */
export function cloudinaryThumb(url: string | null, width = 400): string | null {
  if (!url) return null;
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/w_${width},f_auto,q_auto/`);
}
