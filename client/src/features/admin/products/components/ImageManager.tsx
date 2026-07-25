import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { errorMessage } from "@/api/client";
import { toast } from "@/lib/toast";
import { cloudinaryThumb } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useDeleteImage, useUploadImage } from "../hooks";
import type { ProductImage } from "@/api/types";

/** Khop `limits.fileSize` cua multer (server/src/middlewares/upload.ts). */
const MAX_SIZE_MB = 5;
const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Quan ly anh san pham — chi hien o che do SUA (Roadmap 6.1 buoc 2: upload la
 * hai buoc, phai co product id truoc roi moi dinh anh vao).
 *
 * Ba diem ky thuat dang nho:
 *
 * 1. `URL.createObjectURL` PHAI di kem `revokeObjectURL`. Moi lan goi la trinh
 *    duyet giu nguyen file trong bo nho cho toi khi tab dong. Admin chon thu 20
 *    tam anh 5MB = 100MB ro ri, khong co canh bao nao. Cleanup nam trong
 *    useEffect nen chay ca khi doi file LAN khi roi trang.
 *
 * 2. `input[type=file]` GIU file cu sau khi upload xong (Roadmap 6.2). Chon lai
 *    dung file do se KHONG ban su kien change → nut nhu chet. Phai
 *    `ref.current.value = ""`.
 *
 * 3. Loc dinh dang/kich thuoc o day chi la phep lich su voi nguoi dung. Chot that
 *    la magic bytes o backend (shared/image-magic.ts) — doi duoi .exe thanh .png
 *    van bi chan 400 truoc khi cham Cloudinary.
 */
export function ImageManager({ productId, images }: { productId: string; images: ProductImage[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductImage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadImage(productId);
  const remove = useDeleteImage(productId);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(next: File | null) {
    if (!next) return setFile(null);

    if (next.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Ảnh tối đa ${MAX_SIZE_MB}MB`);
      resetInput();
      return;
    }

    setFile(next);
  }

  function resetInput() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function submit() {
    if (!file) return;

    upload.mutate(file, {
      onSuccess: () => {
        resetInput();
        toast.success("Đã tải ảnh lên");
      },
      onError: (error) => toast.error(errorMessage(error, "Tải ảnh thất bại")),
    });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="font-medium">Ảnh sản phẩm</h2>
      <p className="mt-1 text-sm text-gray-500">
        JPEG, PNG hoặc WebP, tối đa {MAX_SIZE_MB}MB. Ảnh đầu tiên được dùng làm ảnh đại diện.
      </p>

      {images.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} className="group relative">
              <img
                src={cloudinaryThumb(img.url, 300) ?? img.url}
                alt=""
                className="aspect-square w-full rounded-lg border border-gray-200 object-cover"
              />
              <button
                type="button"
                onClick={() => setPendingDelete(img)}
                aria-label="Xóa ảnh"
                className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-red-600 shadow-sm hover:bg-white"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">
          <ImagePlus className="size-4" aria-hidden />
          Chọn ảnh
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>

        {preview && (
          <>
            <img
              src={preview}
              alt="Xem trước ảnh sắp tải lên"
              className="size-12 rounded-lg border border-gray-200 object-cover"
            />
            <span className="max-w-[12rem] truncate text-sm text-gray-600">{file?.name}</span>

            <Button size="sm" onClick={submit} loading={upload.isPending}>
              <Upload className="size-4" aria-hidden />
              Tải lên
            </Button>

            <Button variant="ghost" size="sm" onClick={resetInput} disabled={upload.isPending}>
              Bỏ chọn
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        danger
        title="Xóa ảnh?"
        confirmLabel="Xóa"
        loading={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id, {
            onSuccess: () => {
              setPendingDelete(null);
              toast.success("Đã xóa ảnh");
            },
            onError: (error) => toast.error(errorMessage(error, "Không xóa được ảnh")),
          });
        }}
        message="Ảnh sẽ bị xóa khỏi Cloudinary và không khôi phục được."
      />
    </section>
  );
}
