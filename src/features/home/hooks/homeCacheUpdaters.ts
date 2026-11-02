/**
 * Shared utilities for home management hooks
 */

import type { ApolloCache } from '@apollo/client';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

// Cache updater utilities for homes
// The connection write identifies the row by `__typename`.
export const addToHomesCache = createAddToQueryConnectionUpdater<{
  __typename: 'Home';
  id: string;
}>('homes', 'Home');
export const removeFromHomesCache = createRemoveFromQueryConnectionUpdater(
  'homes',
  'Home',
);

/** Whether the server's `homes` list is cached: `modify` visits only a stored field. */
export function holdsHomesList(cache: ApolloCache): boolean {
  let held = false;
  cache.modify({
    fields: {
      homes: (existing: unknown) => {
        held = true;
        return existing;
      },
    },
  });
  return held;
}
