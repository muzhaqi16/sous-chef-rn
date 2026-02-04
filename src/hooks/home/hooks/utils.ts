/**
 * Shared utilities for home management hooks
 */

import {
  createAddToQueryFieldUpdater,
  createRemoveFromQueryFieldUpdater,
} from '#/apollo/utils/cacheUpdaters';

// Cache updater utilities for homes
export const addToHomesCache = createAddToQueryFieldUpdater('homes');
export const removeFromHomesCache = createRemoveFromQueryFieldUpdater('homes', 'Home');
