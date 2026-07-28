import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuthStore } from "./store";
import { toast } from "@/lib/toast";
import type { ApiSuccess, SessionResponse } from "@/api/types";
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from "./schemas";

/**
 * Cac mutation KHONG tu bat loi: component nao goi thi tu hien loi tren form
 * (Handbook 7.3 — "loi chung hien tren form"). QueryCache.onError chi bat QUERY,
 * khong bat mutation, nen o day khong bi toast trung.
 */

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await api.post<ApiSuccess<SessionResponse>>("/auth/login", input);
      return res.data.data;
    },
    onSuccess: ({ accessToken, user }) => setSession(accessToken, user),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const res = await api.post("/auth/register", input);
      return res.data.data;
    },
  });
}

/**
 * CO Y dung useQuery chu khong useMutation, du la POST: man nay khong co nut bam, mo
 * link trong mail la chay ngay. Voi useMutation phai tu goi trong useEffect + mot ref
 * chan goi hai lan, va chinh cap do sinh ra bug — StrictMode thao/lap lai component →
 * observer moi cua useMutation ve `idle` trong khi ref van bat nen khong ai goi lai →
 * man hinh KET O SPINNER vinh vien du API da chay xong. Da gap that.
 *
 * useQuery khong dinh vi ket qua nam trong QueryCache theo `queryKey`, lan mount thu
 * hai doc lai cache do.
 *
 * Cac option deu BAT BUOC, khong phai trang tri: token tieu sau lan goi dau nen MOI
 * lan goi lai deu 400 → refetch bat ky (focus/mount/reconnect) bien "thanh cong"
 * thanh "that bai". `meta.silent` de QueryCache.onError khong toast trung — trang nay
 * tu ve khung loi rieng.
 */
export function useVerifyEmail(token: string | null) {
  return useQuery({
    queryKey: ["verify-email", token],
    queryFn: async () => {
      const res = await api.post("/auth/verify-email", { token });
      // queryFn KHONG duoc tra undefined (v5 coi la loi) — endpoint nay co the
      // khong tra data nen chot bang null.
      return res.data.data ?? null;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    meta: { silent: true },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      const res = await api.post("/auth/forgot-password", input);
      return res.data.data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const res = await api.post("/auth/reset-password", input);
      return res.data.data;
    },
  });
}

export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => api.post("/auth/logout"),

    // onSettled chu KHONG onSuccess: /logout hong (mat mang, cookie da het han) thi
    // van phai dang xuat o phia client — giu user o trang thai "da dang nhap" voi
    // mot phien da chet la te nhat.
    onSettled: () => {
      clearSession();
      // Xoa cache: gio hang / don hang cua nguoi vua dang xuat KHONG duoc de lai
      // cho nguoi dang nhap tiep theo tren cung may nhin thay.
      queryClient.clear();
      toast.success("Đã đăng xuất");
      navigate("/");
    },
  });
}
