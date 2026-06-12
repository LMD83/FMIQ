import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Match chat. The send mutation runs the PII guard server-side; if it flags a
 * message we surface the returned warning inline (rule 7). Flagged messages are
 * marked so both parties see moderation is aware.
 */
export function Chat({ matchId }: { matchId: string }) {
  const messages = useQuery(api.messages.list, { matchId: matchId as never });
  const send = useMutation(api.messages.send);
  const [warning, setWarning] = useState<string | null>(null);

  return (
    <div className="mt-3 border-t border-stone-200 pt-3">
      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {messages === undefined ? (
          <p role="status">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-stone-500">
            No messages yet. Arrange the handover at the agreed neutral point — please don't share
            home addresses or phone numbers.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                m.mine ? "self-end bg-blue-600 text-white" : "self-start bg-stone-100"
              }`}
            >
              {m.body}
              {m.flagged ? (
                <span className="ml-2 text-xs italic opacity-80">⚑ flagged for review</span>
              ) : null}
            </div>
          ))
        )}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const input = form.elements.namedItem("body") as HTMLInputElement;
          const body = input.value.trim();
          if (!body) return;
          void send({ matchId: matchId as never, body }).then((res) => {
            setWarning(res?.warning ?? null);
            form.reset();
          });
        }}
      >
        <label htmlFor={`chat-${matchId}`} className="sr-only">
          Message
        </label>
        <input
          id={`chat-${matchId}`}
          name="body"
          className="flex-1 rounded border border-stone-300 px-3 py-1.5 text-sm"
          placeholder="Type a message…"
        />
        <button
          type="submit"
          className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
        >
          Send
        </button>
      </form>
      {warning ? (
        <p role="alert" className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {warning}
        </p>
      ) : null}
    </div>
  );
}
