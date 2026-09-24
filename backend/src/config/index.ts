import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  FIELD_ENCRYPTION_KEY: z.string().length(64, 'FIELD_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)'),
  PHONE_HASH_KEY: z.string().length(64, 'PHONE_HASH_KEY must be a 64-char hex string (32 bytes)'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.string().default('false').transform((v) => v === 'true'),
  UPLOAD_DIR: z.string().default('./uploads'),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_sampleKeyId12345'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_test_sampleSecretKey67890'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('sample_webhook_secret_12345')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('CRITICAL: Environment validation failure:', parsed.error.format());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  UPLOAD_DIR_ABSOLUTE: path.resolve(process.cwd(), parsed.data.UPLOAD_DIR)
};
