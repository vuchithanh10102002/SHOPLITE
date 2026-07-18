import { describe, it, expect } from "vitest";
import { api } from "../helpers/request";
import { openApiDocument } from "../../docs/openapi";

/**
 * Test "hop dong tai lieu": khong soi tung field, chi chot vai bat bien de route
 * moi them ma quen doc thi do o day (DoD Phase 3: /api/docs render 15+ endpoint).
 */
describe("OpenAPI docs", () => {
  const paths = openApiDocument.paths ?? {};
  const ops: { method: string; path: string; op: Record<string, unknown> }[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(item as Record<string, unknown>)) {
      ops.push({ method, path, op: op as Record<string, unknown> });
    }
  }

  it("có ít nhất 15 endpoint (DoD)", () => {
    expect(ops.length).toBeGreaterThanOrEqual(15);
  });

  it("phủ đủ 3 domain: auth, categories, products", () => {
    const has = (p: string) => ops.some((o) => o.path === p);
    expect(has("/api/auth/login")).toBe(true);
    expect(has("/api/categories")).toBe(true);
    expect(has("/api/products")).toBe(true);
    expect(has("/api/products/admin")).toBe(true);
    expect(has("/api/products/{id}/images")).toBe(true);
  });

  it("mọi route ADMIN đều gắn bearer security (không lỡ để hở)", () => {
    // Các path chỉ ADMIN mới gọi được — phải khai security trong docs, nếu không
    // docs nói dối rằng gọi được khi chưa đăng nhập.
    const adminOps = ops.filter(
      (o) =>
        o.path === "/api/products/admin" ||
        (o.path.startsWith("/api/products") && o.method !== "get") ||
        (o.path.startsWith("/api/categories") && o.method !== "get"),
    );
    expect(adminOps.length).toBeGreaterThan(0);
    for (const o of adminOps) {
      expect(o.op.security, `${o.method} ${o.path} thiếu security`).toBeDefined();
    }
  });

  it("GET /api/docs/ render Swagger UI (200)", async () => {
    const res = await api.get("/api/docs/").expect(200);

    expect(res.text).toContain("swagger-ui");
  });
});
