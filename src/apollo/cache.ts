import { InMemoryCache } from '@apollo/client';
import { storage } from '#storage/mmkv';

const CACHE_VERSION = '1.0';
const CACHE_KEY = `apollo-cache-${CACHE_VERSION}`;

/**
 * Intelligent merge function that preserves optimistic updates
 * Merges arrays of objects by ID, keeping optimistic items until server confirms
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

  // Create a map of existing items by ID
  const existingMap = new Map<string, T>();
  existing.forEach(item => {
    const id = readField('id', item) as string;
    if (id) {
      existingMap.set(id, item);
    }
  });

  // Create a map of incoming items by ID
  const incomingMap = new Map<string, T>();
  incoming.forEach(item => {
    const id = readField('id', item) as string;
    if (id) {
      incomingMap.set(id, item);
    }
  });

  // Merge: Keep all incoming items (server truth)
  // Add any existing items that are optimistic (temporary IDs starting with 'temp-')
  const merged = [...incoming];

  existingMap.forEach((item, id) => {
    // If item exists in incoming, it's already in merged array
    if (incomingMap.has(id)) {
      return;
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
