"use client";

/**
 * Convex client provider. Reads the deployment URL from NEXT_PUBLIC_CONVEX_URL
 * (set per Vercel project / .env.local). All reactive `useQuery` calls in the
 * app stream through this single client.
 */

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

const client = url ? new ConvexReactClient(url) : null;

export function Providers({ children }: { children: ReactNode }) {
  if (!client) {
    return (
      <div className="missing-env">
        <p>
          <strong>NEXT_PUBLIC_CONVEX_URL is not set.</strong> Run{" "}
          <code>npx convex dev</code> and add the deployment URL to{" "}
          <code>.env.local</code> to connect the app to the backend.
        </p>
      </div>
    );
  }
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
