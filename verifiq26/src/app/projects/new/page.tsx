"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { AuthNav } from "@/components/auth/AuthNav";

export default function NewProjectPage() {
  const createDemo = useMutation(api.seed.createDemoProject);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const { projectId } = await createDemo({});
      router.push(`/projects/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <div className="mb-8 flex justify-end">
        <AuthNav />
      </div>
      <h1 className="font-serif text-2xl uppercase tracking-widest">New project</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Create a demo project to open the live Atelier console wired to Convex.
      </p>
      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="mt-8 border border-[var(--gold)] px-8 py-3 font-mono text-xs uppercase tracking-widest text-[var(--gold)] transition hover:bg-[var(--gold)]/10 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create demo project"}
      </button>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
