import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "../components/ui";

/** orgAdmin CRUD for neutral handover points (Eircode resolved transiently). */
export function HandoverPoints() {
  const points = useQuery(api.orgs.orgHandoverPoints);
  const add = useMutation(api.orgs.addHandoverPoint);
  const setActive = useMutation(api.orgs.setHandoverActive);

  return (
    <Card>
      <ul className="flex flex-col gap-2">
        {(points ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span>
              {p.label} · <span className="text-stone-500">{p.areaLabel}</span>
            </span>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={p.active}
                onChange={(e) => void setActive({ id: p.id as never, active: e.target.checked })}
              />
              active
            </label>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          void add({
            label: String(data.get("label")),
            eircode: String(data.get("eircode")),
          }).then(() => form.reset());
        }}
      >
        <div>
          <label htmlFor="hp-label" className="block text-xs font-medium">
            Label
          </label>
          <input id="hp-label" name="label" required className="rounded border border-stone-300 px-2 py-1 text-sm" />
        </div>
        <div>
          <label htmlFor="hp-eircode" className="block text-xs font-medium">
            Eircode / routing key
          </label>
          <input id="hp-eircode" name="eircode" required className="rounded border border-stone-300 px-2 py-1 text-sm" />
        </div>
        <button type="submit" className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
          Add
        </button>
      </form>
    </Card>
  );
}
