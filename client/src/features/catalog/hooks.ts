import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { ApiSuccess, Category, Product } from "@/api/types";

/**
 * Tham so loc/sap xep — DUNG BANG chu khong phai kieu tu do: chung song trong URL
 * (?q=&sort=&page=) nen phai khop y het whitelist cua backend
 * (server/src/modules/products/product.schemas.ts listProductQuerySchema). Gui sai
 * gia tri sort la 400.
 */
export type ProductSort = "newest" | "price_asc" | "price_desc";

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá thấp → cao" },
  { value: "price_desc", label: "Giá cao → thấp" },
];

export interface ProductQueryParams {
  q?: string;
  categoryId?: string;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

/**
 * queryKey PHAI chua ca object tham so (Roadmap 5.2 "Query key thieu params"):
 * ['products'] co dinh thi doi bo loc se KHONG refetch — cache tra ket qua cu ma
 * khong ai bao loi. Object duoc hash on dinh boi TanStack Query nen khong can tu
 * serialize.
 */
export const productKeys = {
  all: ["products"] as const,
  list: (params: ProductQueryParams) => ["products", "list", params] as const,
  detail: (slug: string) => ["products", "detail", slug] as const,
};

export function useProducts(params: ProductQueryParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: async () => {
      // Tra ca envelope: `meta` (page/total/totalPages) nam NGOAI `data`, trang
      // danh sach can no de ve phan trang.
      const res = await api.get<ApiSuccess<Product[]>>("/products", { params });
      return res.data;
    },
    // Doi trang/bo loc thi GIU ket qua cu tren man hinh trong luc tai cai moi,
    // thay vi nhay ve trang trang (Roadmap 5.1 buoc 5). Khong co no, moi lan bam
    // "Trang sau" la mot cu giat man.
    placeholderData: keepPreviousData,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: async () => {
      const res = await api.get<ApiSuccess<Product>>(`/products/${slug}`);
      return res.data.data;
    },
    // slug rong (route chua kip co param) thi khong goi — tranh GET /products/
    enabled: slug.length > 0,
  });
}

/**
 * Cay danh muc. staleTime dai (10 phut) vi danh muc gan nhu khong doi trong mot
 * phien duyet — de mac dinh 30s se refetch lien tuc chi de nhan ve y nguyen.
 */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get<ApiSuccess<Category[]>>("/categories");
      return res.data.data;
    },
    staleTime: 10 * 60_000,
  });
}

/** Duoi cay 2 cap thanh danh sach phang cho <select> — con thut le bang "— ". */
export function flattenCategories(tree: Category[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];

  for (const parent of tree) {
    out.push({ id: parent.id, label: parent.name });
    for (const child of parent.children) {
      out.push({ id: child.id, label: `— ${child.name}` });
    }
  }

  return out;
}
