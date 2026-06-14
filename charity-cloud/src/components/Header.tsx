import { useAuthActions } from "@convex-dev/auth/react";

interface Me {
  displayName: string;
  role: string;
  areaLabel: string | null;
}

export function Header({ me }: { me: Me }) {
  const { signOut } = useAuthActions();
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <span className="font-bold">Charity Cloud</span>
        <div className="flex items-center gap-3 text-sm">
          <span>
            {me.displayName}
            <span className="ml-2 rounded bg-stone-100 px-2 py-0.5 text-xs uppercase tracking-wide">
              {me.role}
            </span>
            {me.areaLabel ? <span className="ml-2 text-stone-500">{me.areaLabel}</span> : null}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
