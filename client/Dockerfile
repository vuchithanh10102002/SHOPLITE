# Dockerfile production cho FE (Roadmap 7.1 buoc 2).
#
# Hai stage: build ra file tinh → nginx phuc vu. Stage cuoi KHONG co Node, khong
# co node_modules — chi 5MB HTML/JS/CSS nam tren nginx:alpine.
#
# ═══ LECH ROADMAP CO CHU Y: KHONG co `ARG VITE_API_URL` ═══
# Roadmap 7.1 buoc 2 (va bay 7.2 "Build args Vite") gia dinh FE goi API bang URL
# tuyet doi nen phai bake vao bundle luc build. Project nay chot khac tu Phase 5:
# axios dung `baseURL: "/api"` (src/api/client.ts) — duong dan TUONG DOI, cung
# origin. Prod thi nginx proxy /api sang service `api` (nginx.conf).
# → Khong co gi phai bake. Va duoc them mot cai loi: CUNG mot image chay duoc o
#   moi domain (localhost, staging, prod) vi trong bundle khong he co ten host.
#   Neu bake VITE_API_URL thi doi domain = build lai image.

# ─── Stage 1: build ─────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# `npm run build` = `tsc -b && vite build` → loi type LAM HONG BUILD ngay tai day,
# khong lot ra prod. Co y de nguyen vay, khong doi thanh `vite build` cho nhanh.
RUN npm run build

# ─── Stage 2: nginx ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Xoa config mac dinh: no cung `listen 80` va nap TRUOC (default.conf), khong xoa
# thi hai server block tranh nhau port va nginx phuc vu trang "Welcome to nginx".
RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/shoplite.conf
COPY --from=build /app/dist /usr/share/nginx/html

# KHONG doi sang `USER nginx`: image nginx:alpine chay master la root roi tu ha
# worker xuong user `nginx` (xem /etc/nginx/nginx.conf) — dat USER nginx o day
# lam master khong bind duoc port 80 (<1024 can quyen). Rui ro thap vi worker —
# tien trinh THAT SU doc request — da la user thuong.
EXPOSE 80

# wget co san trong busybox. Kiem trang chu, khong kiem /api (api chet thi FE van
# phai xanh — day la healthcheck cua FE).
#
# ═══ PHAI la 127.0.0.1, KHONG duoc dung `localhost` ═══
# Da do that: voi `localhost` container nay unhealthy vinh vien du nginx phuc vu
# binh thuong. Ly do: `listen 80` cua nginx bind IPv4 (0.0.0.0:80 — netstat xac
# nhan), con busybox wget phan giai `localhost` ra ::1 TRUOC → "can't connect to
# remote host: Connection refused". Container api khong dinh vi Node bind san
# dual-stack (::), nen bay nay CHI lo ra o nginx.
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
