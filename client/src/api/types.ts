/**
 * Kieu du lieu API — chep tay tu shape THAT backend tra ve (server/src/modules/*,
 * cac interface Public*). Khong sinh tu OpenAPI: du an nho, them mot buoc build de
 * sai nhip. Doi lai phai ky luat — doi shape o backend thi sua o day.
 *
 * Luu y xuyen suot: moi so TIEN la `string` (Prisma Decimal → string o backend).
 * KHONG parseFloat roi tinh toan — dinh sai so float. Chi parse khi can hien thi.
 * Moi moc THOI GIAN la string ISO (res.json() serialize Date thanh ISO).
 */

// ─── Envelope chung (server/src/shared/response.ts) ────────────────────────

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

/** Shape loi chuan (server/src/middlewares/errorHandler.ts). */
export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export type Role = "CUSTOMER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  emailVerified: boolean;
}

/** /auth/login VA /auth/refresh cung tra shape nay → FE dung chung setSession(). */
export interface SessionResponse {
  accessToken: string;
  user: User;
}

// ─── Catalog ──────────────────────────────────────────────────────────────

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

/** GET /api/categories tra CAY 2 cap (khong co parentId — quan he nam o `children`). */
export interface Category {
  id: string;
  name: string;
  slug: string;
  children: Category[];
}

export interface ProductImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  stockStatus: StockStatus; // backend CO Y khong lo con so `stock` ra public
  category: { id: string; name: string; slug: string };
  images: ProductImage[];
  createdAt: string;
}

// ─── Cart ─────────────────────────────────────────────────────────────────

/** Shape PHANG (khong long `product`) — xem PublicCartItem o cart.service.ts. */
export interface CartItem {
  id: string; // id CART ITEM (dung cho PATCH/DELETE /cart/items/:id), khong phai productId
  productId: string;
  name: string;
  slug: string;
  price: string;
  image: string | null;
  quantity: number;
  stockStatus: StockStatus; // thong tin HIEN TAI, khong phai snapshot
  isUnavailable: boolean; // product da soft-delete → gach di + chan checkout (BR5)
}

/** Backend KHONG tra tong tien gio — FE tu cong (xem cartTotal() trong lib/format). */
export interface Cart {
  items: CartItem[];
}

// ─── Orders ───────────────────────────────────────────────────────────────

export type OrderStatus = "PENDING" | "PAID" | "SHIPPED" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export interface OrderItem {
  productId: string;
  productName: string; // SNAPSHOT luc dat — doi ten san pham KHONG doi don cu
  unitPrice: string; // SNAPSHOT gia
  quantity: number;
}

export interface OrderHistory {
  fromStatus: OrderStatus | null; // ban ghi dau (tao don) khong co trang thai truoc
  toStatus: OrderStatus;
  reason: string | null;
  createdAt: string;
}

export interface Payment {
  status: PaymentStatus;
  amount: string;
  providerTxnId: string | null;
  createdAt: string;
}

/** GET /api/orders — nhe hon detail, khong keo items/history. */
export interface OrderSummary {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  itemCount: number;
  createdAt: string;
}

/** GET /api/orders/:id */
export interface Order {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  shippingAddress: string;
  createdAt: string;
  items: OrderItem[];
  history: OrderHistory[];
  payment: Payment | null; // null truoc khi finalize
}
