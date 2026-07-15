import "dotenv/config";
import { z } from 'zod';


const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string(),
  JWT_REFRESH_EXPIRES_IN: z.string(),
  CLOUDINARY_URL: z.string(),
  SMTP_URL: z.string(),
  CLIENT_URL: z.string().url(),
  PAYMENT_FAIL_RATE: z.coerce.number().min(0).max(1).default(0.2),
  // 12 cho prod; test ha xuong 4 de suite khong cham (moi hash cost 12 ton ~250ms)
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string().default('ShopLite <no-reply@shoplite.dev>'),
});
export const env = envSchema.parse(process.env); // throw → process chet → dung y do