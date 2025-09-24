import { InMemoryCache } from '@apollo/client';
import { storage } from '#storage/mmkv';

const CACHE_VERSION = '1.0';
const CACHE_KEY = `apollo-cache-${CACHE_VERSION}`;

export function makeCache(): InMemoryCache {
  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          homes: {
            // Cache homes list for 5 minutes to reduce refetching
            merge(_existing = [], incoming = []) {
              return incoming;
            },
          },
          pantryItems: {
            keyArgs: ['pantryId'],
            // Just replace with incoming data - no complex merging
            merge(_, incoming) {
              return incoming;
            },
          },
          shoppingListItems: {
            keyArgs: ['shoppingListId'],
            merge(_, incoming) {
              return incoming;
            },
          },
          shoppingLists: {
            merge(_existing = [], incoming = []) {
              return incoming;
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
            merge(_existing = [], incoming = []) {
              // Simple replacement for home members
              return incoming;
            },
          },
          pantries: {
            merge(_existing = [], incoming = []) {
              // Simple replacement for pantries list
              return incoming;
            },
          },
          shoppingLists: {
            merge(_existing = [], incoming = []) {
              // Simple replacement for shopping lists
              return incoming;
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
