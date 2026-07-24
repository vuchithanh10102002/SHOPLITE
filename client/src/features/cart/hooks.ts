import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorCode, errorMessage } from "@/api/client";
import { useAuthStore } from "@/features/auth/store";
import { cartCount } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { ApiSuccess, Cart } from "@/api/types";

/** MOT query key duy nhat cho gio — badge header va trang gio dung chung (Handbook 7.5). */
export const CART_KEY = ["cart"] as const;

export function useCart() {
  const status = useAuthStore((s) => s.status);

  return useQuery({
    queryKey: CART_KEY,
    queryFn: async () => {
      const res = await api.get<ApiSuccess<Cart>>("/cart");
      return res.data.data;
    },
    // Chua dang nhap thi KHONG goi — /cart yeu cau token, goi vao chi de an 401.
    // Cung phai cho "loading" xong: goi luc dang bootstrap phien se 401 oan.
    enabled: status === "authed",
  });
}

/** Badge so luong tren header. Tra 0 khi chua dang nhap / chua tai xong. */
export function useCartCount(): number {
  const { data } = useCart();
  return data ? cartCount(data.items) : 0;
}

// ─── Mutation ──────────────────────────────────────────────────────────────

/**
 * MOI endpoint mutation cua gio deu tra ve GIO DAY DU (xem cart.controller.ts),
 * nen sau khi thanh cong chi can `setQueryData` — khong ton them mot GET /cart.
 */
async function mutateCart(request: Promise<{ data: ApiSuccess<Cart> }>): Promise<Cart> {
  const res = await request;
  return res.data.data;
}

/**
 * Khuon optimistic dung chung cho nut +/- va nut xoa item: sua cache TRUOC, goi
 * API sau. Bam "+" ma phai cho mang moi thay so nhay la cam giac cham nhat cua
 * mot gio hang.
 *
 * Ba moc bat buoc (Roadmap 5.1 buoc 6):
 *   onMutate  — huy query dang bay (khong thi response cu ve sau se ghi de ban
 *               optimistic vua dat), luu ban cu de con duong lui
 *   onError   — tra lai ban cu NGAY (invalidate cung refetch nhung mat vai tram
 *               ms, trong luc do man hinh dang hien so sai) roi moi dong bo lai
 *   onSuccess — lay gio that tu server, khong tu suy dien
 */
function useOptimisticCart<TVars>(
  mutationFn: (vars: TVars) => Promise<Cart>,
  patch: (cart: Cart, vars: TVars) => Cart,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,

    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: CART_KEY });
      const previous = queryClient.getQueryData<Cart>(CART_KEY);
      if (previous) queryClient.setQueryData<Cart>(CART_KEY, patch(previous, vars));
      return { previous };
    },

    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CART_KEY, context.previous);
      toast.error(errorMessage(error, "Không cập nhật được giỏ hàng"));
      // Kho da doi ben server (INSUFFICIENT_STOCK) → ban cu cung khong con dung.
      // Lay lai su that thay vi tin vao snapshot.
      queryClient.invalidateQueries({ queryKey: CART_KEY });
    },

    onSuccess: (cart) => queryClient.setQueryData(CART_KEY, cart),
  });
}

/**
 * Them vao gio. KHONG optimistic: item moi can `id` cua cart item do server sinh
 * (dung cho PATCH/DELETE sau do) — bia mot id gia roi bam nut xoa ngay se goi API
 * voi id khong ton tai. Doi vai tram ms o day chap nhan duoc, khac nut +/- bam
 * lien tuc.
 */
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { productId: string; quantity: number }) =>
      mutateCart(api.post<ApiSuccess<Cart>>("/cart/items", vars)),

    onSuccess: (cart) => {
      queryClient.setQueryData(CART_KEY, cart);
      toast.success("Đã thêm vào giỏ hàng");
    },

    onError: (error) => {
      // Backend tra message tieng Viet san (vd "Chỉ còn 3 sản phẩm trong kho") —
      // hien nguyen van, khong viet lai o FE de hai ben khong lech.
      toast.error(errorMessage(error, "Không thêm được vào giỏ"));
      if (errorCode(error) === "INSUFFICIENT_STOCK") {
        queryClient.invalidateQueries({ queryKey: CART_KEY });
      }
    },
  });
}

export function useUpdateCartItem() {
  return useOptimisticCart(
    ({ id, quantity }: { id: string; quantity: number }) =>
      mutateCart(api.patch<ApiSuccess<Cart>>(`/cart/items/${id}`, { quantity })),
    (cart, { id, quantity }) => ({
      items: cart.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
    }),
  );
}

export function useRemoveCartItem() {
  return useOptimisticCart(
    ({ id }: { id: string }) => mutateCart(api.delete<ApiSuccess<Cart>>(`/cart/items/${id}`)),
    (cart, { id }) => ({ items: cart.items.filter((i) => i.id !== id) }),
  );
}

/** `<void>` tuong minh de goi duoc `clearCart.mutate()` khong tham so. */
export function useClearCart() {
  return useOptimisticCart<void>(
    () => mutateCart(api.delete<ApiSuccess<Cart>>("/cart")),
    () => ({ items: [] }),
  );
}
