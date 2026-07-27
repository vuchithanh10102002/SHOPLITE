# ShopLite

Một dự án E-commerce Fullstack được xây dựng để học và thực hành kiến trúc Backend/Frontend hiện đại.

Hai tài liệu gốc của dự án nằm ngay ở thư mục này:

- `ShopLite-FullStack-Handbook.md` — thiết kế: làm **cái gì** và **vì sao**.
- `ShopLite-Roadmap.md` — 8 phase: làm theo **thứ tự nào**.

## Công nghệ sử dụng

### Backend

- Node.js 24 · Express 5 · TypeScript
- Prisma ORM · PostgreSQL · Redis
- BullMQ (hàng đợi email + job quét đơn treo) · Nodemailer
- Zod (validate cả request HTTP lẫn payload job) · Pino
- Cloudinary (ảnh sản phẩm) · Swagger UI (`/api/docs`)
- Vitest (237 test tích hợp, chạy trên DB + Redis thật)

### Frontend

- React 19 · Vite · TypeScript
- Tailwind CSS v4 (cấu hình bằng CSS, không có `tailwind.config.js`)
- TanStack Query v5 · Zustand · React Router v7
- react-hook-form + Zod · Recharts (dashboard) · oxlint

## Yêu cầu

- Node.js >= 24
- Docker Desktop
- npm

## Chạy ở môi trường dev

### 1. Clone project

```bash
git clone <repo-url>
cd shoplite
```

### 2. Khởi động hạ tầng (Postgres + Redis)

```bash
docker compose up -d
```

Ở dev chỉ **hạ tầng** nằm trong container, còn code chạy thẳng trên máy bằng `tsx` cho nhanh vòng lặp sửa–thử.

### 3. Cài package và chuẩn bị DB

```bash
cd server && npm install
npx prisma migrate deploy
npx prisma generate
npx prisma db seed          # 24 sản phẩm, 8 user (mật khẩu demo: Webpx@2024)

cd ../client && npm install
```

### 4. Chạy (3 tiến trình)

```bash
cd server && npm run dev        # API      → http://localhost:3000
cd server && npm run worker     # worker BullMQ (email + quét đơn treo)
cd client && npm run dev        # FE       → http://localhost:5173
```

FE gọi API qua proxy của Vite (`/api → localhost:3000`) nên cùng origin — cookie
refresh token httpOnly đi về bình thường, không dính CORS.

## Chạy bản production bằng Docker

Khác dev ở chỗ **mọi thứ** nằm trong container, và cửa duy nhất ra ngoài là nginx:

```
web (nginx) ─┬─ file tĩnh của FE
             └─ proxy /api và /health ──▶ api (Express, KHÔNG mở port ra host)
                                          worker (cùng image, khác lệnh chạy)
                                          postgres · redis (volume riêng -prod)
```

```bash
cp .env.prod.example .env        # rồi điền giá trị thật (chmod 600 nếu ở VPS)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm migrate   # prisma migrate deploy
```

Mở `http://localhost` (hoặc cổng đặt trong `HTTP_PORT`). Kiểm tra nhanh:

```bash
curl localhost/health/ready      # {"ok":true} — có ping thật Postgres + Redis
```

Trên VPS thì dùng `./deploy.sh` thay cho ba lệnh trên: nó bật hạ tầng trước, **chạy
migration rồi mới đổi code** (ngược lại thì code mới đọc schema cũ → 500 hàng loạt),
cuối cùng dọn image cũ.

Vài điểm đã chốt, ghi ở đây để khỏi "sửa lại cho giống mẫu":

- **`prisma` CLI không nằm trong image API.** Migration chạy bằng service `migrate`
  riêng (stage `migrator`). Nhét CLI vào image API làm nó phình 483MB và cho một
  container đang phục vụ HTTP mang theo công cụ đủ sức viết lại schema DB.
- **Client không có `VITE_API_URL`.** axios dùng đường dẫn tương đối `/api`, nginx
  proxy sang service `api`. Nhờ vậy **một** image chạy được ở mọi domain.
- **Worker phải `healthcheck: disable`** — nó dùng chung image với api mà image đó
  có sẵn HEALTHCHECK thăm dò cổng 3000; worker không mở cổng nào nên sẽ unhealthy
  vĩnh viễn dù chạy đúng.

## CI

`.github/workflows/ci.yml` chạy trên mọi pull request và mọi push vào `main`:

| Job | Làm gì |
| --- | --- |
| `server` | `prisma generate` → `migrate deploy` → `tsc --noEmit` → 237 test (có service Postgres + Redis) |
| `client` | oxlint → `tsc -b && vite build` |
| `publish` | chỉ khi cả hai xanh **và** là push vào `main`: build + push image lên ghcr.io (tag `latest` + SHA commit) |

Hai job đầu chạy song song vì `server/` và `client/` là hai project npm rời.

## Demo công khai bằng GitHub Codespaces

Bản demo **không chạy trên VPS**: Codespaces cấp sẵn một URL HTTPS thật nên không
cần tên miền, không cần certbot, và gói free 120 core-hours/tháng không đòi thẻ.

Trên GitHub: **Code → Codespaces → Create codespace on main**. Lần đầu mất ~5–10
phút (`.devcontainer/setup.sh` sinh `.env`, build 2 image, migrate, seed). Xong,
terminal in ra địa chỉ demo và ba tài khoản seed.

| Tài khoản | Vai trò |
| --- | --- |
| `admin@shoplite.dev` | ADMIN — vào được `/admin` |
| `cong@webpx.vn` | khách đã verify — đặt hàng được |
| `hanh.unverified@gmail.com` | khách **chưa** verify — thử BR4, đặt hàng ra 403 |

Mật khẩu do `SEED_PASSWORD` quyết định (mặc định `Demo@12345` trong Codespaces).

Ba chỗ dễ vấp, đã xử lý sẵn hoặc phải làm tay:

- **Cổng forward mặc định là Private** → người ngoài mở link chỉ thấy màn đăng nhập
  GitHub. `setup.sh` thử đổi bằng `gh codespace ports visibility`, không được thì in
  hướng dẫn đổi tay (tab **PORTS** → chuột phải cổng 8080 → **Port Visibility →
  Public**). Đặt trong `devcontainer.json` thì **không được** — `portsAttributes`
  chưa hỗ trợ `visibility` (community discussion #10394, kiểm lại 27/07/2026).
- **URL đổi theo từng codespace** → `CLIENT_URL` sinh động từ `$CODESPACE_NAME`,
  không hardcode. Đặt sai thì link trong email verify/reset bấm không được.
- **Codespace tự ngủ sau ~30 phút** → ngủ dậy `postStartCommand` bật lại stack.
  Vì vậy **không** dùng URL này làm đích giám sát uptime.

Email không gửi được (SMTP là placeholder) nên dùng tài khoản seed đã verify sẵn.
Muốn lấy link verify của tài khoản mới đăng ký thì đọc thẳng trong Redis:

```bash
docker exec shoplite-redis-prod redis-cli get bull:email:id
docker exec shoplite-redis-prod redis-cli hget bull:email:<id> data
```

## Backup và diễn tập khôi phục

```bash
./infra/backup.sh                 # pg_dump | gzip → ~/backups, xóa bản > 30 ngày
./infra/restore-test.sh           # diễn tập: khôi phục bản mới nhất rồi đối chiếu
```

Cron hằng đêm: `0 2 * * * /đường/dẫn/shoplite/infra/backup.sh >> /var/log/shoplite-backup.log 2>&1`

`backup.sh` ghi ra file `.partial` rồi mới đổi tên — bị giết giữa chừng thì không
để lại một bản cụt **mang tên thật**, thứ chỉ lộ ra đúng lúc cần khôi phục. Nó cũng
chỉ xóa bản cũ **sau khi** bản mới đã thành công.

`restore-test.sh` khôi phục vào một DB riêng trong container Postgres của **dev**
(không đụng DB đang phục vụ), rồi so cả số dòng lẫn vân tay MD5 nội dung với bản
gốc. Ba chi tiết khiến nó không phải diễn tập giả:

- `ON_ERROR_STOP=1` — mặc định `psql` gặp lỗi vẫn chạy tiếp và **thoát mã 0**, tức
  là một bản dump cắt ngang vẫn "khôi phục thành công".
- So sánh với bản gốc — restore không lỗi chưa chứng minh dữ liệu đúng.
- Đã thử ngược với một bản dump cố ý cắt cụt: script phải **đỏ**. Nó đỏ thật.

Kết quả lần chạy 27/07/2026: 6 bảng khớp số dòng (users 8 / products 24 /
categories 14 / orders 17 / order_items 27 / payments 16), tổng tiền đơn và vân
tay MD5 của `products` + `users` khớp tuyệt đối.

### Ba mục của Roadmap Phase 8 KHÔNG áp dụng được — và vì sao

Ghi ra đây thay vì lặng lẽ bỏ qua, vì "không có trong README" và "đã cân nhắc rồi
bỏ" nhìn từ ngoài giống hệt nhau:

| Mục | Vì sao N/A |
| --- | --- |
| SSL Labs grade A | HTTPS ở đây là chứng chỉ của `*.app.github.dev` — hạ tầng GitHub, không phải cấu hình của mình. Chấm điểm nó thì đang chấm điểm GitHub. |
| UptimeRobot xanh 24h | Codespace **tự ngủ sau ~30 phút** không ai dùng. Giám sát một địa chỉ được thiết kế để tắt thì cảnh báo đỏ là đúng chứ không phải sự cố. |
| Push `main` → site tự update | Không có máy nào chạy 24/7 để `ssh` vào. CI vẫn build và push image lên ghcr.io (Phase 7); bước kéo image về là thủ công `./deploy.sh --pull`. |

Nguyên nhân gốc: **không đăng ký được VPS/PaaS nào** — Oracle Cloud Always Free,
Railway, Fly.io đều bắt xác minh thẻ tín dụng. Ba mục trên làm được thật ngay khi
có một máy chạy liên tục; `infra/vps-setup.sh` (giữ trong repo, **chưa chạy thật
lần nào**) là bước đầu của đường đó.

## API

- Tài liệu Swagger: `GET /api/docs`
- Sức khỏe: `GET /health` (sống chưa) và `GET /health/ready` (ping thật Postgres + Redis)
- File `.http` để thử tay bằng REST Client: `server/requests/`

## Đo lường (Phase 7)

Tất cả số dưới đây đo trên **bản production thật** (`docker-compose.prod.yml`, truy
cập qua nginx), máy Windows 10 / Docker Desktop, không phải trên dev server.

### Kích thước image

| Image | Size | Ngưỡng DoD |
| --- | ---: | --- |
| `shoplite-api` (API + worker) | **239MB** | < 300MB ✅ |
| `shoplite-web` (nginx + file tĩnh) | **49.2MB** | < 100MB ✅ |
| `shoplite-migrator` | 683MB | không ship — chỉ chạy một lần lúc deploy rồi tự xóa (`run --rm`) |

Ba thứ kéo image API từ 483MB xuống 239MB, đo từng bước chứ không phỏng đoán:

1. `npm ci --omit=dev --omit=peer --omit=optional` ở stage `deps` (thiếu `--omit=optional`
   thì prisma CLI + effect + typescript vẫn lọt vào vì package-lock đánh dấu chúng
   `devOptional`) — `node_modules` 258MB → 82MB.
2. Xóa các biến thể engine Prisma dành cho edge/serverless (`*wasm-base64*`, `*.map`)
   — thư mục `runtime` 73MB → 4MB. Project chạy engine `library` trên Node.
3. Prisma CLI ra khỏi image (xem mục trên).

### Bundle frontend

Đo bằng `gzip -5` — đúng mức nén nginx đang dùng (`gzip_comp_level 5` trong `nginx.conf`).

| File | Raw | Gzip | Ai tải |
| --- | ---: | ---: | --- |
| `index-*.js` | 344.5KB | **103.3KB** | mọi người |
| `cn-*.js` (chunk dùng chung) | 123.4KB | 43.3KB | mọi người |
| `index-*.css` | 34.6KB | 7.2KB | mọi người |
| `DashboardPage-*.js` (recharts) | 380.9KB | 109.0KB | **chỉ khi vào `/admin`** |
| 5 trang admin còn lại | 1–8KB | 0.3–3.3KB | chỉ khi vào đúng trang đó |

DoD "main chunk < 300KB gzip" → **103.3KB**, và khu admin đã tách khỏi đường vào của
khách bằng `React.lazy` (`client/src/App.tsx`): trước khi tách, mọi khách mua hàng
đều phải tải cả recharts.

### p95 latency API

`autocannon -c 10 -d 20`, đi qua nginx (không đo thẳng port 3000 vì prod không mở
cổng đó), có warm-up 3 giây trước mỗi phép đo để cache Redis không làm lệch số:

| Endpoint | req/s | p50 | **p95** | p99 | non-2xx |
| --- | ---: | ---: | ---: | ---: | ---: |
| `GET /api/categories` (cache cây) | 797 | 12ms | **39ms** | 58ms | 0 |
| `GET /api/products` (cache list) | 647 | 15ms | **35ms** | 42ms | 0 |
| `GET /api/products/:slug` (cache detail) | 762 | 15ms | **36ms** | 41ms | 0 |
| `GET /api/orders` (có JWT, không cache) | 446 | 21ms | **34ms** | 37ms | 0 |
| `GET /health/ready` (ping thật DB + Redis) | 720 | 16ms | **32ms** | 36ms | 0 |

autocannon báo `errors` đúng bằng số connection (10) ở mỗi lần chạy, `timeouts` và
`resets` đều 0 — đó là lỗi socket lúc nó **đóng** kết nối cuối phép đo, không phải
request hỏng: tổng số response 2xx khớp đúng tổng số request.

### Lighthouse trang `/products`

| Chỉ số | Mobile (mặc định: 4G chậm + CPU ×4) | Desktop |
| --- | --- | --- |
| Performance | **84 / 84 / 87 / 87** → trung vị **85.5** | **97** |
| Accessibility | 100 | 100 |
| Best Practices | 96 | 96 |
| SEO | 100 | 100 |
| FCP · LCP · TBT · CLS | 2.7s · 3.4–4.0s · ≤10ms · 0 | 0.6s · 1.0s · 0ms · 0.066 |

Ba việc đã làm ở bước polish, kèm số đo:

- **Self-host font Be Vietnam Pro** (`client/src/styles/fonts.css` + `src/assets/fonts/`).
  Trước đó `index.html` nạp font bằng `<link>` sang `fonts.googleapis.com`: CSS đó
  **chặn render**, và trong nó mới có tên file `.woff2` ở `gstatic.com` — hai origin
  xếp hàng DNS+TLS trước chữ đầu tiên. Lighthouse ghi "render-blocking: est savings
  1.200ms"; bỏ đi thì mục đó còn 750ms và Performance mobile đi từ **81** (1 lần chạy)
  lên dải 84–89. Giữ nguyên `unicode-range` của Google nên trình duyệt vẫn chỉ tải
  đúng subset nó cần (trang tiếng Việt: `vietnamese` + `latin`).
- **Ảnh seed đổi từ `600x400` sang `400x400`** (`server/prisma/seed.ts`): thẻ sản phẩm
  là khung vuông `object-cover`, ảnh chữ nhật vừa tốn byte vừa bị cắt.
- **`robots.txt` thật + `meta description`**: trước đó `/robots.txt` rơi vào SPA
  fallback nên trả về `index.html`, bot đọc HTML như robots.txt → SEO 83. Nay 100.

Hai điều **cố ý không sửa**, ghi rõ để lần sau khỏi tưởng là bỏ sót:

- Lighthouse còn nhắc "Improve image delivery" (~188KiB). Ảnh demo lấy từ
  `picsum.photos` — host ngoài, chỉ trả JPEG, không có WebP/AVIF và không nhận
  tham số chất lượng. Ảnh **thật** của sản phẩm đi qua Cloudinary với `f_auto/q_auto`
  (xem `cloudinaryThumb`), đúng thứ mục audit này đòi. Đo lại khi DB có ảnh thật.
- Best Practices 96 vì console có một lỗi mạng: `GET /api/auth/refresh` trả 401 cho
  khách chưa đăng nhập. Đó là thiết kế từ Phase 5 (khôi phục phiên lúc mở app; token
  nằm trong cookie httpOnly nên client không có cách nào biết trước là có phiên hay
  không). Muốn hết thì phải thêm một cookie "có phiên" đọc được — đổi thiết kế auth,
  không thuộc Phase 7.

Còn một thí nghiệm **đã thử và đã bỏ** vì đo ra tệ hơn (bỏ `loading="lazy"` + thêm
`fetchpriority="high"` cho 4 thẻ đầu, theo đúng gợi ý của Lighthouse): số đo và lý do
ghi trong `client/src/features/catalog/components/ProductCard.tsx`.

### Chạy lại các phép đo

```bash
# image
docker images | grep shoplite

# bundle (số gzip đúng như nginx trả)
cd client && npm run build
for f in dist/assets/index-*.js dist/assets/cn-*.js; do echo "$f $(gzip -5 -c $f | wc -c)"; done

# latency
npx autocannon -c 10 -d 20 -P 50,95,99 http://localhost:8080/api/products

# lighthouse (CHROME_PATH trỏ tới Chrome đã cài)
npx lighthouse http://localhost:8080/products \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless=new" --output=html --output-path=./lh.html
```

Font tải lại (khi đổi weight/subset): lấy CSS ở
`https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap`
bằng User-Agent của Chrome (để Google trả woff2), tải các file trong `src:` về
`client/src/assets/fonts/`, rồi chép nguyên `unicode-range` sang
`client/src/styles/fonts.css` với `url()` trỏ vào file trong repo.

## Database

```bash
npx prisma migrate deploy    # áp migration đã có (dùng ở CI và trên prod)
npx prisma migrate dev       # tạo migration mới lúc dev
npx prisma generate
npx prisma db seed
```

## Cấu trúc project

```
shoplite
├── client                     # React + Vite (Dockerfile → nginx)
├── server                     # Express + Prisma (Dockerfile → api + worker + migrator)
├── .github/workflows/ci.yml
├── docker-compose.yml         # dev: chỉ Postgres + Redis
├── docker-compose.prod.yml    # prod: web · api · worker · postgres · redis · migrate
├── deploy.sh
├── .env.prod.example
└── README.md
```
