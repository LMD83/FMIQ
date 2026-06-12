/**
 * Next.js config for the VerifIQ app (the self-serve slice).
 *
 * The app source lives in `src/app/` and is typed by `tsconfig.app.json` (not the
 * backend's root `tsconfig.json`, which globs `*.ts` and excludes `src/app`). This
 * keeps backend CI (`tsc --noEmit`) untouched no matter what the app contains.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    tsconfigPath: "tsconfig.app.json",
  },
  // App Router lives at src/app — Next finds it automatically when there's a
  // `src/` directory. No `pages/` here.
};

export default nextConfig;
