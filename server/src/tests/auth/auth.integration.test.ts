import { describe, it, expect } from "vitest";
import { api } from "../helpers/request";
import { prisma } from "../../lib/prisma";
import { verifyAccessToken } from "../../modules/auth/token.service";
import {
  DEFAULT_PASSWORD,
  createLoggedInUser,
  createVerifiedUser,
  emailJobs,
  getRefreshCookie,
  getRefreshCookieValue,
  lastEmailToken,
  login,
  refreshWith,
  register,
  uniqueEmail,
} from "../helpers/auth";

describe("POST /api/auth/register", () => {
  it("tạo user chưa verify và đẩy job verify-email vào queue", async () => {
    const email = uniqueEmail();

    const { res } = await register(email);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain("Đăng ký thành công");

    const user = await prisma.user.findUnique({ where: { email } });

    expect(user).not.toBeNull();
    expect(user!.emailVerified).toBe(false);
    expect(user!.role).toBe("CUSTOMER");

    // Password phai duoc hash — khong bao gio luu plaintext.
    expect(user!.passwordHash).not.toBe(DEFAULT_PASSWORD);

    expect(emailJobs().map((j) => j.name)).toContain("verify-email");
  });

  it("email trùng → 409, không tạo user thứ hai", async () => {
    const email = uniqueEmail();

    await register(email);

    const res = await api
      .post("/api/auth/register")
      .send({ fullName: "Ke trung ten", email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_EXISTS");

    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it("password dưới 8 ký tự → 400 VALIDATION_ERROR", async () => {
    const res = await api
      .post("/api/auth/register")
      .send({ fullName: "Test User", email: uniqueEmail(), password: "1234" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/verify-email", () => {
  it("token hợp lệ → user thành verified", async () => {
    const { email, verifyToken } = await register();

    const res = await api.post("/api/auth/verify-email").send({ token: verifyToken });

    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email } });

    expect(user!.emailVerified).toBe(true);
  });

  it("token dùng lần thứ hai → 400 (token chỉ dùng được một lần)", async () => {
    const { verifyToken } = await register();

    await api.post("/api/auth/verify-email").send({ token: verifyToken }).expect(200);

    const res = await api.post("/api/auth/verify-email").send({ token: verifyToken });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("token rác → 400, không phải 500", async () => {
    const res = await api.post("/api/auth/verify-email").send({ token: "khong-phai-jwt" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});

describe("POST /api/auth/login", () => {
  it("đăng nhập thành công → trả access token + set refresh cookie httpOnly", async () => {
    const { email } = await createVerifiedUser();

    const { res } = await login(email);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTypeOf("string");

    // Refresh token KHONG duoc lo ra body — chi song trong cookie httpOnly.
    expect(res.body.data.refreshToken).toBeUndefined();

    const cookie = getRefreshCookie(res);

    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/api/auth");
    expect(cookie).toMatch(/SameSite=Lax/i);

    // Access token mang du claim cho middleware doc ve sau.
    const payload = verifyAccessToken(res.body.data.accessToken);

    expect(payload.role).toBe("CUSTOMER");
    expect(payload.verified).toBe(true);

    // Refresh token luu trong DB duoi dang hash, khong phai plaintext.
    const stored = await prisma.refreshToken.findFirst();

    expect(stored).not.toBeNull();
    expect(stored!.revoked).toBe(false);
    expect(stored!.tokenHash).not.toContain(".");
  });

  it("sai password → 401 INVALID_CREDENTIALS", async () => {
    const { email } = await createVerifiedUser();

    const res = await api
      .post("/api/auth/login")
      .send({ email, password: "sai-mat-khau-roi" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("email không tồn tại → 401 với đúng message như sai password (không lộ email nào có thật)", async () => {
    const res = await api
      .post("/api/auth/login")
      .send({ email: "khong-ton-tai@test.local", password: DEFAULT_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("BR4: user chưa verify VẪN login được, nhưng access token mang verified=false", async () => {
    const { email } = await register();

    const { res } = await login(email);

    expect(res.status).toBe(200);

    const payload = verifyAccessToken(res.body.data.accessToken);

    expect(payload.verified).toBe(false);
  });

  it("user bị khóa (is_active=false) → 403", async () => {
    const { email } = await createVerifiedUser();

    await prisma.user.update({ where: { email }, data: { isActive: false } });

    const { res } = await login(email);

    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/refresh — rotation", () => {
  it("refresh trả access token mới và xoay refresh cookie mới", async () => {
    const { refreshCookie } = await createLoggedInUser();

    const res = await refreshWith(refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf("string");

    const newCookie = getRefreshCookie(res);

    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(refreshCookie);

    // Token cu bi revoke, token moi con song, ca hai cung mot family.
    const tokens = await prisma.refreshToken.findMany({ orderBy: { createdAt: "asc" } });

    expect(tokens).toHaveLength(2);
    expect(tokens[0].revoked).toBe(true);
    expect(tokens[1].revoked).toBe(false);
    expect(tokens[1].familyId).toBe(tokens[0].familyId);
  });

  it("refresh token cũ dùng lại sau khi đã rotate → 401", async () => {
    const { refreshCookie } = await createLoggedInUser();

    await refreshWith(refreshCookie).expect(200);

    const res = await refreshWith(refreshCookie);

    expect(res.status).toBe(401);
  });

  it("REUSE DETECTION: dùng lại token cũ → cả family bị revoke, token mới cũng chết", async () => {
    const { refreshCookie } = await createLoggedInUser();

    // Lan refresh dau: hop le, sinh ra cookie moi.
    const first = await refreshWith(refreshCookie).expect(200);
    const newCookie = getRefreshCookie(first)!;

    // Ke gian giu token CU va dung lai → he thong phat hien.
    await refreshWith(refreshCookie).expect(401);

    // Day moi la diem mau chot: token MOI (hop le, cua nan nhan) cung phai chet,
    // vi ca family da bi revoke. Khong co assert nay thi test reuse detection vo nghia.
    const afterRevoke = await refreshWith(newCookie);

    expect(afterRevoke.status).toBe(401);

    const tokens = await prisma.refreshToken.findMany();

    expect(tokens).toHaveLength(2);
    expect(tokens.every((t) => t.revoked)).toBe(true);
  });

  it("refresh fail → cookie bị xóa để client không lặp vô hạn 401 → refresh", async () => {
    const res = await api.post("/api/auth/refresh").set("Cookie", "refreshToken=rac");

    expect(res.status).toBe(401);
    expect(getRefreshCookieValue(res)).toBe("");
  });

  it("không có cookie → 401, không phải 500", async () => {
    const res = await api.post("/api/auth/refresh");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revoke refresh token hiện tại, xóa cookie, refresh sau đó → 401", async () => {
    const { refreshCookie } = await createLoggedInUser();

    const res = await api.post("/api/auth/logout").set("Cookie", refreshCookie);

    expect(res.status).toBe(200);
    expect(getRefreshCookieValue(res)).toBe("");

    expect((await prisma.refreshToken.findFirst())!.revoked).toBe(true);

    await refreshWith(refreshCookie).expect(401);
  });

  it("logout khi không có cookie → vẫn 200 (idempotent, không làm client mắc kẹt)", async () => {
    await api.post("/api/auth/logout").expect(200);
  });
});

describe("Forgot / Reset password", () => {
  it("forgot-password với email không tồn tại → vẫn 200, không đẩy job (chống dò email)", async () => {
    const res = await api
      .post("/api/auth/forgot-password")
      .send({ email: "khong-ton-tai@test.local" });

    expect(res.status).toBe(200);
    expect(emailJobs().map((j) => j.name)).not.toContain("reset-password");
  });

  it("reset password thành công → login bằng mật khẩu mới, mật khẩu cũ chết", async () => {
    const { email } = await createVerifiedUser();

    await api.post("/api/auth/forgot-password").send({ email }).expect(200);

    const token = lastEmailToken("reset-password");
    const newPassword = "mat-khau-moi-123";

    await api
      .post("/api/auth/reset-password")
      .send({ token, password: newPassword })
      .expect(200);

    const withNew = await login(email, newPassword);
    expect(withNew.res.status).toBe(200);

    const withOld = await login(email, DEFAULT_PASSWORD);
    expect(withOld.res.status).toBe(401);
  });

  it("reset token dùng lần thứ hai → 400", async () => {
    const { email } = await createVerifiedUser();

    await api.post("/api/auth/forgot-password").send({ email }).expect(200);

    const token = lastEmailToken("reset-password");

    await api
      .post("/api/auth/reset-password")
      .send({ token, password: "mat-khau-moi-123" })
      .expect(200);

    const res = await api
      .post("/api/auth/reset-password")
      .send({ token, password: "mat-khau-khac-456" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("reset token hết hạn → 400", async () => {
    const { email } = await createVerifiedUser();

    await api.post("/api/auth/forgot-password").send({ email }).expect(200);

    const token = lastEmailToken("reset-password");

    // Day ngay het han ve qua khu thay vi cho 1 tieng.
    await prisma.emailToken.updateMany({
      where: { type: "RESET" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await api
      .post("/api/auth/reset-password")
      .send({ token, password: "mat-khau-moi-123" });

    expect(res.status).toBe(400);
  });

  it("reset password → thu hồi toàn bộ refresh token đang sống", async () => {
    const { email, refreshCookie } = await createLoggedInUser();

    await api.post("/api/auth/forgot-password").send({ email }).expect(200);

    await api
      .post("/api/auth/reset-password")
      .send({ token: lastEmailToken("reset-password"), password: "mat-khau-moi-123" })
      .expect(200);

    // Phien dang mo truoc do phai van ra — day chinh la ly do ton tai cua buoc nay.
    await refreshWith(refreshCookie).expect(401);
  });
});

describe("POST /api/auth/change-password", () => {
  it("đổi mật khẩu thành công và thu hồi mọi refresh token", async () => {
    const { email, accessToken, refreshCookie } = await createLoggedInUser();

    const res = await api
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ oldPassword: DEFAULT_PASSWORD, newPassword: "mat-khau-moi-123" });

    expect(res.status).toBe(200);

    await refreshWith(refreshCookie).expect(401);

    expect((await login(email, "mat-khau-moi-123")).res.status).toBe(200);
  });

  it("sai mật khẩu hiện tại → 400, mật khẩu không đổi", async () => {
    const { email, accessToken } = await createLoggedInUser();

    const res = await api
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ oldPassword: "doan-mo", newPassword: "mat-khau-moi-123" });

    expect(res.status).toBe(400);

    expect((await login(email, DEFAULT_PASSWORD)).res.status).toBe(200);
  });

  it("không có access token → 401", async () => {
    const res = await api
      .post("/api/auth/change-password")
      .send({ oldPassword: DEFAULT_PASSWORD, newPassword: "mat-khau-moi-123" });

    expect(res.status).toBe(401);
  });

  it("REGRESSION: userId trong body bị bỏ qua — không đổi được mật khẩu của người khác", async () => {
    const victim = await createVerifiedUser();
    const attacker = await createLoggedInUser();

    const victimUser = await prisma.user.findUnique({ where: { email: victim.email } });

    // Ke tan cong gui kem userId cua nan nhan. Service phai lay id tu access token,
    // khong phai tu body — neu tin body thi day la lo hong chiem tai khoan.
    await api
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${attacker.accessToken}`)
      .send({
        userId: victimUser!.id,
        oldPassword: DEFAULT_PASSWORD,
        newPassword: "bi-chiem-tai-khoan",
      });

    // Nan nhan van login duoc bang mat khau cu, va mat khau moi cua ke tan cong khong an.
    expect((await login(victim.email, DEFAULT_PASSWORD)).res.status).toBe(200);
    expect((await login(victim.email, "bi-chiem-tai-khoan")).res.status).toBe(401);
  });
});
