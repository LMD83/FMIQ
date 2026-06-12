import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/** "I have this" sheet: condition note + optional photo (Convex storage). */
export function OfferSheet({ needId, onClose }: { needId: string; onClose: () => void }) {
  const makeOffer = useMutation(api.offers.make);
  const uploadUrl = useMutation(api.offers.photoUploadUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-title"
      className="fixed inset-0 z-10 flex items-end justify-center bg-black/30 sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <h2 id="offer-title" className="text-lg font-semibold">
          Offer this item
        </h2>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const form = e.currentTarget;
            const data = new FormData(form);
            const file = (data.get("photo") as File) ?? null;
            void (async () => {
              try {
                let photoStorageId: string | undefined;
                if (file && file.size > 0) {
                  const url = await uploadUrl({});
                  const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": file.type },
                    body: file,
                  });
                  const json = (await res.json()) as { storageId: string };
                  photoStorageId = json.storageId;
                }
                await makeOffer({
                  needId: needId as never,
                  conditionNote: String(data.get("conditionNote") ?? ""),
                  ...(photoStorageId ? { photoStorageId: photoStorageId as never } : {}),
                });
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not send offer");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <div>
            <label htmlFor="conditionNote" className="block text-sm font-medium">
              Describe the item & its condition
            </label>
            <textarea
              id="conditionNote"
              name="conditionNote"
              required
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="photo" className="block text-sm font-medium">
              Photo (optional)
            </label>
            <input id="photo" name="photo" type="file" accept="image/*" className="mt-1 text-sm" />
          </div>
          {error ? (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Send offer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
