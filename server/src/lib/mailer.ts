import nodemailer from "nodemailer";
import { env } from "../config/env";
import logger from "./logger";
import type { RenderedEmail } from "../modules/emails/email.templates";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  // 465 = SMTPS (TLS ngay tu dau). 587/1025 = plain roi STARTTLS.
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/**
 * Gui mail — DUNG DANG PROMISE, tuyet doi khong truyen callback.
 *
 * Ban cu goi `transporter.sendMail(opts, callback)`: khi truyen callback,
 * nodemailer KHONG tra ve promise nua → `await` cua caller resolve ngay lap tuc,
 * va loi SMTP bi nuot trong callback (`console.log(error)` roi thoi).
 * Hau qua: worker luon bao job THANH CONG du email chua bao gio duoc gui →
 * attempts/backoff cua BullMQ vo dung, failed set vinh vien rong.
 *
 * Loi phai NEM RA NGOAI thi BullMQ moi biet duong retry. Do la toan bo giao keo
 * giua worker va queue.
 */
export async function sendMail(to: string, email: RenderedEmail) {
  const info = await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: email.subject,
    html: email.html,
  });

  logger.info({ to, subject: email.subject, messageId: info.messageId }, "email đã gửi");

  return info;
}
