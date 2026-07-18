import { v2 as cloudinary } from "cloudinary";

// Import env TRUOC: env.ts nap dotenv + validate, dam bao CLOUDINARY_URL da co
// trong process.env truoc khi SDK doc no. env.ts throw neu thieu → chet som.
import "../config/env";

// SDK tu doc CLOUDINARY_URL (dang cloudinary://key:secret@cloud-name) tu env.
// Chi can bat `secure` de secure_url tra ve https thay vi http.
cloudinary.config({ secure: true });

export { cloudinary };