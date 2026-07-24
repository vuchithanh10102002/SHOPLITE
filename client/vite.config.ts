import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    // "@/features/..." thay vi "../../../features/..." — import khong doi khi di chuyen file.
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },

  server: {
    port: 5173, // khop CLIENT_URL trong server/.env (CORS origin)

    // Proxy /api sang backend. CHOT MOT CACH (Roadmap 5.2 canh bao lan giua proxy va
    // baseURL): axios dat `baseURL: "/api"`, code goi api.get("/products") →
    // "/api/products" → Vite proxy nguyen path sang http://localhost:3000/api/products.
    // Proxy KHONG rewrite path. Nho vay request cung-origin (localhost:5173) nen
    // cookie httpOnly refreshToken di ve binh thuong, khong dinh CORS/SameSite.
    proxy: { "/api": "http://localhost:3000" },
  },
});
