import { OrderStatus } from "@prisma/client";
import { env } from "../../config/env";

export interface RenderedEmail {
  subject: string;
  html: string;
}

/**
 * Escape truoc khi nhet vao HTML: fullName do user tu dat khi dang ky.
 * Ten kieu `<img src=x onerror=...>` ma noi thang vao template la XSS trong
 * hom thu nguoi nhan (va la duong de spam chen link vao mail mang ten minh).
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Khung chung: doi header/footer mot cho, ca 3 loai mail cung doi theo. */
function layout(heading: string, body: string): string {
  return `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">${heading}</h2>
      ${body}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
      <p style="font-size:12px;color:#666;margin:0">
        Email tự động từ ShopLite — vui lòng không trả lời email này.
      </p>
    </div>
  `;
}

function button(href: string, label: string): string {
  return `
    <p style="margin:20px 0">
      <a href="${href}"
         style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">
        ${label}
      </a>
    </p>
    <p style="font-size:12px;color:#666">
      Nút không bấm được? Dán liên kết này vào trình duyệt:<br />
      <span style="word-break:break-all">${href}</span>
    </p>
  `;
}

export function verifyEmailTemplate(fullName: string, token: string): RenderedEmail {
  // Token di trong URL: encode de ky tu dac biet khong lam vo query string.
  const url = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;

  return {
    subject: "Xác thực tài khoản ShopLite",
    html: layout(
      `Xin chào ${esc(fullName)}`,
      `
        <p>Cảm ơn bạn đã đăng ký ShopLite. Bấm nút bên dưới để xác thực tài khoản.</p>
        ${button(url, "Xác thực tài khoản")}
        <p style="font-size:13px;color:#666">Liên kết có hiệu lực trong <strong>24 giờ</strong>.</p>
      `
    ),
  };
}

export function resetPasswordTemplate(fullName: string, token: string): RenderedEmail {
  const url = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;

  return {
    subject: "Đặt lại mật khẩu ShopLite",
    html: layout(
      `Xin chào ${esc(fullName)}`,
      `
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
        ${button(url, "Đặt lại mật khẩu")}
        <p style="font-size:13px;color:#666">
          Liên kết có hiệu lực trong <strong>1 giờ</strong> và chỉ dùng được một lần.
        </p>
        <p style="font-size:13px;color:#666">
          Nếu bạn không yêu cầu điều này, hãy bỏ qua email — mật khẩu hiện tại vẫn an toàn.
        </p>
      `
    ),
  };
}

const STATUS_TEXT: Record<OrderStatus, { subject: string; line: string }> = {
  PENDING: {
    subject: "Đơn hàng đang chờ xử lý",
    line: "Đơn hàng của bạn đã được ghi nhận và đang chờ thanh toán.",
  },
  PAID: {
    subject: "Đã thanh toán thành công",
    line: "Chúng tôi đã nhận được thanh toán. Đơn hàng sẽ sớm được giao cho đơn vị vận chuyển.",
  },
  SHIPPED: {
    subject: "Đơn hàng đang được giao",
    line: "Đơn hàng đã rời kho và đang trên đường tới bạn.",
  },
  COMPLETED: {
    subject: "Đơn hàng đã hoàn tất",
    line: "Đơn hàng đã giao thành công. Cảm ơn bạn đã mua sắm tại ShopLite!",
  },
  CANCELLED: {
    subject: "Đơn hàng đã bị hủy",
    line: "Đơn hàng đã bị hủy. Nếu bạn đã thanh toán, khoản tiền sẽ được hoàn lại.",
  },
};

export interface OrderEmailData {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  fullName: string;
  items: { productName: string; quantity: number; unitPrice: string }[];
}

function formatVnd(amount: string): string {
  // Decimal cua Prisma khong phai number — ep qua Number chi de format hien thi,
  // KHONG bao gio de tinh toan tien (mat chinh xac o so lon).
  return `${Number(amount).toLocaleString("vi-VN")} ₫`;
}

export function orderStatusTemplate(order: OrderEmailData): RenderedEmail {
  const status = STATUS_TEXT[order.status];

  // Ma don hien thi cho nguoi doc: 8 ky tu dau cua uuid la du de doi chieu.
  const shortId = order.id.slice(0, 8).toUpperCase();

  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 0">${esc(item.productName)} × ${item.quantity}</td>
          <td style="padding:6px 0;text-align:right">${formatVnd(item.unitPrice)}</td>
        </tr>
      `
    )
    .join("");

  return {
    subject: `[ShopLite] ${status.subject} — đơn #${shortId}`,
    html: layout(
      `Xin chào ${esc(order.fullName)}`,
      `
        <p>${status.line}</p>
        <p style="margin:16px 0 8px"><strong>Đơn hàng #${shortId}</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${rows}
          <tr>
            <td style="padding:10px 0;border-top:1px solid #e5e5e5"><strong>Tổng cộng</strong></td>
            <td style="padding:10px 0;border-top:1px solid #e5e5e5;text-align:right">
              <strong>${formatVnd(order.totalAmount)}</strong>
            </td>
          </tr>
        </table>
        ${button(`${env.CLIENT_URL}/orders/${order.id}`, "Xem chi tiết đơn hàng")}
      `
    ),
  };
}
