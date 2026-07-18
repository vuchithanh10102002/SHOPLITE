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

/**
 * Mock Cloudinary: .env.test co CLOUDINARY_URL=dummy, khong goi mang that duoc,
 * va cung khong nen (Handbook 5.7: mock Cloudinary, KHONG mock DB).
 *
 * upload_stream that tra ve mot Writable; service bom buffer vao roi doi
 * callback. Mock giu dung hop dong do: tra Writable, khi buffer het (final) thi
 * goi callback voi secure_url/public_id gia. Test doc lai hai mock fn nay qua
 * `import { cloudinary }` de assert da/ chua duoc goi.
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
 * Mock CONG thanh toan (khong mock settlePayment — do la logic that can test).
 * Mac dinh: charge THANH CONG + TUC THI (bo sleep 200-800ms + bo random cua
 * PAYMENT_FAIL_RATE) → moi don trong test ket PAID xac dinh. Test duong that bai
 * override bang `(paymentProvider.charge as Mock).mockRejectedValueOnce(new
 * PaymentDeclinedError())`. Giu nguyen export con lai (PaymentDeclinedError that)
 * de instanceof trong settlePayment van dung.
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
