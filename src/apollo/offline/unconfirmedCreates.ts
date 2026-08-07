import { queueStore } from '#/apollo/offlineQueue/queueStore';

/**
 * Client-minted entity ids whose create the server has not acknowledged yet.
 *
 * A local-first create mints the row's permanent cuid and publishes it to the
 * cache BEFORE the mutation fires, so any detail query keyed on that id can
 * reach the API while the row still doesn't exist there. That read can only
 * fail — `RESOURCE_NOT_FOUND` until the create lands — and it leaves the
 * query in an error state that never retries on its own, on screens that stay
 * mounted for the session. Detail queries gate their `skip` on this set and
 * fire once the id clears, which is also when the server first has data worth
 * fetching.
 *
 * Two windows make an id unconfirmed. An acknowledged create only ever sees
 * the first; one that goes to the queue passes from the first into the second:
 *
 * 1. **In flight** — between the optimistic cache write and the mutation
 *    resolving. Tracked here, in memory: a create interrupted by app death
 *    leaves nothing to strand, and the queue below covers the restart.
 * 2. **Queued** — an offline / API-unreachable create waiting to replay.
 *    Tracked by {@link queueStore.getPendingClientIds}, which owns the
 *    persisted queue and already extracts `input.id` from every queued create.
 *
 * The hand-off between them has no gap: `queueLink` enqueues the mutation
 * before it completes the observable, so by the time `confirm()` runs on a
 * queued create the id is already in the queue's pending set.
 *
 * Read reactively via `useIsCreateUnconfirmed`.
 */

const inFlight = new Set<string>();
const listeners = new Set<() => void>();

/** Attached on first use and kept — notifying zero listeners is a no-op. */
let watchingQueue = false;

const notify = (): void => {
  listeners.forEach(listener => listener());
};

export const unconfirmedCreates = {
  /** Mark a client-minted id as not yet acknowledged by the server. */
  mark(id: string): void {
    if (inFlight.has(id)) return;
    inFlight.add(id);
    notify();
  },

  /**
   * Release the in-flight claim on `id`. Call once the create mutation
   * resolves, whatever the outcome: acknowledged and rejected both mean no
   * detail read can hit a missing row, and queued means `queueStore` has
   * already taken over.
   */
  confirm(id: string): void {
    if (!inFlight.delete(id)) return;
    notify();
  },

  /** Whether a create for `id` is still in flight or waiting to replay. */
  has(id: string): boolean {
    return inFlight.has(id) || queueStore.getPendingClientIds().has(id);
  },

  /**
   * Subscribe to changes in either window. `useSyncExternalStore`-compatible.
   * A queue replay draining the last pending create is what unskips a detail
   * query for an offline-created row, so queue changes are relayed too.
   */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (!watchingQueue) {
      watchingQueue = true;
      queueStore.subscribe(notify);
    }

    return () => {
      listeners.delete(listener);
    };
  },
};
