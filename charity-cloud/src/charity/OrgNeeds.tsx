import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Badge, UrgencyTag } from "../components/ui";
import { OffersForNeed } from "./OffersForNeed";
import { useState } from "react";

/** The org's own needs with status, offers review, and consent withdrawal. */
export function OrgNeeds() {
  const needs = useQuery(api.needs.orgNeeds);
  const withdraw = useMutation(api.needs.withdrawConsent);
  const statements = useQuery(api.moderation.statementsForOrg);
  const [open, setOpen] = useState<string | null>(null);

  if (needs === undefined) return <p role="status">Loading…</p>;
  if (needs.length === 0)
    return (
      <Card>
        <p className="text-stone-600">No needs posted yet.</p>
      </Card>
    );

  return (
    <>
      {statements && statements.length > 0 ? (
        <Card>
          <p className="text-sm font-medium text-red-800">Moderation statements of reasons</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-stone-700">
            {statements.map((s) => (
              <li key={s.needId}>
                {s.subcategory}: {s.statementOfReasons}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <ul className="mt-3 flex flex-col gap-3">
        {needs.map((n) => (
          <li key={n.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {n.subcategory}{" "}
                    <span className="text-stone-500">({n.category.replace(/_/g, " ")})</span>
                  </p>
                  <p className="text-sm text-stone-600">{n.pseudonym}</p>
                  {n.privateNote ? (
                    <p className="mt-1 text-xs italic text-stone-500">Note: {n.privateNote}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <UrgencyTag urgency={n.urgency} />
                  <Badge>{n.status}</Badge>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                {n.status === "open" || n.status === "review" ? (
                  <button
                    type="button"
                    onClick={() => void withdraw({ needId: n.id as never })}
                    className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
                  >
                    Withdraw (consent)
                  </button>
                ) : null}
                {n.status === "open" ? (
                  <button
                    type="button"
                    onClick={() => setOpen(open === n.id ? null : n.id)}
                    className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
                  >
                    {open === n.id ? "Hide offers" : "Review offers"}
                  </button>
                ) : null}
              </div>
              {open === n.id ? <OffersForNeed needId={n.id} /> : null}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
