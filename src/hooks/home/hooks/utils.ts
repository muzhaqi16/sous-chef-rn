/**
 * Shared utilities for home management hooks
 */

import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

// Cache updater utilities for homes
export const addToHomesCache = createAddToQueryConnectionUpdater('homes', 'Home');
export const removeFromHomesCache = createRemoveFromQueryConnectionUpdater('homes', 'Home');
