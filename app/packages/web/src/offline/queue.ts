/**
 * Offline write-queue for the field PWA (EP-6). Actions taken with no signal (start/close
 * a job, pre-task tick, photo) are persisted and replayed on reconnect. Storage is
 * pluggable: IndexedDB in the browser, in-memory for tests — so the queue semantics are
 * unit-tested in Node without a DOM.
 */

export type QueuedKind = 'wo_status' | 'pretask' | 'photo' | 'ack';

export interface QueuedAction {
  id: string;
  kind: QueuedKind;
  payload: unknown;
  createdAt: number;
}

export interface QueueStorage {
  getAll(): Promise<QueuedAction[]>;
  add(action: QueuedAction): Promise<void>;
  remove(id: string): Promise<void>;
}

/** In-memory storage (tests / SSR). */
export function memoryStorage(): QueueStorage {
  const map = new Map<string, QueuedAction>();
  return {
    async getAll() {
      return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
    },
    async add(a) {
      map.set(a.id, a);
    },
    async remove(id) {
      map.delete(id);
    },
  };
}

/** IndexedDB-backed storage for the browser PWA. */
export function indexedDbStorage(dbName = 'fmiq-offline', store = 'queue'): QueueStorage {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction(store, mode).objectStore(store));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  };
  return {
    getAll: () => tx<QueuedAction[]>('readonly', (s) => s.getAll()),
    add: (a) => tx<unknown>('readwrite', (s) => s.put(a)).then(() => undefined),
    remove: (id) => tx<unknown>('readwrite', (s) => s.delete(id)).then(() => undefined),
  };
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

export class OfflineQueue {
  constructor(private readonly storage: QueueStorage) {}

  async enqueue(kind: QueuedKind, payload: unknown): Promise<QueuedAction> {
    const action: QueuedAction = { id: newId(), kind, payload, createdAt: Date.now() };
    await this.storage.add(action);
    return action;
  }

  pending(): Promise<QueuedAction[]> {
    return this.storage.getAll();
  }

  /**
   * Replay queued actions in order. Successful sends are removed; failures are kept for
   * the next flush (at-least-once; the API is idempotent on the relevant operations).
   */
  async flush(send: (action: QueuedAction) => Promise<void>): Promise<{ sent: number; failed: number }> {
    const actions = await this.storage.getAll();
    let sent = 0;
    let failed = 0;
    for (const action of actions) {
      try {
        await send(action);
        await this.storage.remove(action.id);
        sent += 1;
      } catch {
        failed += 1;
      }
    }
    return { sent, failed };
  }
}
