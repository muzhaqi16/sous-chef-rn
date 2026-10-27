import type { SubscriptionApolloClient } from './types';

/**
 * Reads the entries `ids` names and answers the ids that came back; `null`
 * when the read itself failed (offline, transport).
 */
export type ReadEntries = (
  client: SubscriptionApolloClient,
  ids: string[],
) => Promise<readonly string[] | null>;

// One member's action (a 30-line check-in) fires its events within a few
// milliseconds of each other; this gathers them with no visible delay.
const WINDOW_MS = 150;
// The API's cap on one by-ids read.
const MAX_IDS = 100;

interface Waiter {
  id: string;
  settle: (found: boolean) => void;
}

/**
 * Event read-backs that arrive together go as one by-ids request instead of
 * one each. Each caller learns whether its entry came back: absent means
 * offline, removed since the event, not viewable, or absorbed by a merge
 * (which reads as its survivor).
 */
export function batchedEventRead(read: ReadEntries) {
  const waiting = new Map<SubscriptionApolloClient, Waiter[]>();

  const readChunk = async (
    client: SubscriptionApolloClient,
    ids: string[],
    waiters: Waiter[],
  ) => {
    // Every caller is answered, whatever the read does.
    const returned = await read(client, ids)
      .then(found => new Set(found ?? []))
      .catch(() => new Set<string>());
    for (const waiter of waiters) {
      if (ids.includes(waiter.id)) waiter.settle(returned.has(waiter.id));
    }
  };

  const flush = (client: SubscriptionApolloClient) => {
    const waiters = waiting.get(client) ?? [];
    waiting.delete(client);
    const ids = [...new Set(waiters.map(waiter => waiter.id))];
    for (let start = 0; start < ids.length; start += MAX_IDS) {
      void readChunk(client, ids.slice(start, start + MAX_IDS), waiters);
    }
  };

  return (client: SubscriptionApolloClient, id: string): Promise<boolean> =>
    new Promise(settle => {
      const batch = waiting.get(client);
      if (batch) {
        batch.push({ id, settle });
        return;
      }
      waiting.set(client, [{ id, settle }]);
      setTimeout(() => flush(client), WINDOW_MS);
    });
}
