/**
 * Charity Cloud — vitest config.
 *
 * edge-runtime environment because convex-test mirrors the Convex server
 * runtime; pure-TS tests (geo, taxonomy) run fine in it too.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["tests/**/*.test.ts"],
  },
});
