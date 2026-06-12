import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Badge } from "../components/ui";

/** platformOps: approve pending orgs (W1 final step) + platform metrics. */
export function OpsConsole() {
  const pending = useQuery(api.orgs.pendingOrgs);
  const metrics = useQuery(api.metrics.platformMetrics);
  const approve = useMutation(api.orgs.approve);

  return (
    <>
      <h1 className="text-xl font-bold">Platform operations</h1>

      <h2 className="mb-2 mt-6 text-lg font-semibold">Pending charities</h2>
      {pending === undefined ? (
        <p role="status">Loading…</p>
      ) : pending.length === 0 ? (
        <Card>
          <p className="text-stone-600">No charities awaiting approval.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((o) => (
            <li key={o.id}>
              <Card>
                <div className="flex items-center justify-between">
                  <span>
                    <strong>{o.name}</strong> · RCN {o.rcn} ·{" "}
                    <span className="text-stone-500">{o.purposeCategory.replace(/_/g, " ")}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void approve({ orgId: o.id as never })}
                    className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800"
                  >
                    Approve (verify RCN)
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 mt-6 text-lg font-semibold">Metrics</h2>
      <Card>
        {metrics === undefined ? (
          <p role="status">Loading…</p>
        ) : Object.keys(metrics).length === 0 ? (
          <p className="text-stone-600">No events recorded yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(metrics).map(([name, count]) => (
              <span key={name} className="flex items-center gap-2">
                <Badge>{name}</Badge>
                <span className="text-lg font-semibold">{count}</span>
              </span>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
