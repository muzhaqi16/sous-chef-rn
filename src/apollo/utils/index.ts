/**
 * Apollo Cache Utilities
 *
 * Barrel export for cache-related utility functions
 */

export {
  // Types
  type InsertPosition,
  type AddToArrayOptions,
  type AddToConnectionOptions,
  type RemoveFromArrayOptions,
  // Query root field updaters
  createAddToQueryFieldUpdater,
  createAddToKeyedQueryFieldUpdater,
  createRemoveFromQueryFieldUpdater,
  // Parent entity field updaters
  createAddToParentConnectionUpdater,
  createAddToParentArrayUpdater,
  createRemoveFromParentConnectionUpdater,
  createRemoveFromParentArrayUpdater,
  // Direct eviction
  createItemEvictor,
} from './cacheUpdaters';
