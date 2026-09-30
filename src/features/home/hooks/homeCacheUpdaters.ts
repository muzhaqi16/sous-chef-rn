/**
 * Shared utilities for home management hooks
 */

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
