import { useSyncExternalStore } from 'react';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';

const subscribe = (onStoreChange: () => void) =>
  unconfirmedCreates.subscribe(onStoreChange);

/**
 * Whether `id` names a local-first create the server hasn't acknowledged. A
 * detail query or subscription on it skips: the server would answer null data
 * or `FORBIDDEN` for a row it lacks.
 */
export const useIsCreateUnconfirmed = (
  id: string | null | undefined,
): boolean =>
  useSyncExternalStore(subscribe, () =>
    id ? unconfirmedCreates.has(id) : false,
  );
