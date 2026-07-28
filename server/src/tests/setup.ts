import { beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";

/**
 * CHOT AN TOAN: beforeEach duoi day xoa sach moi bang, nen neu process tro nham vao
 * DB dev (thieu .env.test, vitest.config sai...) thi mat sach du lieu ma khong bao
 * mot cau. Tha fail ca suite con hon mat DB.
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

/**
 * Mock Cloudinary (Handbook 5.7: mock Cloudinary, KHONG mock DB). Giu dung hop dong
 * cua upload_stream that: tra ve Writable, het buffer (final) thi goi callback voi
 * secure_url/public_id gia. Test assert da/chua goi qua `import { cloudinary }`.
 */
vi.mock("../lib/cloudinary", async () => {
  const { Writable } = await import("node:stream");

  const upload_stream = vi.fn(
    (_opts: unknown, cb: (err: unknown, res: unknown) => void) =>
      new Writable({
        write(_chunk, _enc, done) {
          done();
        },
        final(done) {
          cb(null, {
            secure_url:
              "https://res.cloudinary.com/demo/image/upload/shoplite/products/mock.png",
            public_id: "shoplite/products/mock",
          });
          done();
        },
      }),
  );

  const destroy = vi.fn(async () => ({ result: "ok" }));

  return { cloudinary: { uploader: { upload_stream, destroy } } };
});

/**
 * Mock CONG thanh toan, KHONG mock settlePayment (do la logic that can test). Mac
 * dinh charge thanh cong + tuc thi (bo sleep + bo random) → don trong test ket PAID
 * xac dinh; duong that bai override bang `mockRejectedValueOnce`. Giu nguyen export
 * con lai de `instanceof PaymentDeclinedError` trong settlePayment van dung.
 */
vi.mock("../modules/payments/payment.provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../modules/payments/payment.provider")>();
  return {
    ...actual,
    paymentProvider: { charge: vi.fn(async () => ({ txnId: "txn_test_ok" })) },
  };
});

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

  // SAU orderItem + cartItem (hai bang do tro toi product), va con truoc cha: image
  // → product → category, category con truoc category cha (self-relation khong cascade).
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();

  await prisma.user.deleteMany();

  // Xoa counter rate limit: khong co dong nay thi test thu 3 an 429 vi counter cua
  // test 1 va 2 van con song trong cua so 60s.
  await redisConnection.flushdb();

  // Xoa mock.calls nhung GIU implementation (khong phai resetAllMocks).
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redisConnection.quit();
});
