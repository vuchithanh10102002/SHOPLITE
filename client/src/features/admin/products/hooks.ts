import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { productKeys } from "@/features/catalog/hooks";
import type { AdminProduct, ApiSuccess, Product } from "@/api/types";
import type { ProductPayload } from "./schemas";

export interface AdminProductParams {
  q?: string;
  categoryId?: string;
  includeDeleted?: "true" | "false";
  page?: number;
}

/**
 * Key rieng cho nhanh admin, KHONG dung chung `productKeys` cua catalog: hai ben
 * doc hai endpoint khac nhau va tra hai shape khac nhau (AdminProduct co stock/
 * deletedAt). Tron key thi mot lan invalidate ben nay se nhet du lieu thieu field
 * vao cache ben kia.
 */
export const adminProductKeys = {
  all: ["admin", "products"] as const,
  lists: ["admin", "products", "list"] as const,
  list: (params: AdminProductParams) => ["admin", "products", "list", params] as const,
  detail: (id: string) => ["admin", "products", "detail", id] as const,
};

export function useAdminProducts(params: AdminProductParams) {
  return useQuery({
    queryKey: adminProductKeys.list(params),
    queryFn: async () => {
      const res = await api.get<ApiSuccess<AdminProduct[]>>("/products/admin", { params });
      return res.data; // giu ca `meta` cho phan trang
    },
    placeholderData: keepPreviousData,
  });
}

/** Detail cho form sua: theo ID, thay ca hang da xoa, co `stock` that. */
export function useAdminProduct(id: string) {
  return useQuery({
    queryKey: adminProductKeys.detail(id),
    queryFn: async () => {
      const res = await api.get<ApiSuccess<AdminProduct>>(`/products/admin/${id}`);
      return res.data.data;
    },
    enabled: id.length > 0,
    // Form sua phai do vao o input con so ton kho MOI NHAT — dung ban cu 30s
    // nghia la admin sua gia dua tren so lieu da lac hau.
    staleTime: 0,
  });
}

/**
 * Sau moi lan ghi PHAI don CA HAI phia cache: bang admin dang mo, va catalog cua
 * khach. Backend da bump version key cua Redis nen server tra du lieu moi, nhung
 * cache trong TRINH DUYET thi khong ai bump ho — thieu `productKeys.all` thi admin
 * sua gia xong mo tab cua hang van thay gia cu va tuong backend hong.
 */
function useInvalidateProducts() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: adminProductKeys.all });
    queryClient.invalidateQueries({ queryKey: productKeys.all });
  };
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: async (input: ProductPayload) => {
      // POST tra ve Product THUONG (khong stock/deletedAt) — dung de lay `id`
      // roi di tiep sang trang sua, KHONG nhet vao cache admin.
      const res = await api.post<ApiSuccess<Product>>("/products", input);
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateProduct(id: string) {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: async (input: ProductPayload) => {
      const res = await api.patch<ApiSuccess<Product>>(`/products/${id}`, input);
      return res.data.data;
    },
    // Chi invalidate, KHONG setQueryData: response thieu stock/deletedAt nen ghi
    // thang vao cache detail admin la lam hong shape (form doc `stock` se thanh
    // undefined → o input trong → luu lan sau ghi de kho bang mot so doan mo).
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: backend chi set deletedAt. Hang van con trong don cu.
      const res = await api.delete<ApiSuccess<{ message: string }>>(`/products/${id}`);
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useRestoreProduct() {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<ApiSuccess<AdminProduct>>(`/products/${id}/restore`);
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

// ─── Anh ──────────────────────────────────────────────────────────────────

export function useUploadImage(productId: string) {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("image", file); // ten field PHAI la "image" (multer uploadSingle)

      // KHONG tu dat Content-Type: axios sinh header multipart kem `boundary`
      // ngau nhien khi thay FormData. Dat tay "multipart/form-data" la mat
      // boundary → multer khong parse duoc → 400 kho hieu.
      const res = await api.post<ApiSuccess<Product>>(`/products/${productId}/images`, form);
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteImage(productId: string) {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: async (imageId: string) => {
      const res = await api.delete<ApiSuccess<Product>>(
        `/products/${productId}/images/${imageId}`,
      );
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}
