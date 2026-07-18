import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser } from "../helpers/auth";
import { prisma } from "../../lib/prisma";
import { cloudinary } from "../../lib/cloudinary"; // da mock o setup.ts

/**
 * KHONG `async`: tra thang chuoi supertest de goi tiep `.expect(...)`.
 * Boc async vao la tra Promise → mat het method cua supertest.
 */
function createProduct(
  accessToken: string,
  body: Record<string, unknown>,
) {
  return api
    .post("/api/products")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

/** Product PHAI thuoc mot category → tao san mot category qua API va tra id. */
async function seedCategory(accessToken: string, name = "Thời trang"): Promise<string> {
  const res = await api
    .post("/api/categories")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name })
    .expect(201);

  return res.body.data.id;
}

/** Body product day du hop le — test chi override cai no quan tam. */
function validBody(categoryId: string, over: Record<string, unknown> = {}) {
  return {
    name: "Áo thun trắng",
    categoryId,
    price: 199000,
    stock: 10,
    description: "Áo cotton",
    ...over,
  };
}

describe("Products — quyen truy cap", () => {
  it("GET / la public, khong can token", async () => {
    const res = await api.get("/api/products").expect(200);

    expect(res.body).toMatchObject({ success: true, data: [] });
    expect(res.body.meta).toMatchObject({ page: 1, total: 0, totalPages: 0 });
  });

  it("POST khong co token → 401", async () => {
    const res = await api.post("/api/products").send({ name: "Áo" }).expect(401);

    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST bang CUSTOMER → 403", async () => {
    const { accessToken } = await createLoggedInUser();

    const res = await createProduct(accessToken, { name: "Áo" }).expect(403);

    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("Products — tao", () => {
  let adminToken: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    categoryId = await seedCategory(adminToken);
  });

  it("admin tao duoc, slug tu sinh bo dau, KHONG lo `stock` ra ngoai", async () => {
    const res = await createProduct(adminToken, validBody(categoryId)).expect(201);

    expect(res.body.data).toMatchObject({
      name: "Áo thun trắng",
      slug: "ao-thun-trang",
      price: "199000",
      stockStatus: "in_stock",
      category: { id: categoryId, name: "Thời trang" },
    });
    // stock la thong tin noi bo — public API KHONG duoc thay con so ton kho.
    expect(res.body.data).not.toHaveProperty("stock");
  });

  it("price tra ve la string chu khong phai number (Prisma Decimal)", async () => {
    const res = await createProduct(adminToken, validBody(categoryId, { price: 50000 })).expect(201);

    expect(typeof res.body.data.price).toBe("string");
    expect(res.body.data.price).toBe("50000");
  });

  it("stockStatus theo nguong: 0 = out, <=5 = low, >5 = in_stock", async () => {
    const out = await createProduct(adminToken, validBody(categoryId, { name: "Áo A", stock: 0 }));
    const low = await createProduct(adminToken, validBody(categoryId, { name: "Áo B", stock: 3 }));
    const inS = await createProduct(adminToken, validBody(categoryId, { name: "Áo C", stock: 20 }));

    expect(out.body.data.stockStatus).toBe("out");
    expect(low.body.data.stockStatus).toBe("low");
    expect(inS.body.data.stockStatus).toBe("in_stock");
  });

  it("ten trung → slug tu them hau to", async () => {
    const a = await createProduct(adminToken, validBody(categoryId, { name: "Áo" })).expect(201);
    const b = await createProduct(adminToken, validBody(categoryId, { name: "Áo" })).expect(201);

    expect([a.body.data.slug, b.body.data.slug]).toEqual(["ao", "ao-2"]);
  });

  it("categoryId khong ton tai → 404", async () => {
    const res = await createProduct(
      adminToken,
      validBody("00000000-0000-4000-8000-000000000000"),
    ).expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("gia <= 0 → 400", async () => {
    const res = await createProduct(adminToken, validBody(categoryId, { price: 0 })).expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("gia qua 2 chu so thap phan → 400", async () => {
    const res = await createProduct(adminToken, validBody(categoryId, { price: 10.999 })).expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("stock am → 400", async () => {
    const res = await createProduct(adminToken, validBody(categoryId, { stock: -1 })).expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Products — GET /:slug", () => {
  let adminToken: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    categoryId = await seedCategory(adminToken);
  });

  it("tra product theo slug, public, khong lo stock", async () => {
    await createProduct(adminToken, validBody(categoryId)).expect(201);

    const res = await api.get("/api/products/ao-thun-trang").expect(200);

    expect(res.body.data).toMatchObject({ slug: "ao-thun-trang", stockStatus: "in_stock" });
    expect(res.body.data).not.toHaveProperty("stock");
  });

  it("slug khong ton tai → 404", async () => {
    const res = await api.get("/api/products/khong-co-that").expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("slug sai dinh dang (chu hoa) → 400", async () => {
    const res = await api.get("/api/products/Ao-Thun").expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("product da soft-delete → 404 (bien khoi public)", async () => {
    const created = await createProduct(adminToken, validBody(categoryId)).expect(201);

    await api
      .delete(`/api/products/${created.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    await api.get("/api/products/ao-thun-trang").expect(404);
  });
});

describe("Products — list filter/sort/pagination", () => {
  let adminToken: string;
  let catA: string;
  let catB: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    catA = await seedCategory(adminToken, "Thời trang");
    catB = await seedCategory(adminToken, "Điện tử");

    await createProduct(adminToken, validBody(catA, { name: "Áo khoác", price: 300000, stock: 10 }));
    await createProduct(adminToken, validBody(catA, { name: "Áo thun", price: 100000, stock: 10 }));
    await createProduct(adminToken, validBody(catB, { name: "Tai nghe", price: 200000, stock: 10 }));
  });

  it("search bo dau: q=ao khop 'Áo ...' (tim tren cot nameNormalized)", async () => {
    const res = await api.get("/api/products?q=ao").expect(200);

    const names = res.body.data.map((p: any) => p.name).sort();
    expect(names).toEqual(["Áo khoác", "Áo thun"]);
    expect(res.body.meta.total).toBe(2);
  });

  it("loc theo categoryId", async () => {
    const res = await api.get(`/api/products?categoryId=${catB}`).expect(200);

    expect(res.body.data.map((p: any) => p.name)).toEqual(["Tai nghe"]);
  });

  it("loc khoang gia [150000, 250000]", async () => {
    const res = await api.get("/api/products?minPrice=150000&maxPrice=250000").expect(200);

    expect(res.body.data.map((p: any) => p.name)).toEqual(["Tai nghe"]);
  });

  it("sort=price_asc", async () => {
    const res = await api.get("/api/products?sort=price_asc").expect(200);

    expect(res.body.data.map((p: any) => p.price)).toEqual(["100000", "200000", "300000"]);
  });

  it("sort=price_desc", async () => {
    const res = await api.get("/api/products?sort=price_desc").expect(200);

    expect(res.body.data.map((p: any) => p.price)).toEqual(["300000", "200000", "100000"]);
  });

  it("phan trang: limit=2 → trang 1 co 2, meta.totalPages=2", async () => {
    const res = await api.get("/api/products?limit=2&page=1").expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });

  it("trang vuot so trang → data rong + meta dung, KHONG phai 404", async () => {
    const res = await api.get("/api/products?page=999").expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(3);
  });

  it("limit vuot 50 → clamp 50, khong phai 400", async () => {
    const res = await api.get("/api/products?limit=999").expect(200);

    expect(res.body.meta.limit).toBe(50);
  });

  it("minPrice > maxPrice → 400", async () => {
    const res = await api.get("/api/products?minPrice=500000&maxPrice=100000").expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Products — sua", () => {
  let adminToken: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    categoryId = await seedCategory(adminToken);
  });

  function patch(id: string, body: Record<string, unknown>) {
    return api
      .patch(`/api/products/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);
  }

  it("doi ten KHONG doi slug, va van tim ra bang search theo ten moi", async () => {
    const created = await createProduct(adminToken, validBody(categoryId, { name: "Áo" })).expect(201);

    const res = await patch(created.body.data.id, { name: "Quần jean" }).expect(200);

    // Ten doi, slug giu (slug da nam trong URL nguoi ta luu).
    expect(res.body.data).toMatchObject({ name: "Quần jean", slug: "ao" });

    // nameNormalized phai duoc cap nhat cung name → search "quan" ra ket qua.
    const found = await api.get("/api/products?q=quan").expect(200);
    expect(found.body.data.map((p: any) => p.name)).toEqual(["Quần jean"]);
  });

  it("gui description=null → xoa mo ta (phan biet voi undefined)", async () => {
    const created = await createProduct(adminToken, validBody(categoryId)).expect(201);

    const res = await patch(created.body.data.id, { description: null }).expect(200);

    expect(res.body.data.description).toBeNull();
  });

  it("doi categoryId sang category khong ton tai → 404", async () => {
    const created = await createProduct(adminToken, validBody(categoryId)).expect(201);

    const res = await patch(created.body.data.id, {
      categoryId: "00000000-0000-4000-8000-000000000000",
    }).expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("body rong → 400 (phai co it nhat mot truong)", async () => {
    const created = await createProduct(adminToken, validBody(categoryId)).expect(201);

    const res = await patch(created.body.data.id, {}).expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("id khong phai uuid → 400", async () => {
    const res = await patch("khong-phai-uuid", { stock: 5 }).expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("sua product khong ton tai → 404", async () => {
    const res = await patch("00000000-0000-4000-8000-000000000000", { stock: 5 }).expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Products — xoa", () => {
  let adminToken: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    categoryId = await seedCategory(adminToken);
  });

  it("xoa la soft delete: row van con trong DB, deletedAt duoc set", async () => {
    const created = await createProduct(adminToken, validBody(categoryId)).expect(201);

    await api
      .delete(`/api/products/${created.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const row = await prisma.product.findUnique({ where: { id: created.body.data.id } });
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it("sau khi xoa → bien khoi public list", async () => {
    const created = await createProduct(adminToken, validBody(categoryId)).expect(201);

    await api
      .delete(`/api/products/${created.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const res = await api.get("/api/products").expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("xoa product khong ton tai → 404", async () => {
    const res = await api
      .delete("/api/products/00000000-0000-4000-8000-000000000000")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Products — cache (version key)", () => {
  let adminToken: string;
  let categoryId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    categoryId = await seedCategory(adminToken);
  });

  // Chien luoc chung: sua THANG DB bang prisma (khong qua service → version
  // KHONG bi bump). Neu route van tra du lieu CU thi no dang phuc vu tu cache —
  // bang chung hanh vi cua mot cache hit, khoi phai soi log. Roi sua LAI qua API
  // (co bumpVersion) → route tra du lieu moi → bang chung version da invalidate.

  it("list: lan 2 phuc vu tu cache (sua len DB khong lam doi ket qua)", async () => {
    await createProduct(adminToken, validBody(categoryId, { name: "Áo" })).expect(201);

    const first = await api.get("/api/products").expect(200);
    expect(first.body.data.map((p: any) => p.name)).toEqual(["Áo"]);

    // Sua len DB, khong bump version.
    await prisma.product.updateMany({ data: { name: "Áo sửa lén" } });

    const second = await api.get("/api/products").expect(200);
    expect(second.body.data.map((p: any) => p.name)).toEqual(["Áo"]); // van la ban cache
  });

  it("sua qua API → version tang → list lan sau la cache miss, thay du lieu moi", async () => {
    const created = await createProduct(adminToken, validBody(categoryId, { name: "Áo" })).expect(201);

    await api.get("/api/products").expect(200); // nap cache duoi version cu

    await api
      .patch(`/api/products/${created.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Quần" })
      .expect(200);

    const after = await api.get("/api/products").expect(200);
    expect(after.body.data.map((p: any) => p.name)).toEqual(["Quần"]);
  });

  it("getBySlug cung duoc cache va cung bi version bump lam moi", async () => {
    await createProduct(adminToken, validBody(categoryId, { name: "Áo" })).expect(201);

    const first = await api.get("/api/products/ao").expect(200);
    expect(first.body.data.price).toBe("199000");

    // Sua len DB → detail van serve ban cache.
    await prisma.product.updateMany({ data: { price: 500000 } });
    const cached = await api.get("/api/products/ao").expect(200);
    expect(cached.body.data.price).toBe("199000");

    // Sua qua API → bumpVersion → detail lam moi.
    const row = await prisma.product.findFirst({ where: { slug: "ao" } });
    await api
      .patch(`/api/products/${row!.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ price: 250000 })
      .expect(200);

    const fresh = await api.get("/api/products/ao").expect(200);
    expect(fresh.body.data.price).toBe("250000");
  });

  it("them san pham moi → version tang → list cu khong con che giau hang moi", async () => {
    await createProduct(adminToken, validBody(categoryId, { name: "Áo" })).expect(201);
    await api.get("/api/products").expect(200); // nap cache 1 san pham

    await createProduct(adminToken, validBody(categoryId, { name: "Quần" })).expect(201);

    const res = await api.get("/api/products").expect(200);
    expect(res.body.meta.total).toBe(2);
  });
});

// PNG signature 8 byte — du de assertRealImage nhan la anh that.
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Buffer bat dau bang PNG signature, don len `sizeBytes` bang byte 0. */
function pngBuffer(sizeBytes = PNG_SIG.length): Buffer {
  if (sizeBytes <= PNG_SIG.length) return PNG_SIG;
  return Buffer.concat([PNG_SIG, Buffer.alloc(sizeBytes - PNG_SIG.length)]);
}

describe("Products — upload anh", () => {
  let adminToken: string;
  let productId: string;

  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    const categoryId = await seedCategory(adminToken);
    const created = await createProduct(adminToken, validBody(categoryId)).expect(201);
    productId = created.body.data.id;
  });

  function upload(
    token: string,
    buffer: Buffer,
    filename = "anh.png",
    contentType = "image/png",
  ) {
    return api
      .post(`/api/products/${productId}/images`)
      .set("Authorization", `Bearer ${token}`)
      .attach("image", buffer, { filename, contentType });
  }

  it("admin upload PNG ~4MB → 201, anh hien trong GET, KHONG lo publicId", async () => {
    const res = await upload(adminToken, pngBuffer(4 * 1024 * 1024)).expect(201);

    expect(res.body.data).toMatchObject({ url: expect.any(String), sortOrder: 0 });
    expect(res.body.data).not.toHaveProperty("publicId");

    const detail = await api.get("/api/products/ao-thun-trang").expect(200);
    expect(detail.body.data.images).toHaveLength(1);
    expect(detail.body.data.images[0]).not.toHaveProperty("publicId");
  });

  it("anh > 5MB → 400 UPLOAD_ERROR (multer chan theo size)", async () => {
    const res = await upload(adminToken, pngBuffer(6 * 1024 * 1024)).expect(400);

    expect(res.body.error.code).toBe("UPLOAD_ERROR");
  });

  it("file .exe doi ten .png → 400 INVALID_IMAGE, KHONG cham Cloudinary", async () => {
    const fakeExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]); // "MZ" = header PE

    const res = await upload(adminToken, fakeExe, "virus.png").expect(400);

    expect(res.body.error.code).toBe("INVALID_IMAGE");
    // Magic bytes chan TRUOC khi stream len storage.
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });

  it("mimetype khong phai anh → 400 INVALID_IMAGE_TYPE (fileFilter chan som)", async () => {
    const res = await upload(adminToken, pngBuffer(), "note.txt", "text/plain").expect(400);

    expect(res.body.error.code).toBe("INVALID_IMAGE_TYPE");
  });

  it("khong gui field 'image' → 400 NO_FILE", async () => {
    const res = await api
      .post(`/api/products/${productId}/images`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.error.code).toBe("NO_FILE");
  });

  it("CUSTOMER upload → 403, KHONG doc buffer len Cloudinary", async () => {
    const { accessToken } = await createLoggedInUser();

    await upload(accessToken, pngBuffer()).expect(403);

    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });

  it("upload → version bump → detail cache lam moi (anh moi hien ngay)", async () => {
    await api.get("/api/products/ao-thun-trang").expect(200); // nap cache 0 anh

    await upload(adminToken, pngBuffer()).expect(201);

    const detail = await api.get("/api/products/ao-thun-trang").expect(200);
    expect(detail.body.data.images).toHaveLength(1);
  });

  it("xoa anh → destroy(publicId) goi TRUOC, roi row bien mat", async () => {
    const up = await upload(adminToken, pngBuffer()).expect(201);
    const imageId = up.body.data.id;

    await api
      .delete(`/api/products/${productId}/images/${imageId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("shoplite/products/mock");

    const row = await prisma.productImage.findUnique({ where: { id: imageId } });
    expect(row).toBeNull();
  });

  it("xoa anh khong ton tai → 404", async () => {
    const res = await api
      .delete(`/api/products/${productId}/images/00000000-0000-4000-8000-000000000000`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Products — admin xem hang da xoa (?includeDeleted)", () => {
  let adminToken: string;
  let liveId: string;
  let deletedId: string;

  // Hai san pham: mot con song, mot bi soft-delete qua API.
  beforeEach(async () => {
    ({ accessToken: adminToken } = await createLoggedInAdmin());
    const categoryId = await seedCategory(adminToken);

    const live = await createProduct(adminToken, validBody(categoryId, { name: "Áo còn bán" })).expect(201);
    liveId = live.body.data.id;

    const gone = await createProduct(adminToken, validBody(categoryId, { name: "Áo ngừng bán" })).expect(201);
    deletedId = gone.body.data.id;
    await api
      .delete(`/api/products/${deletedId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  const adminList = (query = "") =>
    api.get(`/api/products/admin${query}`).set("Authorization", `Bearer ${adminToken}`);

  it("public GET / → chi thay hang con song, hang xoa bien mat", async () => {
    const res = await api.get("/api/products").expect(200);

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([liveId]);
  });

  it("admin /admin?includeDeleted=true → thay CA hai, hang xoa co deletedAt", async () => {
    const res = await adminList("?includeDeleted=true").expect(200);

    expect(res.body.meta.total).toBe(2);
    const ids = res.body.data.map((p: { id: string }) => p.id);
    expect(ids).toContain(liveId);
    expect(ids).toContain(deletedId);

    const deleted = res.body.data.find((p: { id: string }) => p.id === deletedId);
    expect(deleted.deletedAt).not.toBeNull();
    const live = res.body.data.find((p: { id: string }) => p.id === liveId);
    expect(live.deletedAt).toBeNull();
  });

  it("admin /admin KHONG co flag → chi thay hang song (flag mac dinh false)", async () => {
    const res = await adminList().expect(200);

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([liveId]);
  });

  it("admin /admin?includeDeleted=false → van chi hang song (KHONG bi coerce nham thanh true)", async () => {
    const res = await adminList("?includeDeleted=false").expect(200);

    expect(res.body.meta.total).toBe(1);
  });

  it("khach khong token vao /admin → 401", async () => {
    const res = await api.get("/api/products/admin?includeDeleted=true").expect(401);

    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("CUSTOMER vao /admin → 403", async () => {
    const { accessToken } = await createLoggedInUser();

    const res = await api
      .get("/api/products/admin?includeDeleted=true")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);

    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("khach gui ?includeDeleted=true vao route PUBLIC → flag bi lo, van khong thay hang xoa", async () => {
    const res = await api.get("/api/products?includeDeleted=true").expect(200);

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([liveId]);
  });

  it("chong POISON: admin nap cache /admin TRUOC, khach GET / cung param van khong thay hang xoa", async () => {
    // Admin nap view "co hang xoa" vao cache truoc.
    await adminList("?includeDeleted=true").expect(200);

    // Khach hit route public — neu dung chung key se an phai cache admin.
    const res = await api.get("/api/products").expect(200);

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([liveId]);
  });
});
