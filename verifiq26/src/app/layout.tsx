/**
 * App shell — atelier typography + the Convex provider + the locked disclaimer
 * footer on every page (spec 08).
 */

import type { Metadata } from "next";
import { Providers } from "./providers";
import { DISCLAIMER } from "./_lib/sample-pack";
import "./globals.css";

export const metadata: Metadata = {
  title: "VerifIQ — the pre-build read",
  description:
    "The pre-build compliance read. A ranked, source-quoted register of what to " +
    "read closely before you issue. Output is indicative; you verify locally.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="app-nav">
          <a className="wordmark" href="/">
            VerifIQ
          </a>
          <span className="nav-meta">the pre-build read · indicative, you verify locally</span>
        </header>
        <main className="app-main">
          <Providers>{children}</Providers>
        </main>
        <footer className="app-foot">
          <p className="disclaimer">{DISCLAIMER}</p>
          <p className="foot-meta">© MMXXVI · VerifIQ · GovIQ Ltd · Dublin</p>
        </footer>
      </body>
    </html>
  );
}
