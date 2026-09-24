import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    env: {
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/caresmart?schema=public'
    }
  },
});
