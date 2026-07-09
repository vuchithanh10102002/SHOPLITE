import nodemailer from "nodemailer";
import { env } from "../config/env";

export const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
});

export async function sendVerifyEmail(
  email: string,
  fullName: string,
  token: string
) {
  const verifyUrl =
    `${env.CLIENT_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    to: email,
    subject: "Xác thực tài khoản ShopLite",
    html: `
      <h2>Xin chào ${fullName}</h2>

      <p>Cảm ơn bạn đã đăng ký ShopLite.</p>

      <p>
        <a href="${verifyUrl}">
          Xác thực tài khoản
        </a>
      </p>

      <p>Liên kết có hiệu lực trong 24 giờ.</p>
    `,
  }, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("Message sent: %s", info.messageId);
  });
}