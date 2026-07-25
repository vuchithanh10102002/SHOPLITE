import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

/**
 * Modal tu viet (~60 dong) thay vi keo them thu vien: man admin chi can HAI cong
 * dung — hoi xac nhan truoc hanh dong kho lui, va khung form nho.
 *
 * KHONG dung window.confirm(): no CHAN toan bo tab (giong alert) va khong style
 * duoc; tren automation/browser tool no con lam treo phien. Da co ghi chu ve bay
 * dialog nay tu Phase 5.
 *
 * createPortal ra thang document.body: modal nam trong mot <td> se an duoi
 * `overflow` cua bang cha, va z-index cua no bi ke thua stacking context cua
 * dong bang — hai loi rat kho doan.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Escape de dong: nguoi dung mo nham mot hop xac nhan xoa phai thoat duoc ma
  // khong phai nham trung nut nao.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Khoa cuon nen: cuon trang phia sau trong khi modal mo la mat phuong huong.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Lop phu: bam ra ngoai de dong. aria-hidden vi no chi la nen. */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Hop xac nhan cho hanh dong KHO LUI (xoa san pham, huy don, hoan thanh don).
 *
 * `danger` doi mau nut chinh: xoa va khoi phuc dung chung mot component nhung
 * khong duoc nhin giong nhau — nut do la mot tin hieu dung tay lai.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="text-sm text-gray-600">{message}</div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Hủy
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
