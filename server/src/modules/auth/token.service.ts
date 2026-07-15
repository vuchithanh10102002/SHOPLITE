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
 * Refresh token la chuoi NGAU NHIEN, khong phai JWT.
 *
 * Vi sao khong JWT: refresh token luon phai tra DB (de biet no da bi revoke chua),
 * nen tinh self-contained cua JWT khong dung vao viec gi — chi to ra va lo payload.
 *
 * Va JWT o day con SAI: jwt.sign({sub}) voi cung user trong cung mot giay sinh ra
 * chuoi y het nhau (iat chi co do phan giai giay) → tokenHash trung → vo unique
 * constraint. Login 2 lan lien tiep la du hong.
 *
 * 64 byte ngau nhien: khong the doan, khong the trung.
 */
export function generateRefreshToken() {
  return randomBytes(64).toString("hex");
}

/** Token verify email / reset password: cung ly do, cung cach — random, khong JWT. */
export function generateEmailToken() {
  return randomBytes(32).toString("hex");
}

/**
 * DB chi luu hash. Lo DB thi token trong do van vo dung — cung nguyen tac voi password.
 * SHA-256 (khong phai bcrypt) la du: token da co 256+ bit entropy nen khong brute force duoc,
 * va lookup phai nhanh vi moi lan refresh deu goi.
 */
export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
