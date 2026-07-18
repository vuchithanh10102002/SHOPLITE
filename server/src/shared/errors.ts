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
  emailNotVerified: () =>
    new AppError(403, 'EMAIL_NOT_VERIFIED', 'Vui lòng xác thực email trước khi thực hiện'),
  notFound: (what: string) => new AppError(404, 'NOT_FOUND', `Không tìm thấy ${what}`),
  badRequest: (message: string, code = 'BAD_REQUEST') => new AppError(400, code, message),
  conflict: (message: string, code = 'CONFLICT') => new AppError(409, code, message),
  invalidCredentials: () =>
    new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng'),
  emailExists: () => new AppError(409, 'EMAIL_EXISTS', 'Email đã tồn tại'),
  invalidToken: (message = 'Token không hợp lệ') =>
    new AppError(400, 'INVALID_TOKEN', message),
  tooManyRequests: (retryAfter: number) =>
    new AppError(429, 'TOO_MANY_REQUESTS',
      'Bạn đã gửi quá nhiều request. Vui lòng thử lại sau.', { retryAfter }),
  insufficientStock: (name: string) =>
    new AppError(400, 'INSUFFICIENT_STOCK', `"${name}" không đủ hàng`),
  invalidTransition: (from: string, to: string) =>
    new AppError(409, 'INVALID_STATUS_TRANSITION', `Không thể chuyển ${from} → ${to}`),
};