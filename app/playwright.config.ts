import { defineConfig, devices } from '@playwright/test';

// Functional E2E + axe a11y. Starts a seeded API (e2e DB) and the Vite dev server
// (which proxies /api → :8080), then drives Chromium. PGPORT defaults to 5432 (CI
// postgres service); set PGPORT=54329 for a local cluster.
const PGPORT = process.env.PGPORT ?? '5432';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/e2e-server.mjs',
      url: 'http://localhost:8080/health',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { PGPORT },
    },
    {
      command: 'npm --workspace packages/web run dev',
      url: 'http://localhost:3001',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
