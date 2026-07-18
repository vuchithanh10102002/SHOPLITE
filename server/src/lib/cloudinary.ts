// Import env TRUOC package cloudinary — THU TU NAY QUAN TRONG. Package cloudinary
// goi config() ngay luc require (utils/index.js:43) va NEM neu CLOUDINARY_URL sai
// dang. ESM chay import theo thu tu nguon, nen env.ts phai dung TREN dong import
// cloudinary: env.parse() se chet som voi thong bao ro (startsWith cloudinary://)
// TRUOC khi SDK kip nem stack kho hieu. Dao thu tu = mat cai bay do.
import "../config/env";
import { v2 as cloudinary } from "cloudinary";

// SDK tu doc CLOUDINARY_URL (dang cloudinary://key:secret@cloud-name) tu env.
// Chi can bat `secure` de secure_url tra ve https thay vi http.
cloudinary.config({ secure: true });

export { cloudinary };
