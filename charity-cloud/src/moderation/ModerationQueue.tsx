import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Badge, UrgencyTag } from "../components/ui";

/**
 * Moderator console (DSA Art 16/17): approve needs to publish, or remove with
 * a required statement of reasons; triage chat flags.
 */
export function ModerationQueue() {
  const items = useQuery(api.moderation.queue);
  const approve = useMutation(api.moderation.approveNeed);
  const remove = useMutation(api.moderation.removeNeed);
  const resolveFlag = useMutation(api.moderation.resolveChatFlag);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  if (items === undefined) return <p role="status">Loading…</p>;

  return (
    <>
      <h1 className="text-xl font-bold">Moderation queue</h1>
      {items.length === 0 ? (
        <Card>
          <p className="text-stone-600">Nothing waiting. 🎉</p>
        </Card>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <div className="flex items-center gap-2">
                  <Badge>{item.kind}</Badge>
                  {item.reason ? <span className="text-sm text-stone-600">{item.reason}</span> : null}
                </div>

                {item.need ? (
                  <div className="mt-2">
                    <p className="font-medium">
                      {item.need.subcategory}{" "}
                      <span className="text-stone-500">
                        ({item.need.category.replace(/_/g, " ")})
                      </span>{" "}
                      <UrgencyTag urgency={item.need.urgency} />
                    </p>
                    <p className="text-sm text-stone-600">
                      {item.need.pseudonym} · {item.need.areaLabel}
                    </p>
                    {item.need.status === "review" ? (
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <button
                          type="button"
                          onClick={() => void approve({ itemId: item.id as never })}
                          className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800"
                        >
                          Approve & publish
                        </button>
                        <div className="flex items-end gap-1">
                          <div>
                            <label htmlFor={`reason-${item.id}`} className="block text-xs">
                              Statement of reasons (to remove)
                            </label>
                            <input
                              id={`reason-${item.id}`}
                              value={reasons[item.id] ?? ""}
                              onChange={(e) =>
                                setReasons({ ...reasons, [item.id]: e.target.value })
                              }
                              className="rounded border border-stone-300 px-2 py-1 text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void remove({
                                itemId: item.id as never,
                                statementOfReasons: reasons[item.id] ?? "",
                              })
                            }
                            className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-stone-500">Status: {item.need.status}</p>
                    )}
                  </div>
                ) : null}

                {item.message ? (
                  <div className="mt-2">
                    <p className="rounded bg-stone-100 px-3 py-1.5 text-sm">{item.message.body}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void resolveFlag({ itemId: item.id as never, resolution: "dismissed" })
                        }
                        className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void resolveFlag({ itemId: item.id as never, resolution: "removed" })
                        }
                        className="rounded bg-red-700 px-3 py-1 text-sm font-medium text-white hover:bg-red-800"
                      >
                        Remove message
                      </button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
