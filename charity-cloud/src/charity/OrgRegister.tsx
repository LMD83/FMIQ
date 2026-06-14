import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "../components/ui";

const PURPOSES = [
  ["family_support", "Family support"],
  ["homelessness", "Homelessness"],
  ["disability", "Disability"],
  ["older_persons", "Older persons"],
  ["education_youth", "Education & youth"],
  ["migrant_refugee_support", "Migrant & refugee support"],
  ["general_community", "General community"],
] as const;

/**
 * Org onboarding (W1): enter RCN → lookup (stubbed register) → register org
 * pending approval. Purpose constrains the categories the org may post under.
 */
export function OrgRegister() {
  const lookup = useAction(api.registerLookup.lookupRcn);
  const register = useMutation(api.orgs.register);
  const [found, setFound] = useState<{ name: string; purpose: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rcn, setRcn] = useState("");

  return (
    <Card>
      <h1 className="text-xl font-bold">Register your charity</h1>
      <p className="mt-1 text-sm text-stone-600">
        We verify your Registered Charity Number against the public Charities Register. Try{" "}
        <code className="rounded bg-stone-100 px-1">20012345</code> or{" "}
        <code className="rounded bg-stone-100 px-1">20067890</code> in this demo.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <div>
          <label htmlFor="rcn" className="block text-sm font-medium">
            Registered Charity Number
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="rcn"
              value={rcn}
              onChange={(e) => setRcn(e.target.value)}
              className="flex-1 rounded border border-stone-300 px-3 py-2"
            />
            <button
              type="button"
              className="rounded border border-stone-300 px-3 hover:bg-stone-100"
              onClick={() => {
                setError(null);
                void lookup({ rcn }).then((rec) => {
                  if (!rec) return setError("RCN not found in the register.");
                  if (rec.status !== "registered")
                    return setError("That charity is not currently registered.");
                  setFound({ name: rec.name, purpose: rec.purpose });
                });
              }}
            >
              Look up
            </button>
          </div>
        </div>

        {found ? (
          <form
            className="rounded border border-green-200 bg-green-50 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const data = new FormData(e.currentTarget);
              const allowed = data.getAll("cat").map(String);
              void register({
                name: found.name,
                rcn,
                purposeCategory: found.purpose,
                allowedCategories: allowed,
              }).catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not register"),
              );
            }}
          >
            <p className="text-sm">
              Verified: <strong>{found.name}</strong> · purpose{" "}
              <em>{found.purpose.replace(/_/g, " ")}</em>
            </p>
            <fieldset className="mt-2">
              <legend className="text-sm font-medium">Categories you'll post under</legend>
              <CategoryChecklist purpose={found.purpose} />
            </fieldset>
            <button
              type="submit"
              className="mt-3 rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              Register (pending approval)
            </button>
          </form>
        ) : null}

        {error ? (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Purpose → categories mapping shown is a sensible default flagged for review (see
        docs/ROADMAP-WEEKEND.md).
      </p>
      <input type="hidden" value={JSON.stringify(PURPOSES)} readOnly />
    </Card>
  );
}

const PURPOSE_CATS: Record<string, string[]> = {
  homelessness: ["bedding_warmth", "clothing", "kitchen_household", "outdoor_camping", "furniture"],
  family_support: ["baby_child", "clothing", "furniture", "kitchen_household", "education_school"],
  disability: ["mobility_equipment", "furniture", "bedding_warmth", "kitchen_household"],
  older_persons: ["mobility_equipment", "bedding_warmth", "furniture", "kitchen_household"],
  education_youth: ["education_school", "clothing", "outdoor_camping"],
  migrant_refugee_support: [
    "clothing",
    "bedding_warmth",
    "kitchen_household",
    "furniture",
    "baby_child",
    "education_school",
  ],
  general_community: [
    "mobility_equipment",
    "baby_child",
    "furniture",
    "bedding_warmth",
    "clothing",
    "kitchen_household",
    "education_school",
    "outdoor_camping",
  ],
};

function CategoryChecklist({ purpose }: { purpose: string }) {
  const cats = PURPOSE_CATS[purpose] ?? [];
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {cats.map((c) => (
        <label key={c} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-sm">
          <input type="checkbox" name="cat" value={c} defaultChecked />
          {c.replace(/_/g, " ")}
        </label>
      ))}
    </div>
  );
}
