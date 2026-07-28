import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../../config/env";
import { StringValue } from "ms";
import crypto, { randomBytes } from "crypto";

export interface TokenPayload extends JwtPayload {
  sub: string;
  role?: string;
  verified?: boolean;
}

export function generateAccessToken(payload: object) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

/**
 * Chuoi NGAU NHIEN, khong phai JWT: refresh token luon phai tra DB (de biet da bi
 * revoke chua) nen tinh self-contained cua JWT khong dung vao viec gi.
 *
 * Va JWT o day con SAI: `jwt.sign({sub})` cho cung user trong cung mot giay sinh
 * chuoi y het nhau (iat chi phan giai theo giay) → tokenHash trung → vo unique
 * constraint. Login 2 lan lien tiep la du hong.
 */
export function generateRefreshToken() {
  return randomBytes(64).toString("hex");
}

/** Token verify email / reset password: cung ly do, cung cach — random, khong JWT. */
export function generateEmailToken() {
  return randomBytes(32).toString("hex");
}

/**
 * DB chi luu hash — lo DB thi token trong do van vo dung. SHA-256 (khong phai
 * bcrypt) la du: token da co 256+ bit entropy nen khong brute force duoc, va lookup
 * phai nhanh vi moi lan refresh deu goi.
 */
export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
