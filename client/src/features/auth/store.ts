import { create } from "zustand";
import type { User } from "@/api/types";

/**
 * Store auth — CLIENT STATE duy nhat cua du an (Handbook 7.1). Moi thu khac
 * (products, cart, orders) la SERVER STATE va do TanStack Query giu, khong copy
 * vao day.
 *
 * VI SAO access token nam trong memory chu khong localStorage: XSS doc duoc
 * localStorage bang mot dong `localStorage.getItem`. Bien trong module closure thi
 * khong co API nao doc ra duoc tu ngoai. Danh doi: F5 la mat token → App goi
 * /auth/refresh dung mot lan luc khoi dong de lay lai (cookie httpOnly con do).
 *
 * `status` phan biet BA trang thai, khong phai hai:
 *   "loading"  — dang goi /refresh luc boot, CHUA biet co phien hay khong
 *   "authed"   — co token
 *   "anon"     — chac chan chua dang nhap
 * Thieu "loading" thi RequireAuth se da user ra /login ngay khi F5 — bug kinh dien
 * cua kieu luu token trong memory.
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

/**
 * Doc token NGOAI React (axios interceptor). getState() lay gia tri hien tai,
 * khong subscribe — dung o day moi dung, hook chi dung trong component.
 */
export const getAccessToken = () => useAuthStore.getState().accessToken;

export const isAdmin = (user: User | null) => user?.role === "ADMIN";
