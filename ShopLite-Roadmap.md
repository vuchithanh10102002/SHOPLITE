# LỘ TRÌNH THỰC HIỆN DỰ ÁN SHOPLITE — CHI TIẾT TỪNG PHASE

> Tài liệu đồng hành với **ShopLite-FullStack-Handbook.md** (bản thiết kế) và **ShopLite-UI-Prototype.jsx** (đặc tả giao diện). Handbook trả lời "làm cái gì và vì sao"; tài liệu này trả lời "làm theo thứ tự nào, mất bao lâu, biết khi nào xong".

---

## GIẢ ĐỊNH & CÁCH ĐỌC ƯỚC TÍNH THỜI GIAN

Trước khi vào lộ trình, phải nói thẳng về ước tính giờ để anh biết cách dùng:

Ước tính bên dưới tính cho **developer đã biết một ngôn ngữ backend (PHP/Python/Java), thành thạo JS cơ bản, nhưng chưa từng làm production với Node.js + React stack cụ thể của dự án**. Đây có thể là profile của anh em WebPX chuyển từ PHP/CakePHP hoặc Flutter sang. Ngày làm việc tính 6 giờ tập trung thật (không phải 8 giờ có mặt). Cụ thể:

- **Senior đã từng làm Node/React ≥ 2 dự án production**: chia đôi ước tính.
- **Junior chỉ mới ra trường / chưa quen JS async, closure, promise**: nhân 1.5–2 và **buộc phải có mentor review 2–3 lần/tuần**, không thì sẽ đi sai hướng mà không biết.
- **Chính anh Công tự làm để đánh giá stack**: có thể nhanh hơn 30% ở phần logic backend (kinh nghiệm code), nhưng phần React + TanStack Query nếu chưa quen sẽ đúng như ước tính.

**Tổng ước tính**: 22–28 ngày làm việc (~130–170 giờ tập trung) cho phiên bản hoàn chỉnh có deploy. Nếu chỉ cần **phiên bản học tập chạy local, không deploy**, cắt bớt Phase 7–8 → còn 18–22 ngày.

Đây không phải phần mềm khách hàng — không cần vội. **Đi chậm ở Phase 1–4 tiết kiệm gấp 3 thời gian ở Phase 5–8**.

---

## PHASE 0 — CHUẨN BỊ (0.5–1 ngày, làm trước khi gõ dòng code nào)

Phase mà 90% người học bỏ qua rồi trả giá. Không có code, chỉ có đọc và cài.

### 0.1. Kiến thức nền tảng phải có trước

Nếu chưa nắm chắc mấy thứ này, học trước — code trước rồi học ngược sẽ chậm hơn:

- **JS async/await + Promise**: hiểu event loop cơ bản, biết `Promise.all` vs `Promise.allSettled` khác nhau, hiểu `.then()` chain vs async/await. Node là async everywhere.
- **TypeScript cơ bản**: type, interface, generic (biết dùng `<T>` là đủ, không cần mastery), utility types (`Pick`, `Omit`, `Partial`). Không cần đọc hết docs — đọc TypeScript Handbook chapter "Everyday Types" và "Object Types" là đủ để bắt đầu.
- **SQL căn bản**: JOIN, GROUP BY, transaction là gì. Nếu quen MySQL rồi thì PostgreSQL 95% giống — chỉ khác vài syntax nhỏ (`SERIAL` → `GENERATED`, dấu `"` cho identifier, kiểu `JSONB`).
- **React function component + hook**: `useState`, `useEffect`, `useMemo`, component composition. Không cần biết Redux — dự án này dùng TanStack Query + Zustand đơn giản hơn nhiều.

**Thẳng thắn**: nếu người thực hiện chưa quen 3/4 điều trên, dành riêng 2–3 ngày học nền trước. Vừa code vừa học 4 thứ mới cùng lúc là công thức bỏ dở dự án.

### 0.2. Cài môi trường

- Node.js 20 LTS (dùng `nvm` để chuyển version — không cài trực tiếp).
- Docker Desktop (Windows/Mac) hoặc Docker + Compose plugin (Linux/WSL2).
- PostgreSQL client CLI (`psql`) — cần để debug bằng tay.
- DBeaver hoặc TablePlus (GUI xem DB) — free tier là đủ.
- VSCode + extensions: ESLint, Prettier, Prisma, Tailwind CSS IntelliSense, Error Lens.
- Postman hoặc Bruno (Bruno free, git-friendly hơn) — test API bằng tay.
- Tài khoản Cloudinary (free tier), Mailtrap (free tier).

### 0.3. Đọc & hiểu

- Đọc **Handbook mục 0–4** (phân tích tài liệu tham khảo, giới thiệu, nghiệp vụ, database, kiến trúc). Đọc kỹ, không lướt.
- Mở **prototype UI** trong ChatGPT/Claude artifact hoặc chạy local, **bấm thử mọi flow** với 3 vai trò (Khách / Người mua / Quản trị). Ghi lại 3–5 câu hỏi phát sinh, tự trả lời được bằng handbook thì thôi, không trả lời được thì hỏi.
- Vẽ lại ERD trên giấy hoặc dbdiagram.io — vẽ **bằng tay**, không copy. Vẽ tay lộ ra chỗ chưa hiểu mà đọc không lộ.

**Deliverable Phase 0**: repo git đã init với `.gitignore` chuẩn (Node + macOS/Windows), `README.md` có 2 dòng mô tả dự án, môi trường dev chạy được `node -v` `docker --version` `psql --version` đều OK.

---

## PHASE 1 — NỀN MÓNG BACKEND (2–3 ngày, ~12–18 giờ)

**Mục tiêu duy nhất**: có bộ khung mà mọi module sau chỉ việc cắm vào. Kết thúc phase này chưa có tính năng nghiệp vụ nào — đừng nôn nóng.

### 1.1. Thứ tự thực hiện

**Bước 1 — Monorepo & Docker (2–3 giờ)**

- Tạo cấu trúc `shoplite/{server,client}` theo mục 5 handbook.
- `docker-compose.yml` chỉ 2 service dev: postgres:16-alpine + redis:7-alpine, có healthcheck, volume `pgdata`. **Không** dockerize code lúc dev.
- Test: `docker compose up -d` → `docker compose ps` thấy healthy → `psql -h localhost -U postgres` connect được.

**Bước 2 — Server: Express + TypeScript skeleton (3–4 giờ)**

```
server/
├── src/
│   ├── index.ts        # entry API
│   ├── app.ts          # lắp ráp Express, export app (test được)
│   ├── config/env.ts   # zod validate env
│   ├── lib/            # prisma.ts, redis.ts, logger.ts
│   ├── middlewares/    # requestId.ts, errorHandler.ts, notFound.ts, validate.ts
│   └── shared/         # errors.ts, response.ts
├── tsconfig.json, package.json, .env.example
```

`tsconfig.json` khuyến nghị: `"target": "ES2022"`, `"module": "commonjs"`, `"strict": true`, `"esModuleInterop": true`, `"outDir": "dist"`, `"paths": { "@/*": ["src/*"] }` (dùng `tsc-alias` khi build) — hoặc dùng `tsx` cho dev để bỏ qua path resolver phức tạp.

Package cần: `express cors helmet pino pino-http zod` (production), `typescript tsx @types/node @types/express` (dev). `tsx` chạy TS trực tiếp cho dev — không cần build lúc dev.

Script `package.json`:
```json
{
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.ts"
}
```

**Bước 3 — Middlewares & error handler (3 giờ)**

Copy đúng như handbook mục 6.0. Sau bước này, phải test được:
- `GET /health` → 200 `{ ok: true }`.
- `GET /không-tồn-tại` → 404 format `{ success: false, error: { code: 'NOT_FOUND', ... } }`.
- Test middleware validate bằng route giả `POST /debug/echo` yêu cầu body có `name: string` — gửi thiếu → 400 kèm `details`.
- Header `X-Request-Id` echo lại trong response và xuất hiện trong log của pino-http.

**Bước 4 — Prisma init + migration đầu (2–3 giờ)**

```bash
npx prisma init --datasource-provider postgresql
# Chép schema.prisma từ handbook (Product, User, đủ 12 model)
npx prisma migrate dev --name init
npx prisma generate
```

Viết `prisma/seed.ts` theo handbook mục 3.6, chạy `npx prisma db seed`. Kết quả: `psql` `SELECT COUNT(*) FROM products` = 30.

**Bước 5 — Graceful shutdown + health/ready (2 giờ)**

`GET /health/ready` phải thật sự ping DB (`prisma.$queryRaw`SELECT 1``) và Redis (`redis.ping()`). Test: `docker compose stop postgres` → `curl /health/ready` trả 503. Đây là bài test có giá trị nhất của phase này — không có nó thì health check chỉ là trang trí.

### 1.2. Bẫy phổ biến

- **`ts-node` vs `tsx`**: dùng `tsx` cho dev thay vì `ts-node`, đỡ vật lộn config ESM/CommonJS.
- **Sinh Prisma Client chỗ nào**: `lib/prisma.ts` phải là singleton (`globalThis.prisma ??= new PrismaClient()`) — mỗi hot-reload không tạo mới connection.
- **Log password/token**: pino-http mặc định log toàn bộ body. Cấu hình `redact: ['req.body.password', 'req.body.token', 'req.headers.authorization']` **NGAY LÚC NÀY**, không để lỡ.
- **Import path**: chốt sớm alias `@/` hay relative — đổi ở phase sau tốn công.

### 1.3. Definition of Done Phase 1

Chạy `npm run dev` → server up ở port 3000, các test tay sau đây pass:

```bash
curl localhost:3000/health                                 # 200
curl localhost:3000/health/ready                           # 200
curl localhost:3000/không-tồn-tại                          # 404 format chuẩn
curl -X POST localhost:3000/debug/echo -H 'content-type: application/json' -d '{}'  # 400 details

# DB
psql -c "SELECT COUNT(*) FROM products;"                   # 30
psql -c "SELECT COUNT(*) FROM users;"                      # 4 (1 admin, 3 customer)

# Graceful shutdown
kill -SIGTERM <pid>                                        # log "shutting down", exit 0 sau <10s
```

**Deliverable**: repo push lên GitHub (private cũng được), README có mục "How to run" ≤ 4 lệnh chạy được từ máy sạch.

---

## PHASE 2 — AUTH ĐẦY ĐỦ + EMAIL QUEUE (3–4 ngày, ~18–24 giờ)

Phase khó thứ nhì dự án. Ước tính rộng vì auth đúng nghĩa production có nhiều chỗ ẩn.

### 2.1. Thứ tự thực hiện

**Bước 1 — Redis + BullMQ + Mailer (2–3 giờ)**

- `lib/redis.ts` singleton, kết nối `REDIS_URL`.
- `lib/queue.ts` tạo `emailQueue = new Queue('email', { connection: redisConnection })`.
- `lib/mailer.ts` Nodemailer transport từ `SMTP_URL` (Mailtrap dev).
- Tạo file `worker.ts` riêng ở entry — làm skeleton chưa xử lý gì. Chạy song song với API: 2 terminal.

**Bước 2 — Module Auth: schemas + service layer (4–5 giờ)**

Thứ tự trong module (làm dưới lên): `auth.schemas.ts` (zod cho register/login/…) → `token.service.ts` (sinh access/refresh token, verify) → `auth.service.ts` (register, login, refresh, logout, forgot, reset, change) → `auth.controller.ts` → `auth.routes.ts`.

Viết theo thứ tự này (schema → service → controller) chứ không phải ngược lại — kỷ luật giữ business logic sạch khỏi HTTP.

**Bước 3 — Refresh token rotation (2–3 giờ)**

Đây là phần "đáng tiền" nhất của phase. Code cụ thể (rút gọn):

```ts
async function rotateRefreshToken(oldTokenPlain: string) {
  const hash = sha256(oldTokenPlain);
  const found = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!found) throw Errors.unauthorized();

  if (found.revoked) {
    // REUSE DETECTED: kẻ gian đang giữ token đã hết dùng
    await prisma.refreshToken.updateMany({
      where: { familyId: found.familyId },
      data: { revoked: true },
    });
    logger.warn({ userId: found.userId, familyId: found.familyId }, 'refresh reuse detected');
    throw Errors.unauthorized();
  }
  if (found.expiresAt < new Date()) throw Errors.unauthorized();

  // Rotate: revoke cũ, tạo mới cùng family
  const [newPlain, newHash] = generateToken();
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: found.id }, data: { revoked: true } }),
    prisma.refreshToken.create({
      data: { userId: found.userId, familyId: found.familyId, tokenHash: newHash,
              expiresAt: addDays(new Date(), 7) },
    }),
  ]);
  return newPlain;
}
```

**Bước 4 — Worker xử lý job email (3 giờ)**

Worker consume queue `email` với 3 job types: `verify-email`, `reset-password`, `order-status`. Template HTML đơn giản bằng template string trước, không dùng handlebars vội. Config queue:

```ts
new Worker('email', async (job) => {
  const { to, subject, html } = buildEmail(job.name, job.data);
  await mailer.sendMail({ from: 'ShopLite <no-reply@shoplite.dev>', to, subject, html });
}, { connection, concurrency: 5 });
```

**Bước 5 — Rate limit auth routes (1–2 giờ)**

Middleware Redis `INCR`/`EXPIRE`, chi tiết handbook mục 10. Auth routes: 5–10/phút/IP. Trả 429 kèm `Retry-After`.

**Bước 6 — Integration test auth (3–4 giờ)**

Test bắt buộc pass, không có coverage này thì phase không xong:

```ts
describe('Auth', () => {
  it('register → verify → login trả access + set cookie', async () => { ... });
  it('login sai password → 401', async () => { ... });
  it('refresh trả token mới, token cũ chết', async () => { ... });
  it('refresh reuse detection → revoke cả family', async () => {
    const { refreshCookie } = await login();
    await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie).expect(200);
    // dùng lại token cũ
    const r = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(r.status).toBe(401);
    // token mới sinh ra từ lần refresh đầu cũng đã chết
    const r2 = await request(app).post('/api/auth/refresh').set('Cookie', newRefreshCookie);
    expect(r2.status).toBe(401);
  });
  it('reset password token dùng 2 lần → lần 2 fail', async () => { ... });
});
```

### 2.2. Bẫy phổ biến

- **Cookie SameSite ở dev**: nếu FE chạy port khác (5173) BE chạy 3000, cookie SameSite=Lax vẫn OK cho POST cùng eTLD+1, nhưng cross-origin thì trình duyệt block. Cách xử lý: dev cấu hình Vite proxy `/api` sang backend (không cross-origin) — vừa giải quyết CORS vừa giải quyết cookie. Handbook có nhắc nhưng người mới hay bỏ.
- **JWT secret 32+ bytes**: `openssl rand -base64 48` sinh secret, đưa vào `.env`. Đừng dùng "secret123".
- **Bcrypt cost quá cao ở test**: cost 12 làm test chạy chậm. Đặt cost = 4 khi `NODE_ENV=test` — mất vài ngàn dòng test 30 giây, đặt lại cost 12 khi push.
- **Nodemailer + Mailtrap**: dùng Mailtrap **Email Testing** (fake SMTP inbox), không phải Mailtrap Sending (production). Config nhầm 2 loại rất mất thời gian.

### 2.3. Definition of Done Phase 2

- 8 endpoint auth (register, verify-email, login, refresh, logout, forgot-password, reset-password, change-password) chạy được qua Postman.
- Full flow test: register bằng Postman → check Mailtrap thấy email → click link giả (copy token) → verify → login → refresh 2 lần → refresh lần 3 với token đầu → 401 và cả family bị revoke (query DB kiểm).
- 5 integration test ở bước 6 pass.
- Rate limit hoạt động: gọi `/auth/login` 15 lần → lần thứ 11+ trả 429.

---

## PHASE 3 — CATALOG + UPLOAD + CACHE (3 ngày, ~15–20 giờ)

Phase "dễ thở" — chủ yếu CRUD nhưng có 2 điểm học sâu: cache invalidation và upload.

### 3.1. Thứ tự thực hiện

**Bước 1 — Categories (2 giờ)**

CRUD phẳng, giới hạn 2 cấp bằng code (`if (parentId && parent.parentId) throw`). Slug tự sinh. Cache: query `GET /categories` cả cây cache TTL 5 phút, invalidate mỗi write.

**Bước 2 — Products CRUD + list có filter/sort/pagination (5–6 giờ)**

Endpoint `GET /api/products?q=&categoryId=&minPrice=&maxPrice=&sort=&page=&limit=`. Điểm cần chú ý:

- Query build động — dùng object Prisma `where`, đừng nối chuỗi:
```ts
const where: Prisma.ProductWhereInput = {
  deletedAt: null,
  ...(categoryId && { categoryId }),
  ...(q && { name: { contains: q, mode: 'insensitive' } }),
  ...((minPrice || maxPrice) && {
    price: { ...(minPrice && { gte: minPrice }), ...(maxPrice && { lte: maxPrice }) },
  }),
};
```
- Total + data trong `Promise.all([prisma.product.count(...), prisma.product.findMany(...)])` — 2 query song song.
- Response `{ data: [...], meta: { page, limit, total, totalPages } }`.
- `limit` clamp max 50 — validate ở zod.
- Trả field `stockStatus` tính từ `stock`, **không** trả `stock` cho public API.

**Bước 3 — Cache với version key (2–3 giờ)**

Đúng như handbook mục 8.2. Test: gọi list 2 lần → lần 2 log `cache_hit: true`; sửa 1 sản phẩm → version tăng → gọi list lần 3 → cache miss.

**Bước 4 — Upload ảnh sản phẩm (3–4 giờ)**

- Multer memory storage, `limits: { fileSize: 5 * 1024 * 1024 }`, `fileFilter` whitelist mimetype.
- Check magic bytes: đọc 12 byte đầu buffer, so với header JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP. Package `file-type` làm sẵn.
- Upload lên Cloudinary bằng SDK stream:
```ts
const result = await new Promise<UploadApiResponse>((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'shoplite/products', resource_type: 'image' },
    (err, res) => err ? reject(err) : resolve(res!),
  );
  Readable.from(file.buffer).pipe(stream);
});
await prisma.productImage.create({
  data: { productId, url: result.secure_url, publicId: result.public_id, sortOrder },
});
```
- Xóa ảnh: `cloudinary.uploader.destroy(publicId)` **trước** khi xóa row DB.

**Bước 5 — Admin CRUD (2–3 giờ)**

POST/PATCH/DELETE cho product và category, middleware `requireRole('ADMIN')`. Soft delete: `deletedAt = new Date()`. Nhớ invalidate cache sau mỗi write.

**Bước 6 — Swagger docs (2 giờ)**

Dùng `zod-to-openapi` sinh spec từ chính zod schemas — docs không lệch code. Serve tại `/api/docs`. Cần cho phase sau (frontend dev tra API), nên làm luôn phase này.

### 3.2. Bẫy phổ biến

- **Search `contains` với tiếng Việt có dấu**: `mode: 'insensitive'` xử lý hoa/thường, nhưng không xử lý bỏ dấu. Tìm "ao" không ra "áo". Giải pháp cấp tốc: lưu thêm cột `name_normalized` (bỏ dấu, lowercase) và search trên cột đó. Giải pháp xịn hơn: PostgreSQL `unaccent` extension. Với dự án học tập, dùng `name_normalized` — đơn giản, hiểu được.
- **Cloudinary rò rỉ ảnh cũ**: cập nhật product nhưng quên xóa ảnh cũ → Cloudinary storage đầy dần. Kỷ luật: mọi ảnh xóa khỏi DB phải xóa cả Cloudinary.
- **Prisma Decimal**: `price` trả về là `Decimal` object, không phải number. Serialize JSON tự động → string. Frontend phải `parseFloat` hoặc backend `.toString()` trước khi trả. Chốt cách xử lý một chỗ (interceptor response) chứ không rải mỗi controller.

### 3.3. Definition of Done Phase 3

- List sản phẩm hoạt động đầy đủ 4 chiều filter + 3 chiều sort + pagination, response đúng format.
- Cache hit rate quan sát được > 70% sau 20 lần gọi liên tiếp cùng query.
- Upload ảnh: gửi ảnh 4MB PNG → thành công; ảnh 6MB → 400; file `.exe` đổi tên `.png` → 400 (magic bytes chặn).
- Soft delete product → biến khỏi public list, admin vẫn thấy (query có flag `?includeDeleted=true`).
- Swagger `/api/docs` render đúng cho 15+ endpoint.

---

## PHASE 4 — CART + ORDERS + PAYMENT (4–5 ngày, ~24–30 giờ)

**Phase quan trọng nhất và khó nhất dự án.** Nếu người thực hiện chưa quen concurrency + transaction, thời gian có thể gấp đôi. Đừng cắt.

### 4.1. Thứ tự thực hiện

**Bước 1 — Cart module (3–4 giờ)**

CRUD cart items, lazy create cart (upsert theo userId). Trả cart kèm product info hiện tại + cờ `isUnavailable`. Không cache — dữ liệu cá nhân đọc/ghi 1:1.

**Bước 2 — Order module: skeleton + endpoints (2–3 giờ)**

Routes và controllers rỗng trước — chỉ để thấy 6 endpoint theo handbook 6.5. Thêm middleware `requireVerified` cho POST /orders.

**Bước 3 — State machine (2 giờ)**

`order.state.ts` chứa `TRANSITIONS` và `assertTransition`. Viết unit test đủ **ma trận 5x5** trạng thái để chốt chặn — chỉ 5 phút test cứu được nhiều bug logic:

```ts
describe('order state machine', () => {
  const allStates = ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'] as const;
  for (const from of allStates) {
    for (const to of allStates) {
      const allowed = TRANSITIONS[from].includes(to as any);
      it(`${from} → ${to}: ${allowed ? 'OK' : 'CHẶN'}`, () => {
        if (allowed) expect(() => assertTransition(from, to)).not.toThrow();
        else expect(() => assertTransition(from, to)).toThrow();
      });
    }
  }
});
```

**Bước 4 — Đặt hàng: transaction + chống oversell (6–8 giờ)**

Đây là phần cần đọc lại handbook 6.5 5 lần trước khi code. Điểm không được sai:

1. Check idempotency **trước** transaction: `findUnique({ userId_idempotencyKey })`. Có → return luôn.
2. Vào transaction: `$transaction(async (tx) => { ... }, { isolationLevel: 'ReadCommitted' })`.
3. Loop từng item: `tx.$executeRaw` với `UPDATE ... WHERE stock >= q AND deleted_at IS NULL`. Kiểm `rowCount === 0` → throw. **KHÔNG dùng `updateMany`** — không biết được item nào fail.
4. Tính total ở **server**, dùng `Decimal` (import từ `@prisma/client/runtime/library`):
```ts
import { Decimal } from '@prisma/client/runtime/library';
const total = items.reduce((s, i) => s.plus(new Decimal(i.price).times(i.qty)), new Decimal(0));
```
5. Create order + items + history + xóa cart items — tất cả trong transaction.
6. Bắt unique violation (`P2002` của Prisma) sau transaction — race 2 request cùng idempotency key → 1 thắng, 1 vướng constraint → tra DB lấy order đã tạo trả về.

**Bước 5 — Payment giả lập + finalize (3–4 giờ)**

`fakeCharge` NGOÀI transaction đặt hàng. Sau khi có kết quả, chạy transaction thứ 2:
- OK: `UPDATE order SET status='PAID'` (WHERE status='PENDING' — chống double process), tạo payment record, ghi history.
- FAIL: hoàn kho từng item (`UPDATE products SET stock=stock+qty`), update order CANCELLED, tạo payment FAILED, ghi history.

Queue email sau khi transaction commit thành công — **không** trong transaction (email không hoàn tác được nếu transaction rollback).

**Bước 6 — Hủy đơn + admin đổi trạng thái (2–3 giờ)**

Hủy đơn: transaction với conditional update `WHERE status IN ('PENDING','PAID')` + hoàn kho + history. Admin đổi trạng thái: dùng `assertTransition`, ghi history có `changedBy: adminUserId`.

**Bước 7 — Job quét đơn PENDING quá 15 phút (2 giờ)**

BullMQ repeatable job, mỗi 10 phút chạy 1 lần:
```ts
const stale = await prisma.order.findMany({
  where: { status: 'PENDING', createdAt: { lt: subMinutes(new Date(), 15) } },
});
for (const o of stale) {
  await cancelOrder(o.id, 'System: đơn quá hạn xử lý — hoàn kho tự động');
}
```

**Bước 8 — Concurrency test (3–4 giờ)**

Test đắt giá nhất dự án. Không có test này pass, phase không xong:

```ts
it('50 request đồng thời mua sản phẩm stock=10 → đúng 10 thành công, stock=0', async () => {
  const product = await seedProduct({ stock: 10, price: 100000 });
  const users = await Promise.all(Array.from({ length: 50 }, seedVerifiedUser));

  const promises = users.map((u) => placeOrderRequest(u.token, {
    idempotencyKey: crypto.randomUUID(),
    items: [{ productId: product.id, quantity: 1 }],
  }));
  const results = await Promise.allSettled(promises);

  const success = results.filter(r => r.status === 'fulfilled' && r.value.status === 201);
  const insufficientStock = results.filter(r =>
    r.status === 'fulfilled' && r.value.body?.error?.code === 'INSUFFICIENT_STOCK');

  expect(success.length).toBe(10);
  expect(insufficientStock.length).toBe(40);

  const p = await prisma.product.findUnique({ where: { id: product.id } });
  expect(p!.stock).toBe(0);
});
```

Chạy test này **10 lần liên tiếp** — pass cả 10 mới yên tâm. Nếu 1 lần fail → có race condition ẩn.

### 4.2. Bẫy phổ biến (đọc kỹ)

- **Prisma `updateMany` cho conditional update**: đừng. Với nhiều items, `updateMany` gộp WHERE, không biết item nào fail. Dùng `$executeRaw` từng item.
- **Transaction chứa I/O ngoài DB**: KHÔNG gọi `fakeCharge` (hoặc bất kỳ HTTP call nào) trong transaction. Nếu payment 800ms, transaction giữ connection + row lock 800ms → 10 request đồng thời sẽ timeout pool.
- **Isolation level**: Prisma default `ReadCommitted` — đúng cho case này. Đừng đổi `Serializable` vì "nghe an toàn hơn" — sẽ serialize hoá hết, throughput sập, và conditional update đã đủ đúng ở ReadCommitted.
- **Race idempotency key**: nhớ bắt lỗi Prisma `P2002` (unique violation) và trả về order đã tồn tại.
- **Order.total_amount tin client**: KHÔNG BAO GIỜ. Handbook BR3. Client gửi total → server tính lại từ giá trong DB. Đây là bug nghiêm trọng nhất mà dự án tự phát hiện được — nếu code review thấy `totalAmount: req.body.total` phải reject ngay.
- **Test flaky**: concurrency test có thể pass lúc chạy nhanh, fail khi máy chậm. Nếu fail 1/10, xem log — thường là bug thật, không phải test lỗi. Đừng thêm `retry`.

### 4.3. Definition of Done Phase 4

- End-to-end đặt hàng qua Postman: login → cart → POST /orders → xem order chi tiết → timeline 2–3 trạng thái.
- Concurrency test pass 10/10 lần chạy.
- Idempotency: cùng key gửi 2 lần → cùng order, không tạo trùng (kiểm qua DB).
- Payment fail rate 100% (`PAYMENT_FAIL_RATE=1`): đặt 10 đơn → 10 đơn CANCELLED, stock của product không đổi so với trước test.
- Hủy đơn 2 lần → lần 2 nhận 409.
- Job quét đơn kẹt: chèn tay 1 order PENDING createdAt cách đây 20 phút → sau 10 phút bị cancel + hoàn kho tự động.
- Ma trận state machine test đủ 25 case.

---

## PHASE 5 — FRONTEND KHÁCH HÀNG (4–5 ngày, ~24–30 giờ)

Cảnh báo về ước tính: **prototype đã có ≠ code thật đã có**. Prototype 1 file dùng mock data. Code thật cần:
- Setup Vite + Tailwind + TypeScript
- Router + protected routes
- Axios interceptor refresh token (dễ sai)
- TanStack Query cho từng feature
- Form validation với react-hook-form + zod
- Xử lý loading/error/empty state cho từng màn
- Responsive test trên mobile thật

Prototype giúp bỏ qua **thiết kế UX** (đã có) và **layout** (đã có tham chiếu), nhưng không bỏ qua được kỹ thuật.

### 5.1. Thứ tự thực hiện

**Bước 1 — Setup Vite + Tailwind + config (2–3 giờ)**

```bash
npm create vite@latest client -- --template react-ts
cd client
npm i axios @tanstack/react-query react-router-dom react-hook-form zod
npm i @hookform/resolvers zustand lucide-react recharts
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

`vite.config.ts` — proxy `/api` sang backend để giải quyết CORS + cookie:
```ts
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
```

Font Be Vietnam Pro cho tiếng Việt (dự án — có dấu). Config Tailwind theme colors (`primary: '#065f46'`) khớp prototype.

**Bước 2 — API client + auth store + refresh flow (4–5 giờ)**

Đây là phần **dễ sai nhất** frontend. Copy y hệt code từ handbook mục 7.2, đọc kỹ từng dòng:

- Access token trong Zustand store (memory), **không** localStorage.
- Response interceptor: 401 → gọi `/auth/refresh` 1 lần (biến `refreshing` singleton), phát lại request gốc; refresh fail → clear store, navigate `/login`.
- App khởi động: gọi `/auth/refresh` 1 lần để lấy lại access token nếu cookie còn (F5 không mất phiên).

Test bằng tay: login → đợi 15 phút (hoặc chỉnh access token TTL = 30s cho tiện test) → gọi API → phải thấy log network gọi `/refresh` xong tự động phát lại request cũ.

**Bước 3 — Router + protected routes + layouts (3 giờ)**

```tsx
// Setup từ handbook 7.2
<Routes>
  <Route element={<MainLayout />}>
    <Route index element={<StorePage />} />
    <Route path="products/:slug" element={<ProductPage />} />
    <Route element={<RequireAuth />}>
      <Route path="cart" element={<CartPage />} />
      {/* ... */}
    </Route>
  </Route>
  {/* ... */}
</Routes>
```

`RequireAuth`: đọc `useAuthStore`, chưa login → `<Navigate to={`/login?from=${pathname}`} replace />`.

**Bước 4 — Feature Auth: Login, Register, VerifyEmail, Forgot, Reset (4–5 giờ)**

- Form dùng `useForm({ resolver: zodResolver(schema) })`.
- **Copy zod schema từ backend** sang `client/src/features/auth/schemas.ts` — cùng validation rule, không lệch.
- Sau login: `setAccessToken(res.data.accessToken)` → `navigate(from ?? '/')`.
- VerifyEmail: `useSearchParams` lấy token → `useMutation` gọi API khi mount → hiện kết quả (loading/success/error).

**Bước 5 — Feature Catalog: list + detail (4–5 giờ)**

- URL state: dùng `useSearchParams` cho `q, categoryId, sort, page`. Đây là chỗ **bắt buộc** khớp handbook 7.1.
- Search debounce 400ms bằng custom hook `useDebounce`.
- `useQuery` với `queryKey: ['products', paramsObject]` + `placeholderData: keepPreviousData` — quan trọng cho UX không nháy trắng.
- Loading state: skeleton card (không spinner giữa màn). Empty state: có illustration + gợi ý bỏ bộ lọc.

**Bước 6 — Feature Cart + Checkout (4–5 giờ)**

- Cart badge header đọc chung `queryKey: ['cart']` — 1 nguồn.
- Optimistic update cho nút +/- quantity với `useMutation({ onMutate, onError, onSettled })` — tham khảo docs TanStack Query.
- Checkout: sinh `idempotencyKey = crypto.randomUUID()` bằng `useMemo(() => uuid(), [])` **một lần** khi component mount. Bấm nút → disable + spinner ngay.
- Xử lý lỗi INSUFFICIENT_STOCK: toast + `queryClient.invalidateQueries(['cart'])` để user thấy stockStatus cập nhật.

**Bước 7 — Feature Orders + Timeline (3 giờ)**

- Danh sách + chi tiết theo prototype. Nút hủy đơn hiện có điều kiện.
- Timeline: component Steps dọc — copy layout từ prototype.

### 5.2. Bẫy phổ biến

- **useEffect vô hạn**: fetch data trong `useEffect` + set state gây re-render → fetch lại. Không dùng useEffect cho data fetch — dùng TanStack Query.
- **Query key thiếu params**: `queryKey: ['products']` cố định → đổi filter không refetch. Phải là `['products', paramsObject]`.
- **Refresh loop**: interceptor 401 gọi refresh → refresh trả 401 → loop. Cứu: flag `_retried` như handbook, và refresh fail thì clear store + throw.
- **Vite proxy vs axios baseURL**: dùng cả 2 dễ sai path. Nếu Vite proxy `/api` sang `localhost:3000`, axios `baseURL: '/api'` — request gốc `/products` → axios `/api/products` → Vite proxy → BE `/api/products`. Chốt 1 cách, ghi vào README.
- **Cookie không được gửi**: axios cần `withCredentials: true` + backend `cors({ credentials: true, origin: [...] })` + cookie `SameSite=Lax`. Thiếu 1 trong 3 → 401 mà không hiểu tại sao.

### 5.3. Definition of Done Phase 5

Test end-to-end trên trình duyệt bằng tay:

- [ ] Đăng ký mới → nhận email trên Mailtrap → click link → verify thành công → tự động chuyển login.
- [ ] Đăng nhập → F5 → vẫn còn phiên (cookie refresh về).
- [ ] Vào `/products?q=nồi&sort=price_asc&page=2` → F5 → URL giữ nguyên, kết quả đúng.
- [ ] Thêm vào giỏ → refresh trang → giỏ vẫn còn (server-side).
- [ ] Checkout → bấm 2 lần liên tiếp → chỉ 1 đơn tạo.
- [ ] Login → mở DevTools > Application > Local Storage — **không có** access token ở đó (đúng: token trong memory).
- [ ] Chỉnh access TTL 30s → sau 30s gọi API → DevTools Network thấy 1 request `/refresh` trước request gốc.
- [ ] Mobile (Chrome DevTools device toolbar iPhone 12): responsive OK, hamburger menu hoạt động (nếu có).
- [ ] Cả app không có `dangerouslySetInnerHTML` (grep `git grep dangerouslySetInnerHTML client/` → rỗng).

---

## PHASE 6 — FRONTEND ADMIN + DASHBOARD (2–3 ngày, ~12–18 giờ)

Ngắn hơn vì nhiều component tái dùng (Button, Input, Table, Badge). Prototype đã có mẫu.

### 6.1. Thứ tự thực hiện

**Bước 1 — Admin layout + auth guard (2 giờ)**

`<RequireAuth role="ADMIN" />` — sai role không phải redirect login mà là trang 403 (khác trải nghiệm). Layout sidebar theo prototype.

**Bước 2 — Admin Products: table + form + upload (5–6 giờ)**

- Table tự viết ~150 dòng, không cần TanStack Table cho ≤ 10 cột.
- Form product dùng react-hook-form + zod (schema share với backend).
- Upload ảnh: 2 bước (create/update product → upload từng ảnh). Preview bằng `URL.createObjectURL`. Nhớ `URL.revokeObjectURL` khi unmount hoặc component sẽ leak memory dần.
- Soft delete với confirm modal — không xóa cứng mà không cảnh báo.

**Bước 3 — Admin Orders: table + đổi trạng thái (3 giờ)**

- Filter theo status (URL state).
- Dropdown chuyển trạng thái: **export TRANSITIONS thành file shared** (`shared/orderState.ts`), FE + BE import cùng. Dropdown chỉ hiện trạng thái hợp lệ.
- Confirm modal cho hành động không hoàn tác (CANCELLED, COMPLETED).

**Bước 4 — Admin Users: list + khóa/mở (2 giờ)**

Bảng đơn giản. Nút khóa/mở cho user role CUSTOMER. Không có nút xóa.

**Bước 5 — Dashboard (3–4 giờ)**

- 4 card số liệu (fetch từ `/api/admin/dashboard`).
- LineChart doanh thu 30 ngày.
- BarChart top 5 sản phẩm.
- Table đơn theo trạng thái.

Recharts responsive dùng `<ResponsiveContainer width="100%" height={220}>`.

### 6.2. Bẫy phổ biến

- **Table pagination reset khi filter**: đổi filter phải reset về page 1. Người dùng ở page 5 lọc theo status → còn 2 kết quả → không thấy gì → nghĩ hỏng.
- **File input reset**: sau upload thành công, `input[type=file]` giữ file cũ. `ref.current.value = ''` sau khi upload xong.
- **Recharts trong parent flex/grid**: cần `ResponsiveContainer` có chiều cao xác định (parent phải có `height`), không thì chart cao 0.

### 6.3. Definition of Done Phase 6

- Admin CRUD product đầy đủ: tạo, sửa (kèm đổi ảnh), soft delete, khôi phục.
- Đổi trạng thái đơn qua UI khớp state machine — không nhảy cóc được vì dropdown chỉ hiện option hợp lệ.
- Dashboard render với dữ liệu thật từ seed + đơn tự đặt trong quá trình test.
- Số liệu dashboard khớp query SQL chạy tay (test bằng cách chạy trực tiếp query trong `psql` và so).

---

## PHASE 7 — DOCKER PROD + CI + POLISH (2–3 ngày, ~12–18 giờ)

Phase mà nhiều dự án học tập dừng lại. Đừng — đây là phần **học được nhiều nhất về vận hành**.

### 7.1. Thứ tự thực hiện

**Bước 1 — Dockerfile production cho server (2–3 giờ)**

Multi-stage đúng handbook 9.2. Build local test:
```bash
docker build -t shoplite-api ./server
docker run --rm -p 3000:3000 --env-file .env.docker shoplite-api
```
Kiểm image size < 300MB. Nếu > 500MB → chưa multi-stage đúng.

**Bước 2 — Dockerfile production cho client (2 giờ)**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf`: SPA fallback `try_files $uri /index.html`, proxy `/api` sang backend.

**Bước 3 — docker-compose.prod.yml (2 giờ)**

Full stack: nginx (FE), api, worker, postgres, redis. Env qua `.env` file. API/worker không expose port.

Migration ở deploy: viết script `deploy.sh` chạy trên VPS:
```bash
docker compose pull
docker compose run --rm api npx prisma migrate deploy
docker compose up -d
docker image prune -f
```

**Bước 4 — GitHub Actions CI (3–4 giờ)**

`.github/workflows/ci.yml` với 2 jobs: `test` + `build-and-push`.

Test job cần services postgres + redis. Config đúng:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_PASSWORD: test
      POSTGRES_DB: shoplite_test
    ports: ['5432:5432']
    options: >-
      --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 5
```

Steps: checkout → setup-node (cache npm) → npm ci → prisma migrate deploy (DATABASE_URL trỏ service) → lint → typecheck (`tsc --noEmit`) → test → build FE.

Build-and-push job chỉ chạy khi `main` push và test pass. Push image lên GitHub Container Registry (free với public repo, có free tier cho private).

**Bước 5 — Polish + đo lường (2–3 giờ)**

- Lighthouse cho trang list sản phẩm — mục tiêu Performance ≥ 85, Accessibility ≥ 90.
- Bundle size: `npx vite-bundle-visualizer` — tách admin routes bằng `React.lazy` nếu chưa.
- Bảng đo p95 latency 5 endpoint chính (dùng k6 hoặc autocannon):
```bash
npx autocannon -c 10 -d 20 http://localhost:3000/api/products
```

### 7.2. Bẫy phổ biến

- **Build args Vite**: `VITE_API_URL` phải truyền qua ARG khi `docker build`, không phải env runtime (Vite build time, bake vào bundle).
- **Prisma migrate deploy trong Docker**: image chưa có OpenSSL đúng version → lỗi. Dùng `node:20-alpine` phải cài `openssl` package. Hoặc dùng `node:20-slim` (Debian) cho đỡ đau đầu.
- **CI PostgreSQL healthcheck**: nếu không có `options: --health-*`, service PG chưa sẵn sàng khi test chạy → fail chớp nhoáng. Bắt buộc chờ healthy.

### 7.3. Definition of Done Phase 7

- `docker compose -f docker-compose.prod.yml up -d` trên máy sạch → truy cập `localhost` (Nginx) → app chạy đầy đủ.
- Image size: API < 300MB, client (nginx layer) < 100MB.
- CI: PR mở → GitHub Actions xanh trong < 5 phút.
- Bundle size main chunk < 300KB gzip; admin chunk lazy load riêng.
- Lighthouse Performance ≥ 85 trên trang `/products`.

---

## PHASE 8 — DEPLOY VPS + BACKUP + GIÁM SÁT (2–3 ngày, ~10–15 giờ)

### 8.1. Thứ tự thực hiện

**Bước 1 — Chuẩn bị VPS (2 giờ)**

VPS 2GB RAM tối thiểu (khuyến nghị 4GB). Provider tùy chọn: Vultr, DigitalOcean, Hetzner, Cloud của FPT/Viettel — không có khác biệt kỹ thuật. Chi phí $5–10/tháng.

Ubuntu 24.04:
```bash
# tạo user thường
adduser deploy && usermod -aG sudo deploy
# ssh key
mkdir -p /home/deploy/.ssh && cat >> /home/deploy/.ssh/authorized_keys
# disable password login
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart ssh
# firewall
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
# docker
curl -fsSL https://get.docker.com | sh && usermod -aG docker deploy
apt install -y docker-compose-plugin
# unattended upgrades
apt install -y unattended-upgrades
```

**Bước 2 — DNS + HTTPS (1–2 giờ)**

- DNS A record `shoplite.webpx.vn` → IP VPS.
- Certbot với Nginx (dùng image `nginx-proxy/acme-companion` gọn hơn, hoặc certbot standalone).
- Server block Nginx: 80 redirect 443, 443 serve FE + proxy /api.

**Bước 3 — Deploy đầu tiên (2–3 giờ)**

Copy `docker-compose.prod.yml`, `nginx/`, tạo `.env` trên VPS (`chmod 600`). Chạy `deploy.sh`. Test truy cập.

**Bước 4 — Backup DB (2 giờ)**

Cron hằng đêm:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec postgres pg_dump -U postgres shoplite | gzip > /backups/shoplite_$DATE.sql.gz
find /backups -name 'shoplite_*.sql.gz' -mtime +30 -delete
rclone copy /backups/shoplite_$DATE.sql.gz gdrive:shoplite-backup/
```

Cron: `0 2 * * * /home/deploy/backup.sh >> /var/log/backup.log 2>&1`.

**Diễn tập restore** — quan trọng:
```bash
gunzip < backup.sql.gz | docker exec -i postgres psql -U postgres shoplite_test
```

Không diễn tập = không có backup.

**Bước 5 — Giám sát tối thiểu (1–2 giờ)**

- UptimeRobot free: ping `/health/ready` mỗi 5 phút, alert email + Telegram.
- Logrotate với Docker logging driver:
```yaml
logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }
```

**Bước 6 — CI deploy tự động (2–3 giờ)**

GitHub Actions job `deploy` (chỉ khi push main + test pass):
```yaml
- uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.VPS_HOST }}
    username: deploy
    key: ${{ secrets.VPS_SSH_KEY }}
    script: cd /home/deploy/shoplite && ./deploy.sh
```

### 8.2. Bẫy phổ biến

- **Backup trên cùng ổ với DB không phải backup**: bắt buộc đẩy đi rclone/S3.
- **Migration lỗi khi deploy**: rollback hạ tầng (đổi tag image cũ) nhưng migration đã chạy → schema không khớp. Nguyên tắc: migration phải backward-compatible cho 1 release. Nếu drop column → chia 2 release (release 1: code không dùng column nữa; release 2: migration drop).
- **Docker log đầy đĩa**: không config `max-size` → sau 2 tháng đầy 20GB, VPS chết.

### 8.3. Definition of Done Phase 8

- Truy cập `https://shoplite.webpx.vn` (hoặc domain thật) — hoạt động full flow.
- SSL Labs test → grade A trở lên.
- UptimeRobot dashboard xanh 24h liên tục.
- Backup file trên Google Drive/S3 với timestamp hôm qua.
- **Đã restore backup thành công 1 lần** vào DB test — không phải chỉ tin.
- Push commit lên main → 5–8 phút sau site tự update (kiểm bằng thay đổi text nhỏ).

---

## TỔNG KẾT LỘ TRÌNH

| Phase | Nội dung | Ước tính (ngày) | Đầu ra |
|---|---|---|---|
| 0 | Chuẩn bị, học nền, cài | 0.5–1 | Repo skeleton, môi trường sẵn |
| 1 | Nền móng backend | 2–3 | API health, DB seed, error handler |
| 2 | Auth + email queue | 3–4 | 8 endpoint auth, rotation, DLQ mini |
| 3 | Catalog + upload + cache | 3 | Public catalog + admin CRUD + Cloudinary |
| 4 | **Cart + Orders + Payment** | **4–5** | E-commerce lõi, concurrency test pass |
| 5 | Frontend khách | 4–5 | Storefront chạy đầy đủ |
| 6 | Frontend admin + dashboard | 2–3 | Admin panel + biểu đồ |
| 7 | Docker prod + CI | 2–3 | Image tối ưu + pipeline xanh |
| 8 | Deploy VPS + backup | 2–3 | Live trên domain thật, có backup |
| **Tổng** | | **22–28 ngày** (~130–170 giờ) | |

---

## PHẦN DÀNH RIÊNG CHO ANH VỚI VAI TRÒ QUẢN LÝ

Vì mấy thông tin của anh trong context (CEO, đang chuyển sang SaaS, đang có nhóm dev PHP/Flutter/WordPress) — nếu dự án này dùng để đào tạo nội bộ, cân nhắc mấy điểm này:

**1. Đây là dự án đào tạo cho stack Node/React, không phải dự án SaaS thật.** Nếu đích cuối là SaaS commerce cho khách hàng, còn thiếu: multi-tenancy, billing/subscription, cổng thanh toán thật (VNPay/MoMo), quản lý phiên bản, hỗ trợ khách hàng. Dự án này là "trường đua" để đội quen stack và các pattern quan trọng — không phải MVP thương mại.

**2. Cơ chế review giữa milestone.** Đây là chỗ tận dụng thế mạnh anh nói ("xây dựng cơ chế"). Đề xuất cụ thể:
- Sau mỗi phase, học viên nộp: link commit + DoD checklist tự đánh giá + demo 5 phút.
- Reviewer đối chiếu bằng cách chạy Definition of Done kiểm tra được. Không pass DoD → **không cho phép sang phase sau**. Đây là kỷ luật chống hiện tượng "code lấp liếm rồi phase sau vá".
- Ba phase tôi khuyên anh **đích thân review** vì chứa bài học "đắt" nhất: Phase 2 (rotation + reuse detection), Phase 4 (concurrency + transaction), Phase 8 (restore backup).

**3. Phase dễ trượt tiến độ và cách xử lý.**
- **Phase 2 và 4** hay vượt ước tính 50–100% với người chưa quen. Đừng ép về deadline — chất lượng code auth và transaction là thứ mang được sang mọi dự án sau.
- **Phase 5** người mới React hay lún ở refresh token flow và URL state. Nếu 6 giờ chưa xong bước 2, dừng lại pair review — không debug một mình quá 6 giờ.
- **Phase 7–8** hay bị bỏ qua vì "đã chạy local rồi". Nếu bỏ, phần học vận hành mất, người học ra sản phẩm không dám bảo vệ khi phỏng vấn.

**4. Chỉ số đo hiệu quả đào tạo sau khi xong.** Sau dự án, mỗi học viên phải trả lời được 5 câu bằng chính code họ viết:
- Vì sao dùng conditional update thay vì SELECT rồi UPDATE?
- Vì sao refresh token phải rotate và reuse detection giải quyết gì?
- Cache invalidation dùng version key có ưu điểm gì so với DEL SCAN?
- Vì sao payment nằm ngoài transaction trừ kho?
- Vì sao access token không lưu localStorage?

Trả lời không được câu nào tức là phase liên quan chưa đạt — dù DoD checklist đầy đủ tick.

**5. Nếu chỉ 1 người làm (không phải đào tạo nhóm)**: bỏ qua mục "cơ chế review", nhưng vẫn tự viết post-mortem 1–2 trang sau mỗi phase — cái gì mất nhiều thời gian, cái gì làm lại nếu bắt đầu lại. Đây là tài liệu quý cho lần sau anh training người khác cùng dự án này.

---

*Đây là lộ trình cho dự án học tập. Nếu muốn biến thành dự án SaaS thương mại thật, cần một tài liệu khác — nói lại tôi biết để chuẩn bị.*
