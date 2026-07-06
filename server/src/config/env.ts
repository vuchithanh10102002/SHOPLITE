import "dotenv/config";
import { z } from 'zod';


const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLOUDINARY_URL: z.string(),
  SMTP_URL: z.string(),
  CLIENT_URL: z.string().url(),
  PAYMENT_FAIL_RATE: z.coerce.number().min(0).max(1).default(0.2),
});
export const env = envSchema.parse(process.env); // throw → process chet → dung y do