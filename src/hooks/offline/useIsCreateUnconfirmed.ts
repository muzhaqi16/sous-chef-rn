import { useSyncExternalStore } from 'react';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';

const subscribe = (onStoreChange: () => void) =>
  unconfirmedCreates.subscribe(onStoreChange);

/**
 * Whether `id` names a local-first create the server hasn't acknowledged yet —
 * either still in flight or sitting in the offline queue.
 *
 * Detail queries keyed on a client-minted id pass this to `skip`: the row
 * doesn't exist server-side until the create lands, so the read can only come
 * back `RESOURCE_NOT_FOUND`. Flipping back to false unskips the query, which
 * fetches the server's copy at the first moment there is one.
 *
 * @param id entity id, or null/undefined when there is nothing to query
 */
export const useIsCreateUnconfirmed = (
  id: string | null | undefined,
): boolean =>
  useSyncExternalStore(subscribe, () =>
    id ? unconfirmedCreates.has(id) : false,
  );
