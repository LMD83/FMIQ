import { defineConfig } from 'vitest/config';

// The pool reads DATABASE_URL at import; globalSetup creates this DB fresh each run.
const host = process.env.TEST_PGHOST ?? '127.0.0.1';
const port = process.env.TEST_PGPORT ?? '54329';
const db = process.env.TEST_PGDATABASE ?? 'fmiq_test';
const appUrl = process.env.TEST_DATABASE_URL ?? `postgresql://fmiq_app:fmiq_app@${host}:${port}/${db}`;

export default defineConfig({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    include: ['test/**/*.test.ts'],
    // One Postgres, shared across files — run files serially to keep state legible.
    fileParallelism: false,
    env: {
      DATABASE_URL: appUrl,
      DEV_NO_AUTH: 'true',
    },
    hookTimeout: 60_000,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/domain/gateEngine.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: { branches: 90 },
    },
  },
});
