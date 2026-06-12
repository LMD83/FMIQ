/** Charity Cloud — tiny shared UI atoms (accessible, no colour-only state). */
import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">{children}</div>;
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-stone-700">
      {children}
    </span>
  );
}

const URGENCY: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  soon: "bg-amber-100 text-amber-800",
  whenever: "bg-stone-100 text-stone-700",
};

export function UrgencyTag({ urgency }: { urgency: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${URGENCY[urgency] ?? ""}`}>
      {/* text label too — never colour alone (WCAG) */}
      {urgency}
    </span>
  );
}

export function Button({
  children,
  ...rest
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-6 text-lg font-semibold">{children}</h2>;
}
