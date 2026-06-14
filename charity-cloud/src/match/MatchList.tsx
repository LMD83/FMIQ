import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Badge } from "../components/ui";
import { Chat } from "./Chat";

/** Shared by donors and charity staff: their active/closed matches + chat. */
export function MatchList() {
  const matches = useQuery(api.matches.myMatches);
  const [openChat, setOpenChat] = useState<string | null>(null);

  if (matches === undefined) return <p role="status">Loading…</p>;
  if (matches.length === 0)
    return (
      <Card>
        <p className="text-stone-600">No matches yet.</p>
      </Card>
    );

  return (
    <ul className="flex flex-col gap-3">
      {matches.map((m) => (
        <li key={m.id}>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {m.subcategory}{" "}
                  <span className="text-stone-500">({m.category.replace(/_/g, " ")})</span>
                </p>
                <p className="text-sm text-stone-600">{m.needPseudonym}</p>
                <p className="mt-1 text-sm">
                  Handover: <span className="font-medium">{m.handoverLabel}</span>, {m.handoverAreaLabel}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge>{m.status}</Badge>
                {m.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => setOpenChat(openChat === m.id ? null : m.id)}
                    className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
                    aria-expanded={openChat === m.id}
                  >
                    {openChat === m.id ? "Hide chat" : "Open chat"}
                  </button>
                ) : null}
              </div>
            </div>
            {openChat === m.id ? <Chat matchId={m.id} /> : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}
