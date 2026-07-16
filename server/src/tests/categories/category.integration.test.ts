import { describe, it, expect, vi } from "vitest";
import { api } from "../helpers/request";
import { createLoggedInAdmin, createLoggedInUser } from "../helpers/auth";
import { prisma } from "../../lib/prisma";
import { redisConnection } from "../../lib/redis";

const TREE_KEY = "categories:tree";

/**
 * POST /api/categories voi quyen admin.
 *
 * KHONG `async`: phai tra thang chuoi supertest de goi tiep duoc `.expect(201)`.
 * Boc async vao la tra Promise → mat het method cua supertest.
 */
function createCategory(accessToken: string, body: { name: string; parentId?: string }) {
  return api
    .post("/api/categories")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("Categories — quyen truy cap", () => {
  it("GET / la public, khong can token", async () => {
    const res = await api.get("/api/categories").expect(200);

    expect(res.body).toEqual({ success: true, data: [] });
  });

  it("POST khong co token → 401", async () => {
    const res = await api.post("/api/categories").send({ name: "Áo" }).expect(401);

    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST bang user CUSTOMER → 403", async () => {
    const { accessToken } = await createLoggedInUser();

    const res = await createCategory(accessToken, { name: "Áo" }).expect(403);

    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("Categories — tao", () => {
  it("admin tao duoc, slug tu sinh bo dau tieng Viet", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const res = await createCategory(accessToken, { name: "Đồng Hồ" }).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: "Đồng Hồ", slug: "dong-ho", parentId: null });
  });

  it("ten trung → slug tu them hau to, khong vo unique constraint", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const first = await createCategory(accessToken, { name: "Áo" }).expect(201);
    const second = await createCategory(accessToken, { name: "Áo" }).expect(201);
    const third = await createCategory(accessToken, { name: "Áo" }).expect(201);

    expect([first.body.data.slug, second.body.data.slug, third.body.data.slug]).toEqual([
      "ao",
      "ao-2",
      "ao-3",
    ]);
  });

  it("ten khong co ky tu latin nao → 400 chu khong phai slug rong", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const res = await createCategory(accessToken, { name: "!!!" }).expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("parentId khong ton tai → 404", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const res = await createCategory(accessToken, {
      name: "Áo",
      parentId: "00000000-0000-4000-8000-000000000000",
    }).expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("khong cho cay sau qua 2 cap", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const parent = await createCategory(accessToken, { name: "Thời trang" }).expect(201);
    const child = await createCategory(accessToken, {
      name: "Áo",
      parentId: parent.body.data.id,
    }).expect(201);

    const res = await createCategory(accessToken, {
      name: "Áo thun",
      parentId: child.body.data.id,
    }).expect(400);

    expect(res.body.error.code).toBe("MAX_DEPTH_EXCEEDED");
  });

  it("slug cua category da soft-delete van bi chiem → ten trung phai ra hau to", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const first = await createCategory(accessToken, { name: "Áo" }).expect(201);

    await api
      .delete(`/api/categories/${first.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Cot slug @unique khong quan tam deletedAt — slug "ao" van nam do.
    const second = await createCategory(accessToken, { name: "Áo" }).expect(201);

    expect(second.body.data.slug).toBe("ao-2");
  });
});

describe("Categories — cay", () => {
  it("GET / tra cay long 2 cap", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const parent = await createCategory(accessToken, { name: "Thời trang" }).expect(201);
    await createCategory(accessToken, { name: "Áo", parentId: parent.body.data.id }).expect(201);
    await createCategory(accessToken, { name: "Quần", parentId: parent.body.data.id }).expect(201);

    const res = await api.get("/api/categories").expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ name: "Thời trang", slug: "thoi-trang" });
    expect(res.body.data[0].children.map((c: any) => c.name)).toEqual(["Quần", "Áo"]);
  });

  it("category da soft-delete bien khoi cay", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const c = await createCategory(accessToken, { name: "Áo" }).expect(201);

    await api
      .delete(`/api/categories/${c.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const res = await api.get("/api/categories").expect(200);

    expect(res.body.data).toEqual([]);
  });
});

describe("Categories — cache", () => {
  it("lan 1 miss va ghi cache, lan 2 hit", async () => {
    const { accessToken } = await createLoggedInAdmin();
    await createCategory(accessToken, { name: "Áo" }).expect(201);

    expect(await redisConnection.get(TREE_KEY)).toBeNull();

    await api.get("/api/categories").expect(200);

    expect(await redisConnection.get(TREE_KEY)).not.toBeNull();
  });

  it("lan 2 doc TU CACHE chu khong tu DB", async () => {
    await api.get("/api/categories").expect(200); // lan 1: miss → ghi cache

    // Doi thang gia tri trong Redis sang mot thu KHONG the co trong DB.
    // Lan 2 ma van tra ra cai nay → chac chan no doc cache, khong query DB.
    await redisConnection.set(
      TREE_KEY,
      JSON.stringify([{ id: "fake-id", name: "TỪ CACHE", slug: "tu-cache", children: [] }]),
    );

    const res = await api.get("/api/categories").expect(200);

    expect(res.body.data[0].name).toBe("TỪ CACHE");
  });

  it("tao category → cache bi xoa", async () => {
    const { accessToken } = await createLoggedInAdmin();

    await api.get("/api/categories").expect(200);
    expect(await redisConnection.get(TREE_KEY)).not.toBeNull();

    await createCategory(accessToken, { name: "Áo" }).expect(201);

    expect(await redisConnection.get(TREE_KEY)).toBeNull();
  });

  it("sua category → cache bi xoa", async () => {
    const { accessToken } = await createLoggedInAdmin();
    const c = await createCategory(accessToken, { name: "Áo" }).expect(201);

    await api.get("/api/categories").expect(200);
    expect(await redisConnection.get(TREE_KEY)).not.toBeNull();

    await api
      .patch(`/api/categories/${c.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Áo khoác" })
      .expect(200);

    expect(await redisConnection.get(TREE_KEY)).toBeNull();
  });

  it("xoa category → cache bi xoa", async () => {
    const { accessToken } = await createLoggedInAdmin();
    const c = await createCategory(accessToken, { name: "Áo" }).expect(201);

    await api.get("/api/categories").expect(200);
    expect(await redisConnection.get(TREE_KEY)).not.toBeNull();

    await api
      .delete(`/api/categories/${c.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(await redisConnection.get(TREE_KEY)).toBeNull();
  });

  it("cache co TTL — khong bao gio ban vinh vien", async () => {
    await api.get("/api/categories").expect(200);

    const ttl = await redisConnection.ttl(TREE_KEY);

    // -1 = key khong co TTL (song mai), -2 = key khong ton tai. Ca hai deu la bug.
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(5 * 60);
  });

  it("Redis chet khi DOC → van tra du lieu tu DB (fail-open)", async () => {
    const { accessToken } = await createLoggedInAdmin();
    await createCategory(accessToken, { name: "Áo" }).expect(201);

    const spy = vi
      .spyOn(redisConnection, "get")
      .mockRejectedValueOnce(new Error("redis down"));

    try {
      const res = await api.get("/api/categories").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data[0].name).toBe("Áo");
    } finally {
      spy.mockRestore();
    }
  });

  it("Redis chet khi GHI cache → request van thanh cong", async () => {
    const spy = vi
      .spyOn(redisConnection, "setex")
      .mockRejectedValueOnce(new Error("redis down"));

    try {
      await api.get("/api/categories").expect(200);
    } finally {
      spy.mockRestore();
    }
  });

  it("Redis chet khi INVALIDATE → write van thanh cong (TTL se don sau)", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const spy = vi.spyOn(redisConnection, "del").mockRejectedValueOnce(new Error("redis down"));

    try {
      await createCategory(accessToken, { name: "Áo" }).expect(201);
    } finally {
      spy.mockRestore();
    }

    // DB van phai co that — cache hong khong duoc keo theo write.
    const row = await prisma.category.findUnique({ where: { slug: "ao" } });
    expect(row).not.toBeNull();
  });
});

describe("Categories — sua", () => {
  it("doi ten KHONG doi slug (slug da nam trong URL nguoi ta luu)", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const c = await createCategory(accessToken, { name: "Áo" }).expect(201);

    const res = await api
      .patch(`/api/categories/${c.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Áo khoác" })
      .expect(200);

    expect(res.body.data).toMatchObject({ name: "Áo khoác", slug: "ao" });
  });

  it("tu lam cha cua chinh minh → 400", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const c = await createCategory(accessToken, { name: "Áo" }).expect(201);

    const res = await api
      .patch(`/api/categories/${c.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ parentId: c.body.data.id })
      .expect(400);

    expect(res.body.error.code).toBe("INVALID_PARENT");
  });

  it("category dang co con ma bi gan cha → 400 (cay se thanh 3 cap)", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const a = await createCategory(accessToken, { name: "Thời trang" }).expect(201);
    await createCategory(accessToken, { name: "Áo", parentId: a.body.data.id }).expect(201);
    const b = await createCategory(accessToken, { name: "Điện tử" }).expect(201);

    const res = await api
      .patch(`/api/categories/${a.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ parentId: b.body.data.id })
      .expect(400);

    expect(res.body.error.code).toBe("MAX_DEPTH_EXCEEDED");
  });

  it("id khong phai uuid → 400", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const res = await api
      .patch("/api/categories/khong-phai-uuid")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Áo" })
      .expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Categories — xoa", () => {
  it("xoa la soft delete, row van con trong DB", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const c = await createCategory(accessToken, { name: "Áo" }).expect(201);

    await api
      .delete(`/api/categories/${c.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const row = await prisma.category.findUnique({ where: { id: c.body.data.id } });

    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it("con danh muc con → 409", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const parent = await createCategory(accessToken, { name: "Thời trang" }).expect(201);
    await createCategory(accessToken, { name: "Áo", parentId: parent.body.data.id }).expect(201);

    const res = await api
      .delete(`/api/categories/${parent.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);

    expect(res.body.error.code).toBe("CATEGORY_NOT_EMPTY");
  });

  it("con san pham → 409", async () => {
    const { accessToken } = await createLoggedInAdmin();

    const c = await createCategory(accessToken, { name: "Áo" }).expect(201);

    await prisma.product.create({
      data: {
        categoryId: c.body.data.id,
        name: "Áo thun trắng",
        slug: "ao-thun-trang",
        price: "199000",
        stock: 10,
      },
    });

    const res = await api
      .delete(`/api/categories/${c.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);

    expect(res.body.error.code).toBe("CATEGORY_NOT_EMPTY");
  });
});
