import { create } from "zustand";

/**
 * Toast toi gian tu viet (~40 dong) thay vi keo them mot thu vien: du an chi can
 * hien mot dong chu roi tu tat. Store nam ngoai React nen goi duoc tu queryClient
 * (QueryCache.onError) lan tu component.
 */
export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const AUTO_DISMISS_MS = 4000;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (kind, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));

    // Tu tat. setTimeout khong can clear: neu user bam X truoc thi dismiss(id)
    // loc theo id, timer chay sau chi loc mot id khong con ton tai — vo hai.
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Goi duoc tu bat ky dau, ke ca ngoai React. */
export const toast = {
  success: (message: string) => useToastStore.getState().push("success", message),
  error: (message: string) => useToastStore.getState().push("error", message),
  info: (message: string) => useToastStore.getState().push("info", message),
};
