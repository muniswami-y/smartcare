import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    env: {
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/caresmart?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'caresmart_jwt_access_secret_key_minimum_32_chars_1234',
      JWT_REFRESH_SECRET: 'caresmart_jwt_refresh_secret_key_minimum_32_chars_5678',
      FIELD_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      PHONE_HASH_KEY: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      PORT: '4000',
      NODE_ENV: 'test'
    }
  }
});
