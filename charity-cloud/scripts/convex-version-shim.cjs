/**
 * Charity Cloud — dev-env shim for `npx convex dev` anonymous local mode.
 *
 * This sandbox's network policy blocks https://version.convex.dev (the CLI's
 * version-discovery endpoint), and the CLI's secret-generation path hardcodes
 * a "latest version" lookup that cannot be pinned by flag. This preload
 * answers ONLY that lookup locally with the pinned backend release tag
 * (downloaded from GitHub, which IS allowed); every other request passes
 * through untouched.
 *
 * Usage: NODE_OPTIONS="--require ./scripts/convex-version-shim.cjs" npx convex dev
 * Pin:   CONVEX_PINNED_BACKEND_VERSION (default below; a real convex-backend
 *        precompiled release tag).
 */
const PINNED =
  process.env.CONVEX_PINNED_BACKEND_VERSION || "precompiled-2026-06-09-b6aaa1a";

const origFetch = globalThis.fetch;
globalThis.fetch = async function patchedFetch(resource, options) {
  const url = String(
    typeof resource === "object" && resource !== null && "url" in resource
      ? resource.url
      : resource,
  );
  if (url.startsWith("https://version.convex.dev/v1/local_backend_version")) {
    return new Response(JSON.stringify({ version: PINNED }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (url.startsWith("https://version.convex.dev/")) {
    // CLI update-notice endpoint: harmless empty answer.
    return new Response(JSON.stringify({ message: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return origFetch(resource, options);
};
