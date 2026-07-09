import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../../config/env";
import { StringValue } from "ms";
import crypto, { randomUUID, randomBytes } from "crypto";

export interface TokenPayload extends JwtPayload {
  sub: string;
  role?: string;
}

export function generateAccessToken(payload: object) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue,
  });
}

export function generateRefreshToken(payload: object) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as StringValue,
  });
}

export function generateEmailToken(payload: object) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: "24h",
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

