import { useSyncExternalStore } from 'react';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';

const subscribe = (onStoreChange: () => void) =>
  unconfirmedCreates.subscribe(onStoreChange);

/**
 * Whether `id` names a local-first create the server hasn't acknowledged. Detail
 * queries on a client-minted id pass this to `skip` — the row does not exist
 * server-side yet, so the read could only come back `RESOURCE_NOT_FOUND`.
 */
export const useIsCreateUnconfirmed = (
  id: string | null | undefined,
): boolean =>
  useSyncExternalStore(subscribe, () =>
    id ? unconfirmedCreates.has(id) : false,
  );
