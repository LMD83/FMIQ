import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, UrgencyTag, SectionTitle } from "../components/ui";
import { OfferSheet } from "./OfferSheet";
import { MatchList } from "../match/MatchList";
import { useState } from "react";

/**
 * Donor home: the geo-matched needs feed (own cell + 8 neighbours) and the
 * donor's matches/chat. The feed shows ONLY the public DTO — pseudonym, area
 * label, "within ~5km". No map, no exact distance (rules 2 & 9).
 */
export function DonorHome() {
  const feed = useQuery(api.needs.publicFeed);
  const [offerNeedId, setOfferNeedId] = useState<string | null>(null);

  return (
    <>
      <SectionTitle>Needs near you</SectionTitle>
      <p className="-mt-2 mb-3 text-sm text-stone-600">
        People in your area need these specific items. If you can give one, offer it — handover is
        at a neutral point the charity chooses.
      </p>
      {feed === undefined ? (
        <p role="status">Loading…</p>
      ) : feed.length === 0 ? (
        <Card>
          <p className="text-stone-600">
            No open needs in your area right now. Check back soon — new needs appear here as
            charities post them.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {feed.map((need) => (
            <li key={need.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {need.subcategory}{" "}
                      <span className="text-stone-500">({need.category.replace(/_/g, " ")})</span>
                    </p>
                    <p className="text-sm text-stone-600">{need.pseudonym}</p>
                    <p className="mt-1 text-sm">
                      Condition accepted: <span className="font-medium">{need.conditionAccepted}</span>
                      {need.qty > 1 ? ` · Qty ${need.qty}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {need.areaLabel} · {need.distance}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <UrgencyTag urgency={need.urgency} />
                    <button
                      type="button"
                      onClick={() => setOfferNeedId(need.id)}
                      className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
                    >
                      I have this
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {offerNeedId ? (
        <OfferSheet needId={offerNeedId} onClose={() => setOfferNeedId(null)} />
      ) : null}

      <SectionTitle>Your matches</SectionTitle>
      <MatchList />
    </>
  );
}
