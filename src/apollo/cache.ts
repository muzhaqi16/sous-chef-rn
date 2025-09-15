import { InMemoryCache } from '@apollo/client';
import { storage } from '#storage/mmkv';

const CACHE_VERSION = '1.0';
const CACHE_KEY = `apollo-cache-${CACHE_VERSION}`;

export function makeCache(): InMemoryCache {
  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
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
            merge(existing = [], incoming = []) {
              // Simple replacement for home members
              return incoming;
            },
          },
          pantries: {
            merge(existing = [], incoming = []) {
              // Simple replacement for pantries list
              return incoming;
            },
          },
          shoppingLists: {
            merge(existing = [], incoming = []) {
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

  // Simple persistence - debounced
  let persistTimeout: NodeJS.Timeout;
  const persist = () => {
    clearTimeout(persistTimeout);
    persistTimeout = setTimeout(() => {
      try {
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
