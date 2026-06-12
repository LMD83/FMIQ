import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * First-run profile. Invited emails (caseworker/orgAdmin/moderator/ops) get
 * their role automatically; everyone else becomes a donor and gives a
 * ROUTING KEY area (we never ask for, store, or log a full address — the
 * Eircode is used transiently to find the ~5km area and discarded).
 */
export function ProfileSetup() {
  const ensureProfile = useMutation(api.users.ensureProfile);
  const [error, setError] = useState<string | null>(null);

  return (
    <main id="main" className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-xl font-bold">Finish setting up</h1>
      <p className="mt-1 text-sm text-stone-600">
        Donors: your Eircode is used once to find your ~5km area, then discarded. We never store
        addresses.
      </p>
      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          void ensureProfile({
            displayName: String(data.get("displayName") ?? ""),
            email: String(data.get("email") ?? ""),
            eircode: String(data.get("eircode") ?? "") || undefined,
          }).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Something went wrong");
          });
        }}
      >
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium">
            Email (same as sign-in)
          </label>
          <input
            id="profile-email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="eircode" className="block text-sm font-medium">
            Eircode or routing key (donors — e.g. D08 or D08 XY12)
          </label>
          <input
            id="eircode"
            name="eircode"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            aria-describedby="eircode-help"
          />
          <p id="eircode-help" className="mt-1 text-xs text-stone-500">
            Used once to pick your area, never stored. Leave blank if you were invited as staff.
          </p>
        </div>
        {error ? (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="rounded bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
