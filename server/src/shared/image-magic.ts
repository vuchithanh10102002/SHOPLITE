import { Errors } from "./errors";

/**
 * Mimetype do CLIENT tu khai, doi duoc — `.exe` doi ten `.png` van khai
 * image/png. Lop chan THAT la magic bytes: vai byte dau file cho biet dinh dang
 * that, khong the gia ma van con la file mo duoc.
 *
 * Chi nhan 3 dinh dang whitelist (jpeg/png/webp) — khop fileFilter cua multer.
 * Doc 12 byte dau la du cho ca ba.
 */
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function sniff(buf: Buffer): ImageMime | null {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf.length >= 8 && PNG_SIGNATURE.every((b, i) => buf[i] === b)) {
    return "image/png";
  }

  // WebP: "RIFF" (byte 0-3) .... size 4 byte .... "WEBP" (byte 8-11)
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Nem 400 neu buffer khong phai anh whitelist THAT. Goi TRUOC khi cham
 * Cloudinary — khong bao gio de mot file gia loang toang doc len storage
 * (Handbook 5.7: chan upload shell).
 */
export function assertRealImage(buf: Buffer): void {
  if (sniff(buf) === null) {
    throw Errors.badRequest(
      "File không phải ảnh hợp lệ (chỉ nhận JPEG, PNG, WebP)",
      "INVALID_IMAGE",
    );
  }
}
