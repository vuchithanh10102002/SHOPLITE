import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { UnrecoverableError, type Job } from "bullmq";
import { prisma } from "../../lib/prisma";
import { processEmailJob } from "../../workers/email.worker";
import { sendMail } from "../../lib/mailer";
import { normalizeText } from "../../shared/slugify";
import type { EmailJobData } from "../../modules/emails/email.types";

// Mock o tang mailer, KHONG mock nodemailer: test van chay qua template that
// (escape, format tien, URL) — do la phan de sai nhat, mock di thi test vo nghia.
vi.mock("../../lib/mailer", () => ({
  sendMail: vi.fn(async () => ({ messageId: "test" })),
}));

const sendMailMock = sendMail as Mock;

/** Job gia — chi giu dung nhung field ma processEmailJob doc toi. */
function fakeJob(name: string, data: unknown): Job<EmailJobData, void, string> {
  return {
    id: "job-1",
    name,
    data,
    attemptsMade: 0,
  } as unknown as Job<EmailJobData, void, string>;
}

/** Doi so cua lan goi sendMail gan nhat: [to, { subject, html }]. */
function lastMail() {
  const call = sendMailMock.mock.calls.at(-1);

  if (!call) throw new Error("sendMail chưa được gọi");

  return { to: call[0] as string, subject: call[1].subject as string, html: call[1].html as string };
}

beforeEach(() => {
  sendMailMock.mockClear();
  sendMailMock.mockResolvedValue({ messageId: "test" });
});

describe("processEmailJob — verify-email", () => {
  it("gửi mail chứa link verify kèm token", async () => {
    await processEmailJob(
      fakeJob("verify-email", {
        email: "a@test.local",
        fullName: "Nguyen Van A",
        token: "tok_abc123",
      })
    );

    const mail = lastMail();

    expect(mail.to).toBe("a@test.local");
    expect(mail.subject).toContain("Xác thực");
    expect(mail.html).toContain("/verify-email?token=tok_abc123");
    expect(mail.html).toContain("Nguyen Van A");
  });

  it("escape HTML trong fullName — không để user chèn thẻ vào email", async () => {
    await processEmailJob(
      fakeJob("verify-email", {
        email: "a@test.local",
        fullName: "<img src=x onerror=alert(1)>",
        token: "tok",
      })
    );

    const { html } = lastMail();

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });
});

describe("processEmailJob — reset-password", () => {
  it("gửi mail reset với link và token đúng", async () => {
    await processEmailJob(
      fakeJob("reset-password", {
        email: "b@test.local",
        fullName: "B",
        token: "reset_xyz",
      })
    );

    const mail = lastMail();

    expect(mail.subject).toContain("Đặt lại mật khẩu");
    expect(mail.html).toContain("/reset-password?token=reset_xyz");
  });
});

describe("processEmailJob — order-status", () => {
  async function seedOrder(status: "PAID" | "CANCELLED" = "PAID") {
    const user = await prisma.user.create({
      data: {
        email: `order${Date.now()}@test.local`,
        fullName: "Khách Hàng",
        passwordHash: "x",
        emailVerified: true,
      },
    });

    const category = await prisma.category.create({
      data: { name: "Cat", slug: `cat-${Date.now()}` },
    });

    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: "Bàn phím cơ",
        nameNormalized: normalizeText("Bàn phím cơ"),
        slug: `kb-${Date.now()}`,
        price: "1200000",
        stock: 10,
      },
    });

    return prisma.order.create({
      data: {
        userId: user.id,
        status,
        totalAmount: "2400000",
        idempotencyKey: `key-${Date.now()}`,
        shippingAddress: "Hà Nội",
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              unitPrice: "1200000",
              quantity: 2,
            },
          ],
        },
      },
    });
  }

  it("đọc order từ DB rồi gửi mail đúng trạng thái, đúng sản phẩm", async () => {
    const order = await seedOrder("PAID");

    await processEmailJob(fakeJob("order-status", { orderId: order.id }));

    const mail = lastMail();

    expect(mail.subject).toContain("Đã thanh toán");
    expect(mail.html).toContain("Bàn phím cơ");
    expect(mail.html).toContain("2.400.000");
  });

  it("order không tồn tại → UnrecoverableError, không retry vô ích", async () => {
    await expect(
      processEmailJob(
        fakeJob("order-status", {
          orderId: "00000000-0000-4000-8000-000000000000",
        })
      )
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe("processEmailJob — job hỏng thì không retry", () => {
  it("tên job lạ → UnrecoverableError", async () => {
    await expect(
      processEmailJob(fakeJob("send-sms", { email: "a@test.local" }))
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it("payload thiếu field → UnrecoverableError", async () => {
    await expect(
      processEmailJob(fakeJob("verify-email", { email: "a@test.local" }))
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe("processEmailJob — lỗi SMTP", () => {
  /**
   * Test canh cua BUG that: ban cu goi transporter.sendMail(opts, callback) →
   * nodemailer khong tra promise, loi bi nuot trong callback, job luon "thanh cong"
   * du email chua bao gio duoc gui → attempts/backoff cua BullMQ vo dung.
   * Loi PHAI noi len tren thi BullMQ moi retry.
   */
  it("lỗi SMTP phải ném ra ngoài để BullMQ retry, không được nuốt", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("SMTP 421 too many connections"));

    await expect(
      processEmailJob(
        fakeJob("verify-email", {
          email: "a@test.local",
          fullName: "A",
          token: "tok",
        })
      )
    ).rejects.toThrow("SMTP 421");
  });

  it("lỗi SMTP KHÔNG phải UnrecoverableError — job này đáng được thử lại", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("ECONNRESET"));

    await expect(
      processEmailJob(
        fakeJob("verify-email", {
          email: "a@test.local",
          fullName: "A",
          token: "tok",
        })
      )
    ).rejects.not.toBeInstanceOf(UnrecoverableError);
  });
});
