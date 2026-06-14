import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "../components/ui";

/**
 * Post-a-need (W2): category/subcategory from the shared taxonomy (the SAME
 * source the server whitelists against), handover point, consent confirmation
 * (server blocks publish without it), optional ≤280-char private note.
 */
export function PostNeed({ allowedCategories }: { allowedCategories: string[] }) {
  const taxonomy = useQuery(api.needs.taxonomy);
  const points = useQuery(api.orgs.orgHandoverPoints);
  const post = useMutation(api.needs.post);
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (taxonomy === undefined || points === undefined) return <p role="status">Loading…</p>;
  const allowed = taxonomy.filter((t) => allowedCategories.includes(t.key));
  const activePoints = points.filter((p) => p.active);
  const subcats = allowed.find((t) => t.key === category)?.subcategories ?? [];

  if (activePoints.length === 0)
    return (
      <Card>
        <p className="text-stone-600">Add an active handover point first (orgAdmin).</p>
      </Card>
    );

  return (
    <Card>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setOk(false);
          const data = new FormData(e.currentTarget);
          const form = e.currentTarget;
          void post({
            category: String(data.get("category")),
            subcategory: String(data.get("subcategory")),
            conditionAccepted: String(data.get("conditionAccepted")),
            urgency: String(data.get("urgency")) as never,
            qty: Number(data.get("qty")),
            privateNote: String(data.get("privateNote") ?? "") || undefined,
            handoverPointId: String(data.get("handoverPointId")) as never,
            clientRef: String(data.get("clientRef")),
            consentConfirmed: data.get("consent") === "on",
          })
            .then(() => {
              setOk(true);
              form.reset();
              setCategory("");
            })
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : "Could not post"),
            );
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="category" className="block text-sm font-medium">
              Category
            </label>
            <select
              id="category"
              name="category"
              required
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Choose…</option>
              {allowed.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="subcategory" className="block text-sm font-medium">
              Item
            </label>
            <select
              id="subcategory"
              name="subcategory"
              required
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            >
              <option value="">Choose…</option>
              {subcats.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="conditionAccepted" className="block text-sm font-medium">
              Condition accepted
            </label>
            <input
              id="conditionAccepted"
              name="conditionAccepted"
              required
              defaultValue="Good used or better"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="urgency" className="block text-sm font-medium">
              Urgency
            </label>
            <select
              id="urgency"
              name="urgency"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            >
              <option value="urgent">Urgent</option>
              <option value="soon">Soon</option>
              <option value="whenever">Whenever</option>
            </select>
          </div>
          <div>
            <label htmlFor="qty" className="block text-sm font-medium">
              Quantity
            </label>
            <input
              id="qty"
              name="qty"
              type="number"
              min={1}
              max={20}
              defaultValue={1}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label htmlFor="handoverPointId" className="block text-sm font-medium">
            Handover point
          </label>
          <select
            id="handoverPointId"
            name="handoverPointId"
            required
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          >
            {activePoints.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.areaLabel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="clientRef" className="block text-sm font-medium">
            Your internal client reference (stays in your vault — never shown publicly)
          </label>
          <input
            id="clientRef"
            name="clientRef"
            required
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="privateNote" className="block text-sm font-medium">
            Private note (caseworker-only, ≤280 chars)
          </label>
          <textarea
            id="privateNote"
            name="privateNote"
            maxLength={280}
            rows={2}
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" className="mt-1" required />
          <span>
            I confirm the client has given consent for this need to be posted (no personal data is
            published — only a pseudonymous area listing).
          </span>
        </label>
        {error ? (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p role="status" className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
            Posted — it's now in the moderation queue and will go live once approved.
          </p>
        ) : null}
        <button
          type="submit"
          className="self-start rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Submit for moderation
        </button>
      </form>
    </Card>
  );
}
