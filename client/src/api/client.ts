import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/features/auth/store";
import type { ApiError, ApiSuccess, SessionResponse } from "./types";

/**
 * baseURL "/api" + Vite proxy — CHOT MOT CACH, khong dat them host tuyet doi o day
 * (Roadmap 5.2 canh bao lan giua 2 cach). Cung origin voi trang → cookie httpOnly
 * `refreshToken` tu dong dinh kem. `withCredentials` van bat du cung-origin, de doi
 * sang deploy khac domain thi khong phai nho quay lai sua.
 */
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// ─── Request: gan Bearer token tu store (memory) ───────────────────────────

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response: 401 → refresh MOT LAN → phat lai request goc ────────────────

/** Cho phep danh dau request da thu lai — chan vong lap 401 vo tan. */
type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

/**
 * Gop N request 401 dong thoi thanh MOT lan refresh — BAT BUOC vi backend co ROTATION
 * + REUSE DETECTION: request thu hai se gui refresh token vua bi xoay, backend coi la
 * ke gian va REVOKE CA FAMILY → nguoi dung bi da van ra ngoai.
 */
let refreshing: Promise<string> | null = null;

/** Client rieng, KHONG interceptor: /refresh ma 401 thi khong duoc goi lai chinh no. */
const bareClient = axios.create({ baseURL: "/api", withCredentials: true });

function refreshSession(): Promise<string> {
  refreshing ??= bareClient
    .post<ApiSuccess<SessionResponse>>("/auth/refresh")
    .then((res) => {
      const { accessToken, user } = res.data.data;
      // /refresh tra ca user (server/src/modules/auth/auth.service.ts) → khoi phuc
      // du phien sau F5 bang 1 request, khong can decode JWT o client.
      useAuthStore.getState().setSession(accessToken, user);
      return accessToken;
    })
    .finally(() => {
      refreshing = null; // reset DU thanh hay bai, neu khong lan sau se dinh promise cu
    });

  return refreshing;
}

api.interceptors.response.use(null, async (error: AxiosError<ApiError>) => {
  const original = error.config as RetriableConfig | undefined;

  // Chi thu refresh khi: dung 401, co config de phat lai, va CHUA tung thu.
  if (error.response?.status === 401 && original && !original._retried) {
    original._retried = true;

    try {
      const token = await refreshSession();
      original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
      return api(original); // phat lai request goc
    } catch {
      // Refresh cung hong → xoa phien de RequireAuth day ve /login. KHONG navigate o
      // day: module nay nam ngoai React, dieu huong la viec cua router.
      useAuthStore.getState().clearSession();
    }
  }

  return Promise.reject(error);
});

/**
 * Goi luc app khoi dong: co cookie thi lay lai phien, khong thi danh dau anonymous.
 * Dung bareClient — khong de interceptor 401 o tren bat lay roi refresh de quy.
 */
export async function bootstrapSession(): Promise<void> {
  try {
    const res = await bareClient.post<ApiSuccess<SessionResponse>>("/auth/refresh");
    const { accessToken, user } = res.data.data;
    useAuthStore.getState().setSession(accessToken, user);
  } catch {
    useAuthStore.getState().setAnonymous();
  }
}

// ─── Tien ich doc loi ──────────────────────────────────────────────────────

/** Message tieng Viet tu backend; fallback khi mat mang / server chet. */
export function errorMessage(error: unknown, fallback = "Đã có lỗi xảy ra"): string {
  if (axios.isAxiosError<ApiError>(error)) {
    return error.response?.data?.error?.message ?? fallback;
  }
  return fallback;
}

/** Ma loi backend (INSUFFICIENT_STOCK, EMAIL_NOT_VERIFIED...) de xu ly rieng. */
export function errorCode(error: unknown): string | null {
  if (axios.isAxiosError<ApiError>(error)) {
    return error.response?.data?.error?.code ?? null;
  }
  return null;
}
