import { defineConfig } from 'vitest/config';

// Web unit tests are pure-logic (e.g. the offline queue) — no DOM needed.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
