import { InMemoryCache } from '@apollo/client';
import { storage } from '#storage/mmkv';

const CACHE_VERSION = '1.0';
const CACHE_KEY = `apollo-cache-${CACHE_VERSION}`;

/**
 * Version-aware merge function that handles optimistic updates and conflict resolution
 *
 * Features:
 * - Preserves optimistic items (temp- IDs) until server confirms
 * - Resolves conflicts using version field (higher version wins)
 * - Falls back to updatedAt timestamp if versions are equal
 * - Works with any entity type that has id, version, and updatedAt
 *
 * @template T - Entity type with id, version, updatedAt fields
 */
function mergeArrayByIdIntelligent<T extends { id: string; __ref?: string }>(
  existing: T[] = [],
  incoming: T[] = [],
  { readField }: { readField: (field: string, ref: any) => any },
): T[] {
  // If no existing data, just return incoming
  if (!existing || existing.length === 0) {
    return incoming;
  }

  // If no incoming data, keep existing (might be optimistic)
  if (!incoming || incoming.length === 0) {
    return existing;
  }

  // Create a map of existing items by ID with version metadata
  const existingMap = new Map<string, { item: T; version: number; updatedAt: string }>();
  existing.forEach(item => {
    const id = readField('id', item) as string;
    if (id) {
      existingMap.set(id, {
        item,
        version: (readField('version', item) as number) || 0,
        updatedAt: (readField('updatedAt', item) as string) || '',
      });
    }
  });

  // Create a map of incoming items by ID with version metadata
  const incomingMap = new Map<string, { item: T; version: number; updatedAt: string }>();
  incoming.forEach(item => {
    const id = readField('id', item) as string;
    if (id) {
      incomingMap.set(id, {
        item,
        version: (readField('version', item) as number) || 0,
        updatedAt: (readField('updatedAt', item) as string) || '',
      });
    }
  });

  // Merge with version-based conflict resolution
  const merged: T[] = [];

  // Process all incoming items
  incomingMap.forEach(({ item: incomingItem, version: incomingVersion, updatedAt: incomingUpdatedAt }, id) => {
    const existingData = existingMap.get(id);

    if (!existingData) {
      // New item from server, add it
      merged.push(incomingItem);
      return;
    }

    // Both exist - resolve conflict using version
    if (incomingVersion > existingData.version) {
      // Incoming has higher version, use it
      merged.push(incomingItem);
    } else if (incomingVersion < existingData.version) {
      // Existing has higher version (optimistic update ahead of server), keep existing
      merged.push(existingData.item);
    } else {
      // Same version - use timestamp as tiebreaker
      if (incomingUpdatedAt >= existingData.updatedAt) {
        merged.push(incomingItem);
      } else {
        merged.push(existingData.item);
      }
    }
  });

  // Add any optimistic items not yet confirmed by server
  existingMap.forEach(({ item }, id) => {
    if (incomingMap.has(id)) {
      return; // Already processed above
    }

    // If item has temporary ID (optimistic), keep it until server confirms
    if (id.startsWith('temp-')) {
      merged.push(item);
    }
    // Otherwise, it was removed from server, don't include it
  });

  return merged;
}

export function makeCache(): InMemoryCache {
  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          homes: {
            // Intelligent merge to preserve optimistic home additions
            merge(existing = [], incoming = [], { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
          pantryItems: {
            keyArgs: ['pantryId'],
            // Intelligent merge to preserve optimistic pantry item changes
            merge(existing, incoming, { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
          shoppingListItems: {
            keyArgs: ['shoppingListId'],
            // Intelligent merge to preserve optimistic shopping list changes
            merge(existing, incoming, { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
          shoppingLists: {
            // Intelligent merge to preserve optimistic list additions
            merge(existing = [], incoming = [], { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
        },
      },
      PantryItem: {
        keyFields: ['id'],
      },
      ShoppingListItem: {
        keyFields: ['id'],
      },
      Item: {
        keyFields: ['id'],
      },
      User: {
        keyFields: ['id'],
        fields: {
          // Merge user updates instead of replacing
          profile: {
            merge(existing, incoming) {
              return { ...existing, ...incoming };
            },
          },
        },
      },
      Home: {
        keyFields: ['id'],
        fields: {
          members: {
            // Intelligent merge to preserve optimistic member additions/updates
            merge(existing = [], incoming = [], { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
          pantries: {
            // Intelligent merge to preserve optimistic pantry additions
            merge(existing = [], incoming = [], { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
          shoppingLists: {
            // Intelligent merge to preserve optimistic list additions
            merge(existing = [], incoming = [], { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
        },
      },
      Unit: {
        keyFields: ['id'],
      },
      ShoppingList: {
        keyFields: ['id'],
      },
      Pantry: {
        keyFields: ['id'],
      },
    },
  });

  // Simple restoration
  try {
    const saved = storage.getString(CACHE_KEY);
    if (saved) {
      cache.restore(JSON.parse(saved));
    }
  } catch (e) {
    storage.delete(CACHE_KEY);
  }

  // Cache size management
  const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB limit
  let lastGcTime = Date.now();

  const checkCacheSize = () => {
    try {
      const cacheData = JSON.stringify(cache.extract());
      if (cacheData.length > MAX_CACHE_SIZE) {
        console.log('🗑️ Cache size exceeded, running garbage collection');
        cache.gc();
        lastGcTime = Date.now();
      }
    } catch (e) {
      console.warn('Cache size check failed:', e);
    }
  };

  // Simple persistence - debounced with size check
  let persistTimeout: NodeJS.Timeout;
  const persist = () => {
    clearTimeout(persistTimeout);
    persistTimeout = setTimeout(() => {
      try {
        // Run GC if it's been more than 5 minutes since last check
        if (Date.now() - lastGcTime > 5 * 60 * 1000) {
          checkCacheSize();
        }

        storage.set(CACHE_KEY, JSON.stringify(cache.extract()));
      } catch (e) {
        console.warn('Cache persist failed:', e);
      }
    }, 500); // Debounce for 500ms
  };

  // Only persist on writes
  const originalWrite = cache.write;
  cache.write = function (...args) {
    const result = originalWrite.apply(this, args);
    persist();
    return result;
  };

  return cache;
}
