import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

/**
 * Email + password sign in / sign up (MVP; magic-link swap tracked in
 * the roadmap). Accessible: explicit labels, described errors, no
 * placeholder-as-label.
 */
export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-8 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        const formData = new FormData(e.currentTarget);
        formData.set("flow", flow);
        void signIn("password", formData)
          .catch((err: unknown) => {
            setError(
              err instanceof Error && err.message.includes("InvalidSecret")
                ? "Wrong email or password."
                : "Could not sign in. Check your details and try again.",
            );
          })
          .finally(() => setBusy(false));
      }}
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          required
          minLength={8}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          aria-describedby={error ? "auth-error" : undefined}
        />
      </div>
      {error ? (
        <p id="auth-error" role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {flow === "signIn" ? "Sign in" : "Create account"}
      </button>
      <button
        type="button"
        className="text-sm text-blue-700 underline"
        onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
      >
        {flow === "signIn" ? "New here? Create an account" : "Already registered? Sign in"}
      </button>
    </form>
  );
}
