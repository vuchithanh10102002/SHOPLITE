import { beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";

/**
 * CHOT AN TOAN. beforeEach duoi day xoa sach moi bang. Neu vi mot ly do nao do
 * process nay tro vao DB dev (thieu .env.test, vitest.config sai...) thi no se
 * xoa sach du lieu seed cua anh ma khong bao mot cau.
 * Tha fail ca suite con hon mat DB.
 */
const dbUrl = process.env.DATABASE_URL ?? "";

if (process.env.NODE_ENV !== "test" || !/test/i.test(dbUrl)) {
  throw new Error(
    `Test phải chạy trên DB test. NODE_ENV=${process.env.NODE_ENV}, DATABASE_URL=${dbUrl}`
  );
}

/**
 * Mock email queue: test khong can Redis/BullMQ that, va quan trong hon — day la
 * cach DUY NHAT lay duoc token verify/reset o dang plaintext. DB chi luu sha256(token),
 * khong dao nguoc duoc; token that chi ton tai trong payload gui qua queue.
 */
vi.mock("../lib/queue", () => ({
  EMAIL_QUEUE_NAME: "email",
  emailQueue: {
    add: vi.fn(async () => ({ id: "test-job" })),
    close: vi.fn(async () => undefined),
  },
}));

beforeEach(async () => {
  // Thu tu xoa theo chieu phu thuoc khoa ngoai: con truoc, cha sau.
  await prisma.orderItem.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();

  await prisma.emailToken.deleteMany();
  await prisma.refreshToken.deleteMany();

  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();

  // Product/Category: phai xoa SAU orderItem + cartItem (hai bang do tro toi
  // product), va con truoc cha — image → product → category, category con truoc
  // category cha (self-relation CategoryTree khong cascade).
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();

  await prisma.user.deleteMany();

  // Xoa counter rate limit — khong co dong nay, test thu 3 se an 429 vi
  // counter cua test 1 va 2 van con song trong cua so 60s.
  await redisConnection.flushdb();

  // Reset mock.calls cua emailQueue.add giua cac test.
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redisConnection.quit();
});
