"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthFlow = "signIn" | "signUp";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [flow, setFlow] = useState<AuthFlow>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signIn("password", { email, password, flow });
      router.push("/projects/new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--gold)]">
        VerifIQ Atelier
      </p>
      <h1 className="mt-2 font-serif text-2xl uppercase tracking-widest">
        {flow === "signIn" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Access your project console with Convex Auth — email and password.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-[var(--gold)]/25 bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
          />
        </label>

        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Password
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-[var(--gold)]/25 bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full border border-[var(--gold)] px-4 py-3 font-mono text-xs uppercase tracking-widest text-[var(--gold)] transition hover:bg-[var(--gold)]/10 disabled:opacity-50"
        >
          {loading ? "Please wait…" : flow === "signIn" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setFlow(flow === "signIn" ? "signUp" : "signIn");
          setError(null);
        }}
        className="mt-6 text-center text-sm text-[var(--muted)] underline-offset-4 hover:text-[var(--gold)] hover:underline"
      >
        {flow === "signIn"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
