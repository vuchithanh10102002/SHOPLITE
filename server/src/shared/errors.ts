export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,        // may doc: 'INSUFFICIENT_STOCK'
    message: string,            // nguoi doc
    public details?: unknown,   // vd: danh sach field loi
  ) { super(message); }
}
export const Errors = {
  unauthorized: () => new AppError(401, 'UNAUTHORIZED', 'Chưa đăng nhập hoặc token hết hạn'),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'Không có quyền thực hiện'),
  notFound: (what: string) => new AppError(404, 'NOT_FOUND', `Không tìm thấy ${what}`),
  insufficientStock: (name: string) =>
    new AppError(400, 'INSUFFICIENT_STOCK', `"${name}" không đủ hàng`),
  invalidTransition: (from: string, to: string) =>
    new AppError(409, 'INVALID_STATUS_TRANSITION', `Không thể chuyển ${from} → ${to}`),
};