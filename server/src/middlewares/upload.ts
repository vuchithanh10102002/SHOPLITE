import multer from "multer";
import { AppError } from "../shared/errors";

// 5MB — Roadmap 292 / Handbook 5.7.
const MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Memory storage: buffer nam trong RAM, KHONG cham disk cua API (Handbook 5.7 —
 * chong upload shell + DoS disk), di thang len Cloudinary roi bi vut.
 *
 * fileFilter chan theo mimetype CLIENT TU KHAI nen chi la lop chan re va som; lop
 * chan THAT la assertRealImage (magic bytes) o service.
 *
 * Vuot fileSize → multer nem MulterError LIMIT_FILE_SIZE, errorHandler dich sang
 * 400 (khong co nhanh do thi rot 500).
 */
export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new AppError(400, "INVALID_IMAGE_TYPE", "Chỉ nhận ảnh JPEG, PNG, WebP"));
  },
  
}).single("image");
