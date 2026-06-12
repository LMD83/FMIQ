import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/** Offers on a need; accept settles the match (first accepted wins, server-side). */
export function OffersForNeed({ needId }: { needId: string }) {
  const offers = useQuery(api.offers.forNeed, { needId: needId as never });
  const accept = useMutation(api.offers.accept);

  if (offers === undefined) return <p role="status">Loading offers…</p>;
  if (offers.length === 0)
    return <p className="mt-2 text-sm text-stone-500">No offers yet.</p>;

  return (
    <ul className="mt-2 flex flex-col gap-2 border-t border-stone-200 pt-2">
      {offers.map((o) => (
        <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
          <div>
            <p>{o.conditionNote}</p>
            {o.photoUrl ? (
              <a href={o.photoUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                View photo
              </a>
            ) : null}
            <span className="ml-2 text-xs text-stone-500">{o.status}</span>
          </div>
          {o.status === "pending" ? (
            <button
              type="button"
              onClick={() => void accept({ offerId: o.id as never })}
              className="rounded bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-800"
            >
              Accept
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
