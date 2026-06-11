"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function AuthNav() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (isLoading) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
        …
      </span>
    );
  }

  if (!isAuthenticated) {
    return (
      <a
        href="/sign-in"
        className="font-mono text-[10px] uppercase tracking-widest text-[var(--gold)] hover:underline"
      >
        Sign in
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--gold)]"
    >
      Sign out
    </button>
  );
}
