import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../shared/errors";
import { stockStatusOf, StockStatus } from "../../shared/stock";
import { AddCartItemInput } from "./cart.schemas";

// Lay product cua item KHONG loc deletedAt: product bi soft-delete van phai hien
// trong gio (gan co isUnavailable) de frontend gach + chan checkout (BR5). Neu
// loc deletedAt:null o day thi relation tra null → mat item hoac no. `price`/
// `stock`/`deletedAt` la thong tin noi bo, chi dung de dung PublicCartItem —
// khong tra thang ra ngoai.
const cartItemSelect = {
  id: true,
  quantity: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      stock: true,
      deletedAt: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  },
} satisfies Prisma.CartItemSelect;

type CartItemRow = Prisma.CartItemGetPayload<{ select: typeof cartItemSelect }>;

export interface PublicCartItem {
  id: string; // id cua cart item, dung cho PATCH/DELETE /items/:id
  productId: string;
  name: string;
  slug: string;
  price: string; // Decimal → string, gom mot cho (giong product)
  image: string | null; // anh dau tien (sortOrder nho nhat), co the chua co anh
  quantity: number;
  stockStatus: StockStatus; // thong tin HIEN TAI, khong phai snapshot
  isUnavailable: boolean; // product da soft-delete → khong dat hang duoc
}

export interface PublicCart {
  items: PublicCartItem[];
}

function toPublicCartItem(row: CartItemRow): PublicCartItem {
  const p = row.product;
  return {
    id: row.id,
    productId: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price.toString(),
    image: p.images[0]?.url ?? null,
    quantity: row.quantity,
    stockStatus: stockStatusOf(p.stock),
    isUnavailable: p.deletedAt !== null,
  };
}

/**
 * Gio cua toi. Chua co cart → tra gio RONG, KHONG 404: gio trong la trang thai
 * hop le. Sap xep on dinh theo id cart item.
 */
async function getCart(userId: string): Promise<PublicCart> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: { items: { select: cartItemSelect, orderBy: { id: "asc" } } },
  });

  return { items: (cart?.items ?? []).map(toPublicCartItem) };
}

/**
 * Them item. Trung product → CONG DON quantity (FR-CT1) bang upsert increment,
 * khong doc-roi-ghi. Check ton kho o day la CHECK MEM: chan UX xau som, co race
 * va khong sao — nguon chan ly la check cung trong transaction dat hang (b4).
 */
async function addItem(userId: string, input: AddCartItemInput): Promise<PublicCart> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, deletedAt: null },
    select: { id: true, name: true, stock: true },
  });
  if (!product) throw Errors.notFound("sản phẩm");

  // Lazy create cart: lan dau moi sinh row (Cart.userId unique).
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });

  // So luong SAU khi cong don phai <= ton kho (check mem). Doc so hien co truoc.
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    select: { quantity: true },
  });
  const newQuantity = (existing?.quantity ?? 0) + input.quantity;
  if (newQuantity > product.stock) throw Errors.insufficientStock(product.name);

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    create: { cartId: cart.id, productId: product.id, quantity: input.quantity },
    update: { quantity: { increment: input.quantity } },
  });

  return getCart(userId);
}

/**
 * Doi quantity mot item. IDOR: rang buoc item thuoc cart CUA USER NAY qua
 * `cart: { userId }` — khong khop thi 404, khong lo item nguoi khac. Quantity
 * moi la GIA TRI TUYET DOI (khong cong don nhu add).
 */
async function updateItem(
  userId: string,
  itemId: string,
  quantity: number,
): Promise<PublicCart> {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
    select: { id: true, product: { select: { name: true, stock: true } } },
  });
  if (!item) throw Errors.notFound("sản phẩm trong giỏ");

  if (quantity > item.product.stock) throw Errors.insufficientStock(item.product.name);

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });

  return getCart(userId);
}

/** Xoa mot item — cung rang buoc IDOR qua cart.userId. */
async function removeItem(userId: string, itemId: string): Promise<PublicCart> {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
    select: { id: true },
  });
  if (!item) throw Errors.notFound("sản phẩm trong giỏ");

  await prisma.cartItem.delete({ where: { id: item.id } });

  return getCart(userId);
}

/** Don sach gio. Chua co cart → khong lam gi, van tra gio rong. */
async function clear(userId: string): Promise<PublicCart> {
  const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return { items: [] };
}

export const cartService = { getCart, addItem, updateItem, removeItem, clear };
