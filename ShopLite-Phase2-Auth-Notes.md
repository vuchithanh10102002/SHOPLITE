# ShopLite — Phase 2: Auth (ghi chú luồng & kiến thức)

> Tài liệu này mô tả **code auth hiện có trong repo**, không phải spec.
> Spec vẫn là `ShopLite-FullStack-Handbook.md` (làm cái gì, vì sao) và `ShopLite-Roadmap.md` (làm theo thứ tự nào).
> Cập nhật: 2026-07-14.

---

# Phần 1 — Luồng hiện tại

## 1. Một request đi qua những lớp nào

Trong `server/src/app.ts`, mọi request xếp hàng qua đúng thứ tự này:

```
express.json() → cookieParser() → requestId → httpLogger → router → notFound → errorHandler
```

Điểm quan trọng: **không middleware nào tự trả lỗi bằng `res.json`**. Kể cả rate limit khi chặn cũng gọi `next(Errors.tooManyRequests(...))`. Nhờ vậy mọi lỗi thoát ra qua đúng một cửa là `errorHandler`, và format lỗi đồng nhất toàn hệ thống.

`AppError` (`shared/errors.ts`) mang 4 thứ:

| Trường | Dùng cho |
| --- | --- |
| `statusCode` | HTTP status |
| `code` | máy đọc — `EMAIL_EXISTS`, `INSUFFICIENT_STOCK`… |
| `message` | người đọc |
| `details` | dữ liệu phụ, vd `{ retryAfter }` |

`trust proxy` chỉ bật ở production — ở dev không có Nginx, bật lên thì client tự đặt header `X-Forwarded-For` giả IP và đi vòng rate limit.

## 2. Route auth và rate limit

Trong `auth.routes.ts`, mỗi route nhạy cảm có **counter rate limit riêng**:

| Route | Hạn mức |
| --- | --- |
| `/register` | 5 / phút |
| `/login` | 10 / phút |
| `/forgot-password` | 3 / phút |
| `/reset-password` | 5 / phút |

Dùng chung một instance `rateLimit` nghĩa là dùng chung hạn mức — gọi `/register` 5 lần là hết cả lượt login.

`middlewares/rate-limit.ts` là fixed-window counter trên Redis: `INCR` + `EXPIRE NX` + `TTL` gói trong một `MULTI` (nguyên tử — nếu tách 2 lệnh mà process chết ở giữa thì key không bao giờ có TTL, user bị khóa vĩnh viễn). Khi Redis chết thì **fail-open**: log warn rồi cho request đi qua, vì rate limit là lớp bảo vệ chứ không phải nguồn chân lý.

## 3. Hai loại token, hai vai trò khác hẳn nhau

Đây là trục xương sống của cả module.

**Access token** — JWT thật, ký bằng `JWT_ACCESS_SECRET`, sống ngắn, mang claim `{ sub, role, verified }`. Client giữ trong memory, gắn vào header `Authorization`. Không tra DB khi verify → nhanh.

**Refresh token** — chuỗi **random 64 byte hex, KHÔNG phải JWT**. Nó không cần self-contained vì mỗi lần refresh đều **bắt buộc tra DB** để biết token đã bị revoke chưa. Và nếu dùng JWT ở đây thì sai thật sự: `jwt.sign({sub})` cho cùng user trong cùng một giây sinh ra chuỗi y hệt (`iat` chỉ có độ phân giải giây) → `tokenHash` trùng → vỡ unique constraint → 500. Login 2 lần liên tiếp là đủ hỏng.

DB **chỉ lưu `sha256(token)`**, không lưu token gốc — lộ DB thì token trong đó cũng vô dụng. SHA-256 chứ không bcrypt là đủ: token đã có 256+ bit entropy nên không brute force được, và lookup phải nhanh vì mỗi lần refresh đều gọi.

Refresh token đi bằng **cookie httpOnly** (`Path=/api/auth`, `SameSite=Lax`, `Secure` chỉ ở prod), không bao giờ nằm trong JSON body. XSS không đọc được nó, và cookie chỉ được gửi kèm khi gọi nhóm `/api/auth`.

## 4. Từng luồng nghiệp vụ

### Register
Tạo user → sinh email token random (32 byte), lưu `sha256` với `type: VERIFY`, hạn 24h → đẩy job `verify-email` vào `emailQueue`. Trả 201, **không** trả token — user phải qua email.

### Login
Hai chi tiết đáng nói:

- **Chống timing attack**: kể cả khi không tìm thấy user, code vẫn chạy `bcrypt.compare` với một hash giả, để thời gian phản hồi không tiết lộ email nào tồn tại.
- **BR4**: user chưa verify email **vẫn login được**, chỉ không đặt hàng được. Trạng thái đó đi theo claim `verified` trong access token; việc chặn đặt hàng để middleware `requireVerified` lo ở Phase 4. Chỉ `isActive: false` mới bị chặn login (403).

Login xong sinh refresh token với một `familyId` mới (`randomUUID`) — **mỗi lần login là một chuỗi rotation độc lập**.

### Refresh — phần thông minh nhất của module
Nhận token từ cookie, hash lên, tra DB:

- Không tìm thấy → 401.
- Tìm thấy nhưng **đã `revoked`** → **reuse detection**. Token đã dùng rồi mà còn quay lại nghĩa là có kẻ đang giữ bản sao token cũ. Xử lý: **revoke sạch cả `familyId`** — mọi phiên sinh ra từ lần login đó chết hết, cả nạn nhân lẫn kẻ trộm đều bị buộc login lại. Có log warn kèm `userId` + `familyId`.
- Hợp lệ → **rotate**: revoke token cũ + tạo token mới **cùng family**, trong **một `$transaction`** (tách ra mà chết ở giữa thì hoặc user mất phiên, hoặc tồn tại 2 token sống cùng lúc).

Nếu refresh fail vì bất kỳ lý do gì, controller **clear cookie** trước khi `next(err)` — nếu không client sẽ lặp vô hạn vòng 401 → refresh → 401.

### Logout
Cố ý **idempotent**. Không có cookie, token rác, hay token không tồn tại → vẫn coi là thành công và vẫn clear cookie. Dùng `updateMany` chứ không `update` để Prisma không throw `P2025` khi không khớp bản ghi nào. Báo lỗi ở đây chỉ làm client mắc kẹt không đăng xuất được.

### Forgot password
Luôn trả **cùng một message 200** dù email có tồn tại hay không, để không lộ email nào có trong hệ thống. Nếu có user thì sinh RESET token hạn 1h và đẩy job `reset-password`.

### Verify email / Reset password
Dùng chung `consumeEmailToken`: tra theo hash, kiểm tra **đúng `type`** (không thể lấy token VERIFY đi đổi mật khẩu), kiểm tra chưa hết hạn. Token dùng một lần — **xóa trong cùng transaction** với hành động chính. Không tìm thấy = token giả *hoặc* đã dùng rồi, cả hai trả cùng một lỗi.

### Đổi / reset password
**Revoke toàn bộ refresh token của user** — vì người ta thường đổi mật khẩu chính lúc nghi bị lộ, nên mọi phiên cũ phải chết. `changePassword` lấy `userId` **từ access token**, không bao giờ từ body — tin body thì bất kỳ ai cũng đổi được mật khẩu của người khác.

## 5. Email worker (queue → consumer)

API và worker là **2 process chạy từ cùng một codebase** (`npm run dev` / `npm run worker`). Tách process để job email chậm hoặc fail không ảnh hưởng latency của HTTP request.

**Producer** — `lib/queue.ts`. `attempts: 3` + `backoff: exponential, delay 1000` đặt ở **`defaultJobOptions` của queue**, không lặp lại ở từng `.add()`: producer nằm rải rác (auth.service, sau này order.service), quên một chỗ là job đó im lặng không retry. Retry giãn dần 1s → 2s → 4s, vì lỗi SMTP thường là tạm thời (rate limit provider, mạng chớp) — đâm lại ngay chỉ làm provider chặn mạnh hơn.

**DLQ** — `removeOnFail: { count: 5000 }`. Job fail hết 3 lượt **nằm lại trong failed set**, không biến mất. Xem/thử lại bằng `npm run queue:failed [-- retry]`. Đây là "DLQ mini" của dự án (Handbook §6.7, FR-N1).

**Consumer** — `workers/email.worker.ts`, 3 job type: `verify-email`, `reset-password`, `order-status`. Logic tách thành hàm `processEmailJob(job)` riêng khỏi `new Worker(...)` để test gọi thẳng được, không cần Redis thật.

Giao kèo với BullMQ, cả module xoay quanh đúng ba dòng này:

| Consumer làm gì | BullMQ hiểu là |
| --- | --- |
| return bình thường | job xong |
| **ném lỗi thường** | lỗi tạm thời → **retry** theo attempts/backoff |
| ném `UnrecoverableError` | lỗi vĩnh viễn → **không retry**, vào thẳng failed set |

Phân biệt hai loại lỗi là toàn bộ giá trị của worker này. Payload sai schema, tên job lạ, order không tồn tại → thử lại 3 lần cũng sai y như lần đầu → `UnrecoverableError`, không phí 3 lượt chờ. SMTP timeout / `ECONNRESET` → lỗi thường → retry.

**Payload đọc từ Redis được validate bằng Zod y như request HTTP.** Nó đi qua Redis dưới dạng JSON, rời khỏi biên giới type của TS; worker là process khác, có thể đang chạy code phiên bản cũ hơn API (deploy lệch nhau vài giây). Dữ liệu từ ngoài thì không tin được.

**`order-status` chỉ mang `orderId`, không mang sẵn trạng thái/tổng tiền.** Job có thể chạy lại sau vài giây (retry) — lúc đó snapshot trong payload đã cũ. Worker tự đọc DB → email luôn phản ánh trạng thái **thật** tại lúc gửi.

**At-least-once, chấp nhận được.** BullMQ có thể chạy lại job sau crash → email có thể gửi 2 lần. Gửi trùng một email xác nhận thì không chết ai. Nhưng ghi nhận bài học: nếu job là "cộng tiền" thì bắt buộc phải check bảng `processed` (idempotent consumer thật).

**Graceful shutdown của worker** (`worker.ts`) — `worker.close()` đợi job **đang chạy** xong rồi mới đóng. `process.exit()` ngay thì job đang gửi bị bỏ giữa chừng, BullMQ không nhận được kết quả nên sau `lockDuration` coi là stalled và giao lại cho worker khác → **email gửi 2 lần**. Chậm 1 giây lúc deploy, đổi lại không gửi trùng.

**Concurrency 5** — SMTP provider nào cũng có giới hạn kết nối; thả 100 job cùng lúc là tự chuốc `421 too many connections`.

**Escape HTML trong template** — `fullName` do user tự đặt lúc đăng ký. Tên kiểu `<img src=x onerror=...>` mà nối thẳng vào template là XSS trong hòm thư người nhận.

## 6. Lỗ hổng còn lại trong luồng này

1. **Response thành công và response lỗi khác format** — thành công trả JSON trần (`{accessToken, user}`), lỗi trả `{success:false, ...}`. `shared/response.ts` đang rỗng. Frontend sẽ phải viết 2 nhánh xử lý.
2. **`requestId` chưa được bơm vào job** — payload đã có sẵn field `requestId` (optional) và worker đã log nó, nhưng producer trong `auth.service` chưa truyền vào (service không chạm `req`). Cần một AsyncLocalStorage để trace xuyên API → worker (Handbook §6.0d).

---

# Phần 2 — Kiến thức đã nằm trong code

## Bảo mật xác thực (nhóm nặng nhất)

- **Băm mật khẩu bằng bcrypt có cost cấu hình được** — `BCRYPT_COST` 12 ở prod, 4 ở test, vì mỗi hash cost 12 tốn ~250ms; để nguyên thì suite chậm gấp 10 lần. Tham số bảo mật phải là biến môi trường, không phải hằng số hardcode.
- **Chống timing attack** (`auth.service.ts:72`) — không tìm thấy user vẫn chạy `bcrypt.compare` với hash giả. Return sớm là để lộ email nào tồn tại.
- **Chống user enumeration** (`forgotPassword`) — luôn cùng một message 200.
- **Hai loại token, hai triết lý** — access = JWT (self-contained, nhanh); refresh = chuỗi random (bắt buộc tra DB, nên JWT vô dụng — và còn sai vì `iat` chỉ phân giải tới giây → tokenHash trùng).
- **Chỉ lưu hash của token trong DB** — cùng nguyên tắc với password. SHA-256 chứ không bcrypt vì token đã đủ entropy còn lookup phải nhanh.
- **Refresh token rotation + reuse detection theo `familyId`** — kiến thức "cao cấp" nhất trong module.
- **Cookie httpOnly** — `httpOnly` chặn XSS đọc, `Path` giảm bề mặt tấn công, `SameSite=Lax` chặn CSRF cơ bản, `Secure` chỉ prod vì dev chạy http.
- **Token dùng một lần, có `type`, có hạn** — không thể lấy token VERIFY đi đổi mật khẩu.
- **Đổi mật khẩu → revoke mọi phiên.**
- **`userId` lấy từ access token, không bao giờ từ body.**
- **Redact log** (`httpLogger.ts`) — `set-cookie` và `cookie` header chứa refresh token **plaintext**. Không redact thì mỗi lần login là một token còn sống nằm trong log; ai đọc được log là chiếm được phiên.

## Thiết kế API & xử lý lỗi

- **Một cửa lỗi duy nhất** — `AppError` + `errorHandler`; rate limit chặn cũng đi qua `next(err)`.
- **`code` cho máy đọc tách khỏi `message` cho người đọc** — frontend switch trên `EMAIL_EXISTS`, không parse chuỗi tiếng Việt.
- **Validate input bằng Zod ở biên** — service nhận vào dữ liệu đã sạch.
- **Validate env lúc khởi động** (`config/env.ts`) — thiếu biến thì process chết ngay giây đầu, không phải chết lúc 3h sáng khi có request đầu tiên chạm tới.
- **Idempotent logout** — `updateMany` thay vì `update` để không throw `P2025`.
- **Clear cookie khi refresh fail** — không thì client lặp vô hạn 401 → refresh → 401.

## Hạ tầng & vận hành

- **Rate limit fixed-window trên Redis** — `MULTI` để nguyên tử; có ghi rõ nhược điểm đã biết (burst ở ranh giới cửa sổ).
- **Fail-open khi Redis chết** — mất lớp bảo vệ thì app chậm đi chứ không chết theo.
- **Counter riêng từng route.**
- **`trust proxy` chỉ bật ở prod** — không bật sau Nginx thì cả hệ thống chung một counter; bật ở dev thì client spoof `X-Forwarded-For` đi vòng rate limit.
- **Graceful shutdown** (`index.ts`) — bắt SIGTERM/SIGINT, đóng server → disconnect Prisma → quit Redis, kèm `setTimeout(...).unref()` 10s làm chốt cưỡng bức nếu treo.
- **Structured logging bằng Pino + `requestId`** — trace một request qua nhiều dòng log.
- **Job queue (BullMQ) đầy đủ vòng đời** — producer (attempts + exponential backoff) → Redis → consumer (3 job type) → failed set làm DLQ. Tách việc chậm khỏi request cycle.
- **Phân biệt lỗi tạm thời và lỗi vĩnh viễn** — `UnrecoverableError` để không phí 3 lượt retry cho thứ chắc chắn sai lại (payload hỏng, order không tồn tại).
- **At-least-once delivery** — job có thể chạy lại; email gửi trùng chấp nhận được, "cộng tiền" thì không.
- **Graceful shutdown của worker** — `close()` đợi job đang chạy xong, nếu không job bị coi là stalled → chạy lại → gửi trùng.
- **Transaction cho thao tác phải toàn-vẹn-hoặc-không** — rotate token, reset password, verify email.

## Testing

- **Test chạy trên DB + Redis riêng, có chốt an toàn** — `setup.ts` throw nếu `NODE_ENV !== "test"` hoặc `DATABASE_URL` không chứa "test". Bài học đắt: trước khi tách, mỗi lần `npm test` là xóa sạch DB dev.
- **Truncate theo chiều phụ thuộc khóa ngoại** — con trước, cha sau.
- **`flushdb` Redis giữa các test** — không có thì test thứ 3 ăn 429 vì counter của test 1, 2 còn sống trong cửa sổ 60s.
- **Mock ở đúng đường nối** — mock `emailQueue` là **cách duy nhất** lấy được token verify/reset ở dạng plaintext, vì DB chỉ lưu `sha256`. Ví dụ đẹp của "mock để quan sát", không phải "mock cho nhanh".
- **Integration test thật (32 cái)** — gọi qua HTTP, chạm DB thật, không mock service.

## Chưa có trong code (còn nợ)

- `helmet` + `cors` (đã cài trong `package.json`, chưa wire vào `app.ts`).
- Response format thống nhất cho ca thành công (`shared/response.ts` đang rỗng).
- RBAC — `role` đã nằm trong token nhưng chưa middleware nào đọc.
- `requireVerified` — claim `verified` đã phát ra nhưng chưa ai tiêu thụ (Phase 4).
- Gỡ `bcryptjs` (trùng với `bcrypt`, chỉ dùng `bcrypt`).
