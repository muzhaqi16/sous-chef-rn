import type { ApolloCache } from '@apollo/client';
import {
  scopeStorage,
  type CacheShards,
} from '#/apollo/offline/ApolloCachePersistence';
import { logger } from '#/utils/environment';
import {
  clearPositions,
  heldScopes,
  holdPosition,
  type FeedPosition,
} from './feedPositions';
import { adapterOfKind, FEED_ADAPTERS } from './feedRegistry';

function restorePositions(cache: ApolloCache): void {
  const text = scopeStorage.readPositions();
  if (!text) return;
  try {
    const stored = JSON.parse(text) as [string, FeedPosition][];
    for (const [scopeId, position] of stored) {
      // A position never outlives its rows: lost with them, the scope reads in full.
      if (adapterOfKind(position.kind)?.holdsStoredRows(cache, scopeId)) {
        holdPosition(scopeId, position);
      }
    }
  } catch (error) {
    logger.warn('Feed: stored positions were unreadable', error);
    scopeStorage.writePositions('[]');
  }
}

/** Every kind's rows kept apart from the launch blob, and the positions claiming them. */
export const feedStorage: CacheShards = {
  save(cache, stored, previous) {
    let eager = stored;
    for (const { storage } of FEED_ADAPTERS) {
      if (storage) eager = storage.save(cache, eager, previous);
    }
    return eager;
  },

  // After the blob, as a pantry's rows are in it: a position never outruns its rows.
  saved() {
    scopeStorage.writePositions(JSON.stringify([...heldScopes()]));
  },

  restore(cache) {
    restorePositions(cache);
    for (const { storage } of FEED_ADAPTERS) storage?.restore(cache);
  },

  clear() {
    for (const { storage } of FEED_ADAPTERS) storage?.clear();
    scopeStorage.clear();
    clearPositions();
  },
};
