import { create } from "zustand";
import type { User } from "@/api/types";

/**
 * CLIENT STATE duy nhat cua du an (Handbook 7.1) — products/cart/orders la SERVER
 * STATE do TanStack Query giu, khong copy vao day.
 *
 * Access token nam trong memory chu khong localStorage: XSS doc localStorage bang
 * mot dong, con bien trong module closure thi khong co API nao doc ra duoc. Danh
 * doi: F5 mat token → goi /auth/refresh mot lan luc khoi dong (cookie httpOnly con).
 *
 * `status` phai co BA gia tri, khong phai hai: thieu "loading" (dang goi /refresh
 * luc boot, CHUA biet co phien khong) thi RequireAuth da user ra /login ngay khi F5.
 */
export type AuthStatus = "loading" | "authed" | "anon";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: AuthStatus;

  setSession: (accessToken: string, user: User) => void;
  /** Chi doi token (interceptor refresh giua chung), giu nguyen user. */
  setAccessToken: (accessToken: string) => void;
  /** Xoa phien phia client. KHONG goi API — nguoi goi tu quyet dinh co goi /logout. */
  clearSession: () => void;
  /** Boot xong ma khong co phien nao. */
  setAnonymous: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "loading",

  setSession: (accessToken, user) => set({ accessToken, user, status: "authed" }),

  setAccessToken: (accessToken) => set({ accessToken, status: "authed" }),

  clearSession: () => set({ accessToken: null, user: null, status: "anon" }),

  setAnonymous: () => set({ accessToken: null, user: null, status: "anon" }),
}));

/** Doc token NGOAI React (axios interceptor): getState() khong subscribe. */
export const getAccessToken = () => useAuthStore.getState().accessToken;

export const isAdmin = (user: User | null) => user?.role === "ADMIN";
