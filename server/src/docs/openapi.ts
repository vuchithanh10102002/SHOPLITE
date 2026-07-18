import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";

// PHAI goi TRUOC moi lan dung `.openapi()` ben duoi. `z` o day va `z` trong cac
// module schema (auth/category/product) la CUNG mot instance (deu import tu
// "zod"), nen patch nay ap dung toan cuc — khong can extend lai o tung file.
// Cac schema da duoc tao luc import; `.openapi()` chi can co mat luc mInh GOI no.
extendZodWithOpenApi(z);

// Request schema THAT — dung lam nguon su that duy nhat: docs sinh tu chinh cai
// zod dang validate, khong the lech. (handbook 2 muc "API Docs").
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../modules/auth/auth.schemas";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
} from "../modules/categories/category.schemas";
import {
  createProductSchema,
  updateProductSchema,
  listProductQuerySchema,
  productIdSchema,
  productSlugSchema,
  productImageParamsSchema,
} from "../modules/products/product.schemas";

const registry = new OpenAPIRegistry();

// Bearer JWT cho cac route can dang nhap. Route nao gan `security: [{ bearerAuth
// }]` thi Swagger UI hien nut "Authorize" + o dan token.
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

// ── Response entity schemas ──────────────────────────────────────────────────
// Day la HOP DONG output, doc tay (khong suy ra tu Prisma) — vi API co chu y chi
// lo mot tap con field (vd product KHONG lo `stock`/`publicId`). Dang chuoi cho
// `price`/thoi gian phan anh dung cai serialize ra JSON, khong phai kieu DB.

const messageSchema = z.object({ message: z.string() }).openapi("Message");

const userSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    fullName: z.string(),
    role: z.enum(["CUSTOMER", "ADMIN"]),
    emailVerified: z.boolean(),
  })
  .openapi("User");

// Cay danh muc de quy: `children` la mang cung shape. Generator khong dung ZodLazy
// nen KHONG lo de quy that — doc `children` la mang bat ky kem mo ta, du de nguoi
// doc hieu. Danh doi it chinh xac lay khoi UnknownZodTypeError.
const categoryNodeSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    children: z
      .array(z.any())
      .openapi({ description: "Mảng CategoryNode con — đệ quy cùng shape" }),
  })
  .openapi("CategoryNode");

const categorySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    parentId: z.uuid().nullable(),
  })
  .openapi("Category");

const productImageSchema = z
  .object({
    id: z.uuid(),
    url: z.url(),
    sortOrder: z.int(),
  })
  .openapi("ProductImage");

const productSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    price: z
      .string()
      .openapi({ example: "199000.00", description: "Decimal(12,2) serialize thành string" }),
    stockStatus: z.enum(["in_stock", "low", "out"]),
    category: z.object({ id: z.uuid(), name: z.string(), slug: z.string() }),
    images: z.array(productImageSchema),
    createdAt: z.string().openapi({ format: "date-time" }),
  })
  .openapi("Product");

// Chi nhanh admin (?includeDeleted) moi tra `deletedAt` — public khong bao gio.
const adminProductSchema = productSchema
  .extend({
    deletedAt: z.string().nullable().openapi({ format: "date-time" }),
  })
  .openapi("AdminProduct");

const pageMetaSchema = z
  .object({
    page: z.int(),
    limit: z.int(),
    total: z.int(),
    totalPages: z.int(),
  })
  .openapi("PageMeta");

const errorSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    }),
  })
  .openapi("ErrorResponse");

// ── Helpers goi envelope quanh moi response ──────────────────────────────────
// Moi response deu boc { success:true, data, meta? } — dung hop dong voi
// sendSuccess/errorHandler. Doc data tran la sai so voi cai client thuc nhan.
const ok = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.literal(true), data });

const okList = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ success: z.literal(true), data: z.array(item), meta: pageMetaSchema });

const jsonSchema = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});

const jsonBody = (schema: z.ZodTypeAny) => ({
  body: { content: { "application/json": { schema } }, required: true },
});

// Cac loi hay gap, tra dung errorSchema. Tra tung cai theo route thuc te co the
// sinh — khong liet ke bua.
const errRes = (description: string) => ({ description, ...jsonSchema(errorSchema) });
const E400 = { 400: errRes("Dữ liệu không hợp lệ (validation)") };
const E401 = { 401: errRes("Chưa đăng nhập / token sai") };
const E403 = { 403: errRes("Không đủ quyền (cần ADMIN)") };
const E404 = { 404: errRes("Không tìm thấy") };
const E409 = { 409: errRes("Xung đột (vd danh mục còn con/sản phẩm)") };

const bearer = { security: [{ bearerAuth: [] }] };

// ── AUTH ─────────────────────────────────────────────────────────────────────
registry.registerPath({
  method: "post",
  path: "/api/auth/register",
  tags: ["Auth"],
  summary: "Đăng ký tài khoản (gửi email xác thực)",
  request: jsonBody(registerSchema),
  responses: {
    201: { description: "Đăng ký thành công", ...jsonSchema(ok(messageSchema)) },
    ...E400,
    409: errRes("Email đã tồn tại"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["Auth"],
  summary: "Đăng nhập — trả accessToken; refreshToken đặt trong cookie httpOnly",
  request: jsonBody(loginSchema),
  responses: {
    200: {
      description: "Đăng nhập thành công (Set-Cookie: refreshToken)",
      ...jsonSchema(ok(z.object({ accessToken: z.string(), user: userSchema }))),
    },
    ...E401,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/verify-email",
  tags: ["Auth"],
  summary: "Xác thực email bằng token",
  request: jsonBody(verifyEmailSchema),
  responses: { 200: { description: "Đã xác thực", ...jsonSchema(ok(messageSchema)) }, ...E400 },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/refresh",
  tags: ["Auth"],
  summary: "Cấp accessToken mới từ refreshToken trong cookie (rotation)",
  responses: {
    200: { description: "Token mới", ...jsonSchema(ok(z.object({ accessToken: z.string() }))) },
    ...E401,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "Đăng xuất — thu hồi refreshToken và xóa cookie",
  responses: { 200: { description: "Đã đăng xuất", ...jsonSchema(ok(messageSchema)) } },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/forgot-password",
  tags: ["Auth"],
  summary: "Gửi email đặt lại mật khẩu (luôn 200 để không lộ email tồn tại)",
  request: jsonBody(forgotPasswordSchema),
  responses: { 200: { description: "Đã xử lý", ...jsonSchema(ok(messageSchema)) }, ...E400 },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/reset-password",
  tags: ["Auth"],
  summary: "Đặt lại mật khẩu bằng token",
  request: jsonBody(resetPasswordSchema),
  responses: { 200: { description: "Đã đổi mật khẩu", ...jsonSchema(ok(messageSchema)) }, ...E400 },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/change-password",
  tags: ["Auth"],
  ...bearer,
  summary: "Đổi mật khẩu (đang đăng nhập)",
  request: jsonBody(changePasswordSchema),
  responses: {
    200: { description: "Đã đổi mật khẩu", ...jsonSchema(ok(messageSchema)) },
    ...E400,
    ...E401,
  },
});

// ── CATEGORIES ───────────────────────────────────────────────────────────────
registry.registerPath({
  method: "get",
  path: "/api/categories",
  tags: ["Categories"],
  summary: "Cây danh mục (public)",
  responses: {
    200: { description: "Cây danh mục", ...jsonSchema(ok(z.array(categoryNodeSchema))) },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/categories",
  tags: ["Categories"],
  ...bearer,
  summary: "Tạo danh mục (ADMIN)",
  request: jsonBody(createCategorySchema),
  responses: {
    201: { description: "Đã tạo", ...jsonSchema(ok(categorySchema)) },
    ...E400,
    ...E401,
    ...E403,
    ...E404,
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/categories/{id}",
  tags: ["Categories"],
  ...bearer,
  summary: "Sửa danh mục (ADMIN) — đổi tên KHÔNG đổi slug",
  request: { params: categoryIdSchema, ...jsonBody(updateCategorySchema) },
  responses: {
    200: { description: "Đã cập nhật", ...jsonSchema(ok(categorySchema)) },
    ...E400,
    ...E401,
    ...E403,
    ...E404,
    ...E409,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/categories/{id}",
  tags: ["Categories"],
  ...bearer,
  summary: "Xóa danh mục (ADMIN) — 409 nếu còn con/sản phẩm",
  request: { params: categoryIdSchema },
  responses: {
    200: { description: "Đã xóa", ...jsonSchema(ok(messageSchema)) },
    ...E401,
    ...E403,
    ...E404,
    ...E409,
  },
});

// ── PRODUCTS ─────────────────────────────────────────────────────────────────
registry.registerPath({
  method: "get",
  path: "/api/products",
  tags: ["Products"],
  summary: "Danh sách sản phẩm (public) — filter/sort/pagination, có cache",
  request: { query: listProductQuerySchema },
  responses: { 200: { description: "Trang sản phẩm", ...jsonSchema(okList(productSchema)) } },
});

registry.registerPath({
  method: "get",
  path: "/api/products/admin",
  tags: ["Products"],
  ...bearer,
  summary: "Danh sách cho ADMIN — ?includeDeleted=true để thấy cả hàng đã xóa",
  request: { query: listProductQuerySchema },
  responses: {
    200: { description: "Trang sản phẩm (kèm deletedAt)", ...jsonSchema(okList(adminProductSchema)) },
    ...E401,
    ...E403,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/products/{slug}",
  tags: ["Products"],
  summary: "Chi tiết sản phẩm theo slug (public)",
  request: { params: productSlugSchema },
  responses: {
    200: { description: "Sản phẩm", ...jsonSchema(ok(productSchema)) },
    ...E404,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/products",
  tags: ["Products"],
  ...bearer,
  summary: "Tạo sản phẩm (ADMIN)",
  request: jsonBody(createProductSchema),
  responses: {
    201: { description: "Đã tạo", ...jsonSchema(ok(productSchema)) },
    ...E400,
    ...E401,
    ...E403,
    ...E404,
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/products/{id}",
  tags: ["Products"],
  ...bearer,
  summary: "Sửa sản phẩm (ADMIN)",
  request: { params: productIdSchema, ...jsonBody(updateProductSchema) },
  responses: {
    200: { description: "Đã cập nhật", ...jsonSchema(ok(productSchema)) },
    ...E400,
    ...E401,
    ...E403,
    ...E404,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/products/{id}",
  tags: ["Products"],
  ...bearer,
  summary: "Xóa mềm sản phẩm (ADMIN)",
  request: { params: productIdSchema },
  responses: {
    200: { description: "Đã xóa", ...jsonSchema(ok(messageSchema)) },
    ...E401,
    ...E403,
    ...E404,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/products/{id}/images",
  tags: ["Products"],
  ...bearer,
  summary: "Tải ảnh sản phẩm (ADMIN) — multipart, field 'image', ≤5MB, JPEG/PNG/WebP",
  request: {
    params: productIdSchema,
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            image: z.string().openapi({ type: "string", format: "binary" }),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: { description: "Đã tải ảnh", ...jsonSchema(ok(productImageSchema)) },
    ...E400,
    ...E401,
    ...E403,
    ...E404,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/products/{id}/images/{imageId}",
  tags: ["Products"],
  ...bearer,
  summary: "Xóa ảnh sản phẩm (ADMIN) — xóa Cloudinary trước, DB sau",
  request: { params: productImageParamsSchema },
  responses: {
    200: { description: "Đã xóa ảnh", ...jsonSchema(ok(messageSchema)) },
    ...E401,
    ...E403,
    ...E404,
  },
});

// ── Sinh tai lieu ────────────────────────────────────────────────────────────
export const openApiDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: "3.1.0",
  info: {
    title: "ShopLite API",
    version: "1.0.0",
    description:
      "API cho ShopLite (mini e-commerce). Mọi response bọc envelope " +
      "`{ success, data, meta? }`. Route ADMIN cần bearer JWT (nút Authorize).",
  },
  servers: [{ url: "http://localhost:3000", description: "Local dev" }],
});
