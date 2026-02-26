# Apollo GraphQL Patterns & Best Practices

This document defines the standardized patterns for using Apollo Client in this application. Following these patterns ensures consistent offline-first behavior, optimal performance, and maintainable code.

---

## Table of Contents

1. [Cache Update Patterns](#cache-update-patterns)
2. [Optimistic Responses](#optimistic-responses)
3. [Error Handling](#error-handling)
4. [Subscriptions](#subscriptions)
5. [Fetch Policies](#fetch-policies)
6. [Query Data Preservation](#query-data-preservation)
7. [Version Conflicts](#version-conflicts)
8. [Decision Trees](#decision-trees)
9. [Apollo Client 4.x Notes](#apollo-client-4x-notes)

---

## Cache Update Patterns

### Pattern 1: cache.modify() - For Array Operations ⭐ PREFERRED

**Use When**: Adding or removing items from a list/array field in the cache

**Benefits**:
- Type-safe with `readField` and `toReference`
- Works with normalized cache
- Prevents duplicates
- Most flexible for complex updates

**Example - Adding to Array**:
```typescript
const [addItemMutation] = useAddItemMutation({
  update: (cache, { data }) => {
    if (!data?.addItem) return;

    cache.modify({
      fields: {
        items(existingItems = [], { readField, toReference }) {
          const newItemRef = toReference(data.addItem);

          // Check if item already exists
          const exists = existingItems.some(
            itemRef => readField('id', itemRef) === data.addItem.id
          );

          if (exists) return existingItems;

          // Add new item to the list
          return [...existingItems, newItemRef];
        },
      },
    });
  },
});
```

**Example - Removing from Array**:
```typescript
const [deleteItemMutation] = useDeleteItemMutation({
  update: (cache, { data }, { variables }) => {
    if (!data?.deleteItem) return;

    const itemId = variables.id;

    // Remove from array
    cache.modify({
      fields: {
        items(existingItems = [], { readField }) {
          return existingItems.filter(
            itemRef => readField('id', itemRef) !== itemId
          );
        },
      },
    });

    // Evict the entity
    cache.evict({
      id: cache.identify({ __typename: 'Item', id: itemId }),
    });

    // IMPORTANT: Always garbage collect after eviction
    cache.gc();
  },
});
```

---

### Pattern 2: Automatic Normalization - For Entity Updates ⭐ IDEAL

**Use When**: Mutation returns a full fragment with `__typename` and `id`

**Benefits**:
- Zero boilerplate code
- Apollo automatically merges based on __typename + id
- Can't make mistakes

**Example**:
```typescript
const [updateItemMutation] = useUpdateItemMutation({
  // No update function needed!
  // Apollo automatically merges the returned entity into cache
  optimisticResponse: variables => ({
    __typename: 'Mutation',
    updateItem: enhanceWithVersion(currentItem, variables.input),
  }),
});
```

**Requirements**:
- Mutation must return full fragment (not just `id` or `boolean`)
- Fragment must include `__typename` and `id`
- Object must already exist in cache

> **AC 4.0 Note**: The `addTypename` option was removed from `InMemoryCache` in Apollo Client 4.0 — `__typename` is now **always** injected into outgoing queries automatically. This makes normalization more reliable since it can no longer be accidentally disabled. If mutation variables include `__typename` fields that your server rejects, add `RemoveTypenameFromVariablesLink` to your link chain.

---

### Pattern 3: cache.writeQuery() - For Full Query Replacements

**Use When**: Replacing an entire query result (e.g., setting default home)

**Example**:
```typescript
const [setDefaultMutation] = useSetDefaultMutation({
  update: (cache, { data }) => {
    if (!data?.setDefault) return;

    cache.writeQuery({
      query: GetDefaultDocument,
      data: {
        getDefault: data.setDefault,
      },
    });
  },
});
```

---

### Pattern 4: cache.evict() + cache.gc() - For Deletions

**Use When**: Removing an entity from the cache permanently

**Requirements**:
- **ALWAYS** call `cache.gc()` after `cache.evict()`
- Remove from parent arrays using `cache.modify()` first
- Then evict the entity itself

**Example**:
```typescript
update: (cache, { data }, { variables }) => {
  const itemId = variables.id;

  // Step 1: Remove from parent array
  cache.modify({
    fields: {
      items(existingItems = [], { readField }) {
        return existingItems.filter(ref => readField('id', ref) !== itemId);
      },
    },
  });

  // Step 2: Evict the entity
  cache.evict({
    id: cache.identify({ __typename: 'Item', id: itemId }),
  });

  // Step 3: CRITICAL - Garbage collect orphaned data
  cache.gc();
}
```

---

### Pattern 5: cache.modify() - For Simple Field Updates ⭐ RECOMMENDED

**Use When**: Updating specific fields on an entity (e.g., toggling booleans, incrementing counters)

**Benefits**:
- Instant UI updates without optimistic response complexity
- Eliminates "Missing field" warnings from partial fragments
- Simpler code - no fragment reading or field extraction needed
- Works perfectly offline (cache update is immediate)
- Avoids cache corruption from `__ref` fields

**When to Use This Instead of Optimistic Response**:
- Simple field updates (boolean toggles, counters, timestamps)
- When mutation fragment has many fields but you're only updating 1-2
- When you're getting "Missing field" warnings from partial optimistic responses
- When automatic normalization isn't sufficient (need immediate feedback)

**Example - Toggle Boolean Field**:
```typescript
const [togglePurchasedMutation] = useToggleShoppingListItemPurchasedMutation({
  errorPolicy: 'all',
  // Use cache.modify in update function for instant UI updates
  // This avoids "Missing field" warnings from partial fragments
  update(cache, { data }, { variables }) {
    if (!data?.toggleShoppingListItemPurchased || !variables) return;

    const itemId = variables.id;
    const newStatus = variables.purchased;

    // Directly modify the cached item's fields
    cache.modify({
      id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
      fields: {
        isPurchased() {
          return newStatus;
        },
        updatedAt() {
          return new Date().toISOString();
        },
      },
    });
  },
  onError: error => {
    const { message } = handleApolloError(error, {
      operation: 'Toggle Item Purchased',
    });
    Alert.alert('Error', message);
  },
});

// Usage in the action function
const toggleItem = async (itemId: string) => {
  const currentItem = items.find(item => item.id === itemId);
  if (!currentItem) return false;

  const newStatus = !currentItem.isPurchased;

  const result = await togglePurchasedMutation({
    variables: {
      id: itemId,
      purchased: newStatus,
      version: currentItem.version,
    },
    // No optimisticResponse - cache.modify handles instant UI
  });

  return result.data?.toggleShoppingListItemPurchased ?? false;
};
```

**Example - Increment Counter**:
```typescript
const [incrementViewsMutation] = useIncrementViewsMutation({
  errorPolicy: 'all',
  update(cache, { data }, { variables }) {
    if (!data?.incrementViews || !variables) return;

    cache.modify({
      id: cache.identify({ __typename: 'Recipe', id: variables.id }),
      fields: {
        viewCount(existingCount = 0) {
          return existingCount + 1;
        },
        lastViewedAt() {
          return new Date().toISOString();
        },
      },
    });
  },
});
```

**Why This Pattern Works**:
1. **Instant UI feedback**: cache.modify executes immediately, updating the UI before server responds
2. **No fragment complexity**: Don't need to read full fragments or extract fields
3. **No validation warnings**: Apollo doesn't validate field completeness in cache.modify
4. **Offline-first**: Works seamlessly with offline queue (cache updates locally, mutation queues)
5. **Type-safe field updates**: Modify only the fields that changed

**Comparison with Optimistic Response Pattern**:

❌ **Old Pattern (Optimistic Response)**:
```typescript
// Complex: Read fragment, extract fields, create optimistic response
const fullItem = client.readFragment<any>({
  id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
  fragment: ShoppingListItemFragmentDoc,
  fragmentName: 'ShoppingListItemFragment',
});

const coreFields: ShoppingListItemCoreFragment = {
  __typename: 'ShoppingListItem',
  id: fullItem.id,
  itemName: fullItem.itemName,
  // ... extract 8+ fields manually
};

await toggleMutation({
  variables: { id: itemId, purchased: newStatus },
  optimisticResponse: {
    __typename: 'Mutation',
    togglePurchased: {
      ...coreFields,
      isPurchased: newStatus,
    } as any,
  },
});
// Result: Works, but gets ~30 "Missing field" warnings
```

✅ **New Pattern (cache.modify)**:
```typescript
// Simple: Just call mutation, let cache.modify handle UI update
await toggleMutation({
  variables: { id: itemId, purchased: newStatus },
  // No optimisticResponse needed!
});
// Result: Zero warnings, instant UI update, simpler code
```

**When NOT to Use This Pattern**:
- Creating new entities (use optimistic response with `createOptimisticEntity`)
- Complex updates involving multiple related entities (use optimistic response)
- When mutation returns incomplete data and you need to preserve existing fields (use optimistic response)
- Array operations (use cache.modify with `readField`/`toReference` pattern instead)

---

### refetchQueries Guidance

**Prefer cache updates** (`cache.modify()`, automatic normalization) over `refetchQueries` for offline-critical paths. Cache updates are instant, work offline, and avoid extra network requests.

However, `refetchQueries` is **acceptable** when:
- The query is not on an offline-critical path (e.g., recipe search, analytics)
- Manual cache updates would be disproportionately complex for the mutation's return shape
- The mutation affects many queries and cache normalization alone isn't sufficient

**Current usage**: 13 files use `refetchQueries` (recipe, mealPlan, profile, onBoarding screens). These are acceptable because they target non-offline-critical flows where the complexity of manual cache updates outweighs the benefit.

**When to migrate away from refetchQueries**:
- Shopping list or pantry paths (offline-first, performance-critical)
- Frequently-triggered mutations where the extra network round-trip is noticeable

```typescript
// ⚠️ AVOID on offline-critical paths
const [updateMutation] = useUpdateMutation({
  refetchQueries: [{ query: GetItemsDocument }],
});

// ✅ PREFERRED - Use cache.modify or automatic normalization
const [updateMutation] = useUpdateMutation({
  // Option 1: Let Apollo auto-merge (if mutation returns full fragment)
  // No update function needed!

  // Option 2: Manual cache update if needed
  update: (cache, { data }) => {
    // Use cache.modify() pattern shown above
  },
});
```

---

## Optimistic Responses

### When to Use

**Provide optimistic responses** for mutations that:
- Create or update user data
- Are frequently used
- Need instant UI feedback
- Work offline

**For delete operations**: Optimistic responses are optional. The `update` function with manual cache updates (cache.modify + cache.evict + cache.gc) provides sufficient instant UI feedback for both online and offline scenarios. Using optimistic responses with deletes can cause cache normalization warnings when the response doesn't include all fragment fields.

### Pattern: New Entity (Create/Add)

```typescript
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';

optimisticResponse: variables => {
  const tempId = `temp-${generateId()}`;

  return {
    __typename: 'Mutation',
    addItem: {
      ...createOptimisticEntity('Item', tempId, {
        name: variables.input.name,
        quantity: variables.input.quantity || 1,
        isPurchased: false,
        // ... other required fields
      }),
      __typename: 'Item',
    } as any,
  };
}
```

### Pattern: Update Existing Entity

```typescript
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';

optimisticResponse: variables => {
  const currentItem = items.find(item => item.id === variables.id);

  if (!currentItem) {
    // Fallback for edge case
    return {
      __typename: 'Mutation',
      updateItem: {
        __typename: 'Item',
        id: variables.id,
        version: 1,
        updatedAt: new Date().toISOString(),
        ...variables.input,
      } as any,
    };
  }

  // Use version-aware helper (keeps current version, updates timestamp)
  const optimisticUpdate = enhanceWithVersion(
    currentItem as any,
    variables.input
  );

  return {
    __typename: 'Mutation',
    updateItem: optimisticUpdate as any,
  };
}
```

### Pattern: Toggle/Boolean Update

```typescript
optimisticResponse: variables => {
  const currentItem = items.find(item => item.id === variables.id);

  return {
    __typename: 'Mutation',
    togglePurchased: enhanceWithVersion(
      currentItem as any,
      { isPurchased: variables.purchased }
    ) as any,
  };
}
```

### Pattern: Delete Entity (No Optimistic Response)

**Recommended**: Use manual cache updates without optimistic response

```typescript
const [deleteItemMutation] = useDeleteItemMutation({
  errorPolicy: 'all',
  onError: (error: any) => {
    const { message } = handleApolloError(error, {
      operation: 'Delete Item',
    });
    Alert.alert('Error', message);
  },
  // No optimisticResponse - avoids cache normalization warnings
  // The cache update below provides instant UI feedback
  update: (cache: any, { data }: any, { variables }: any) => {
    if (!data?.deleteItem || !variables) return;

    try {
      const itemId = variables.id;

      // Step 1: Remove from parent array
      cache.modify({
        fields: {
          items(existingItems = [], { readField }: any) {
            return existingItems.filter(
              (itemRef: any) => readField('id', itemRef) !== itemId,
            );
          },
        },
      });

      // Step 2: Evict the entity from cache
      cache.evict({
        id: cache.identify({ __typename: 'Item', id: itemId }),
      });

      // Step 3: CRITICAL - Garbage collect orphaned data
      cache.gc();
    } catch (error) {
      console.warn('Cache update failed, will refetch:', error);
      refetch();
    }
  },
});
```

**Why this works**:
- Manual cache updates execute immediately (both online and offline)
- Item disappears from UI instantly via cache.modify()
- Entity is fully removed via cache.evict() + cache.gc()
- Avoids cache normalization warnings from incomplete optimistic responses
- Works seamlessly with offline queue (mutations are queued, cache updates happen immediately)

---

## Error Handling

### Standard Error Pattern

```typescript
import { useErrorService } from '#/services/errorService';

const { handleApolloError } = useErrorService();

const [mutation] = useMutation({
  errorPolicy: 'all', // Allow partial data and cache on errors
  onError: (error: any) => {
    const { message } = handleApolloError(error, {
      operation: 'Operation Name',
    });
    Alert.alert('Error', message);
  },
});
```

### `useErrorService` Full API

The `useErrorService()` hook exposes the following methods:

| Method | Description |
|--------|-------------|
| `handleApolloError(error, config)` | Parse Apollo error → flat `{ code, message, category, shouldRetry, isAuthError }` |
| `parseApolloError(error, config)` | Parse Apollo error → structured `ErrorResult` with `success` flag |
| `handleMutation(fn, config)` | Wrap an async mutation with try/catch, returns `ErrorResult<T>` |
| `handleMutationWithVersionConflict(fn, config)` | Like `handleMutation` but adds `isVersionConflict` flag |
| `getUserFriendlyMessage(errorCode)` | Map error code to user-facing string |
| `getErrorCategory(errorCode)` | Map error code prefix to category (e.g., `AUTH_` → `"Authentication"`) |
| `shouldRetry(errorCode)` | Whether the error is retryable (timeouts, rate limits, etc.) |
| `isAuthError(errorCode)` | Whether the error is auth/authz related |
| `reportError(error, context)` | Log a non-Apollo error to console + Telemetry |
| `getErrorMessage(error)` | Extract a user-friendly message from any error |

### Version Conflict Handling

```typescript
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';

const [updateMutation] = useUpdateMutation({
  errorPolicy: 'all',
  onError: (error: any) => {
    // Handle version conflicts first
    if (handleVersionConflict(error)) {
      Alert.alert('Item Updated', getVersionConflictMessage(error), [
        { text: 'Refresh', onPress: () => refetch() },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    // Then handle other errors
    const { message } = handleApolloError(error, {
      operation: 'Update Item',
    });
    Alert.alert('Error', message);
  },
});
```

---

## Subscriptions

### Pattern: Standard Subscription

```typescript
import { useStandardSubscription } from '#/hooks/apollo/useStandardSubscription';

// Simple usage (no logging, auto cache updates)
const subscriptionOptions = useStandardSubscription({
  operation: 'Shopping List Subscription',
  enableLogging: false,
});

useShoppingListItemsChangedSubscription({
  variables: { listId },
  skip: !listId,
  ...subscriptionOptions,
});
```

### Pattern: Advanced Subscription (with deduplication)

```typescript
import { useStandardSubscription } from '#/hooks/apollo/useStandardSubscription';
import { useAuth } from '#/hooks/auth/useAuth';

const { user } = useAuth();

const subscriptionOptions = useStandardSubscription({
  userId: user?.id, // Enable deduplication
  operation: 'Pantry Subscription',
  entityId: pantryId,
  enableLogging: true, // Dev mode logging
  onData: ({ data }) => {
    // Custom handling after deduplication
    console.log('Subscription update:', data);
  },
});

usePantryItemsChangedSubscription({
  variables: { pantryId },
  skip: !pantryId,
  ...subscriptionOptions,
});
```

---

## Fetch Policies

### Use Hardcoded Policies for Stability

**IMPORTANT:** Do NOT use dynamic fetch policies like `useOfflinePresetPolicy()`. They subscribe to store state (`store.isOnline`) and cause query cascade when network status changes during app initialization.

#### Recommended Pattern

```typescript
// ✅ CORRECT - Hardcoded policies prevent query cascade
const { data } = useGetItemsQuery({
  fetchPolicy: 'cache-and-network',  // Shows cache immediately, fetches fresh in background
  nextFetchPolicy: 'cache-first',     // Prevents re-fetch on re-render/tab switch
  errorPolicy: 'all',                 // Returns cached data on network errors
});
```

#### Policy Guidelines

| Query Type | fetchPolicy | nextFetchPolicy | Why |
|------------|-------------|-----------------|-----|
| **Lists** | `'cache-and-network'` | `'cache-first'` | Fresh data + no cascade |
| **Details** | `'cache-and-network'` | `'cache-first'` | Fresh data after mutations |
| **Selectors** | `'cache-and-network'` | `'cache-first'` | Fresh options when opened |

#### Why NOT useOfflinePresetPolicy

```typescript
// ❌ BROKEN - causes query cascade
import { useOfflinePresetPolicy } from '#/apollo/policies/offlineFetchPolicies';
const fetchPolicy = useOfflinePresetPolicy('LIST');

// This subscribes to store.isOnline:
// 1. Network status changes during app init
// 2. fetchPolicy value changes ('cache-and-network' → 'cache-only')
// 3. Apollo sees "options changed"
// 4. Query re-fires (3x GetHomes, 3x GetShoppingLists)
```

#### Offline Handling

Instead of dynamic policies, handle offline gracefully via:
- `errorPolicy: 'all'` or `'ignore'` - Returns cached data when network fails
- `usePreservedArrayData()` - Preserves last successful data across renders
- `nextFetchPolicy: 'cache-first'` - Prevents re-fetches on subsequent renders

---

## Query Data Preservation

### Problem: Cascade Failures on Network Errors

When queries with `errorPolicy: 'ignore'` fail, they return `undefined` instead of preserving cached data. This causes **cascade failures** where dependent components lose their data and become unusable.

**Example of the Problem**:
```typescript
// Query fails due to network error
const { data } = useGetHomesQuery({
  errorPolicy: 'ignore', // Intended to return cached data
});

// ❌ data?.homes is undefined (not cached data!)
const homes = data?.homes; // undefined

// Cascade failure: all dependent code breaks
const defaultHome = homes?.find(h => h.isDefault); // undefined
const pantryId = defaultHome?.pantries[0]?.id; // undefined
// Result: entire screen becomes empty
```

> **AC 4.0 Improvement**: In Apollo Client 4.0, network errors now respect `errorPolicy`. With `errorPolicy: 'ignore'`, network errors are **suppressed** (not thrown), which partially addresses the cascade failure described above. However, `usePreservedArrayData` remains valuable as a defensive fallback for the **initial-load-failure** case — where no cached data exists yet and the first network request fails, `data` is still `undefined` regardless of `errorPolicy`.

### Solution: usePreservedArrayData Hook

The `usePreservedArrayData` hook preserves the last successful query result using a ref, preventing cascade failures.

```typescript
import { usePreservedArrayData } from '#/hooks/apollo';

const { data } = useGetHomesQuery({
  fetchPolicy: 'cache-and-network',
  errorPolicy: 'ignore', // Return cached data on network errors
});

// ✅ Preserve the last successful value
const homes = usePreservedArrayData(data?.homes);
// homes will NEVER be undefined after first load
// On network errors, it keeps the last successful value
```

### How It Works

```typescript
// Implementation (you don't need to write this, it's already available)
export function usePreservedArrayData<T>(
  currentData: T[] | undefined | null
): T[] {
  const lastSuccessfulValue = useRef<T[]>([]);

  return useMemo(() => {
    if (currentData !== undefined && currentData !== null) {
      lastSuccessfulValue.current = currentData;
      return currentData;
    }
    return lastSuccessfulValue.current;
  }, [currentData]);
}
```

### When to Use

**ALWAYS** use `usePreservedArrayData` for queries that:
- Have `errorPolicy: 'ignore'` (prevents cascade failures)
- Return array data (homes, items, lists, etc.)
- Are used by dependent components/hooks
- Need to work reliably during network issues

### Pattern: Standard Query Hook

```typescript
import { usePreservedArrayData } from '#/hooks/apollo';

export function useShoppingListManagement(listId: string | undefined) {
  const { data, loading, error, refetch } = useGetShoppingListItemsQuery({
    variables: { shoppingListId: listId ?? '' },
    skip: !listId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'ignore', // Return cached data on network errors
  });

  // ✅ Preserve items even when query fails
  const items = usePreservedArrayData(data?.shoppingListItems);

  // Now items is ALWAYS an array (never undefined)
  return {
    items,
    loading,
    error,
    refetch,
  };
}
```

### Pattern: Selector Hook (Multiple Queries)

```typescript
import { usePreservedArrayData } from '#/hooks/apollo';

export const useItemSelector = ({ type }: { type: 'pantry' | 'home' }) => {
  const { data: pantryData } = useGetPantriesQuery({
    skip: type !== 'pantry',
    errorPolicy: 'ignore',
  });

  const { data: homeData } = useGetHomesQuery({
    skip: type !== 'home',
    errorPolicy: 'ignore',
  });

  // ✅ Preserve both data sources
  const pantries = usePreservedArrayData(pantryData?.pantries);
  const homes = usePreservedArrayData(homeData?.homes);

  const getData = () => {
    switch (type) {
      case 'pantry':
        return pantries; // Always an array
      case 'home':
        return homes; // Always an array
      default:
        return [];
    }
  };

  return {
    data: getData(),
  };
};
```

### Benefits

✅ **Prevents Cascade Failures**: Dependent components never lose their data
✅ **Offline-First**: Works seamlessly when network is unreliable
✅ **Better UX**: No flash of empty content during refetch/errors
✅ **Consistent Pattern**: Same approach across entire app
✅ **Simple API**: Just wrap your data with `usePreservedArrayData`

### Files Using This Pattern

- ✅ `useShoppingListManagement.ts` (Priority 1)
- ✅ `usePantryManagement.ts` (Priority 1)
- ✅ `usePantryItems.ts` (Priority 1)
- ✅ `useStorageLocationManagement.ts` (Priority 2)
- ✅ `useItemSelector.ts` (Priority 2)
- ✅ `useHomeManagement.ts` (Priority 3)
- ✅ `useDefaultHome.ts` (Priority 3)

### For Non-Array Data

For single objects (not arrays), use `usePreservedQueryData`:

```typescript
import { usePreservedQueryData } from '#/hooks/apollo';

const { data } = useGetUserProfileQuery({
  errorPolicy: 'ignore',
});

// Preserve single object
const profile = usePreservedQueryData(
  data?.userProfile,
  { name: '', email: '' } // Initial value
);
```

---

## Version Conflicts

### How It Works

The app uses **optimistic versioning** for conflict resolution:

1. Each mutable entity has a `version` field
2. Client sends current version with updates
3. Server increments version on successful update
4. If versions don't match → conflict detected
5. User sees friendly message with option to refresh

### Client Implementation

```typescript
// 1. Send version with mutation
const currentItem = items.find(item => item.id === itemId);

await updateMutation({
  variables: {
    id: itemId,
    input: { ...updates },
    version: currentItem?.version, // Include current version
  },
});

// 2. Handle version conflict in onError
onError: (error: any) => {
  if (handleVersionConflict(error)) {
    Alert.alert('Item Updated', getVersionConflictMessage(error), [
      { text: 'Refresh', onPress: () => refetch() },
      { text: 'Cancel', style: 'cancel' },
    ]);
    return;
  }
  // ... other error handling
}
```

### Server Requirements

For the server to support version conflicts, mutations must:
1. Accept `version` as an optional input parameter
2. Check version matches before updating
3. Return version conflict error if mismatch
4. Increment version on successful update

---

## Decision Trees

### "Which Cache Update Pattern Should I Use?"

```
START
  │
  ├─ Is this a DELETE operation?
  │   └─ YES → Use cache.evict() + cache.gc() + cache.modify()
  │
  ├─ Is this a SIMPLE FIELD UPDATE (toggle, counter, timestamp)?
  │   └─ YES → Use cache.modify() for specific fields (Pattern 5)
  │               [Instant UI, zero warnings, no optimistic response needed]
  │
  ├─ Is this adding/removing from an ARRAY?
  │   └─ YES → Use cache.modify() with readField/toReference (Pattern 1)
  │
  ├─ Does mutation return FULL FRAGMENT with __typename + id?
  │   └─ YES → Use AUTOMATIC NORMALIZATION (Pattern 2 - no update function!)
  │
  ├─ Are you replacing an ENTIRE QUERY result?
  │   └─ YES → Use cache.writeQuery() (Pattern 3)
  │
  └─ DEFAULT → Use cache.modify() (most flexible)
```

### "Should I Add an Optimistic Response?"

```
START
  │
  ├─ Is this a READ-ONLY query?
  │   └─ YES → NO (queries don't have optimistic responses)
  │
  ├─ Is this a SIMPLE FIELD UPDATE (toggle, counter)?
  │   └─ YES → NO - Use cache.modify() instead (Pattern 5)
  │               [Simpler, zero warnings, instant UI feedback]
  │
  ├─ Is this a DELETE operation?
  │   └─ YES → NO - cache.modify + evict + gc provides instant UI
  │
  ├─ Is this a frequently-used mutation (create/update)?
  │   └─ YES → ADD OPTIMISTIC RESPONSE
  │
  ├─ Does this need to work offline?
  │   └─ YES → ADD OPTIMISTIC RESPONSE
  │
  ├─ Is instant UI feedback important?
  │   └─ YES → ADD OPTIMISTIC RESPONSE
  │
  └─ DEFAULT → ADD OPTIMISTIC RESPONSE (it's almost always worth it!)
```

### "Which Fetch Policy Should I Use?"

```
START
  │
  ├─ Is this a list/collection?
  │   └─ YES → fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first'
  │
  ├─ Is this a detail view?
  │   └─ YES → fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first'
  │
  ├─ Is this a selector/picker?
  │   └─ YES → fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first'
  │
  └─ DEFAULT → fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first'

NOTE: Always use hardcoded policies. Do NOT use useOfflinePresetPolicy() - it causes query cascade.
```

---

## Quick Reference

### Imports You'll Need

```typescript
// Cache update utilities
import { useApolloClient } from '@apollo/client';

// Query data preservation (IMPORTANT: Always use for array queries!)
import {
  usePreservedArrayData,
  usePreservedQueryData,
} from '#/hooks/apollo';

// Optimistic response helpers
import {
  createOptimisticEntity,
  enhanceWithVersion,
} from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';

// Error handling
import { useErrorService } from '#/services/errorService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';

// Fetch policies - use hardcoded values, NOT useOfflinePresetPolicy
// fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first', errorPolicy: 'all'

// Subscriptions
import { useStandardSubscription } from '#/hooks/apollo/useStandardSubscription';
```

### Common Mistakes to Avoid

❌ **Don't**: Use `const items = data?.items ?? []` for query results
✅ **Do**: Use `const items = usePreservedArrayData(data?.items)` to prevent cascade failures

❌ **Don't**: Default to `refetchQueries` for offline-critical paths
✅ **Do**: Prefer `cache.modify()` or automatic normalization (see [refetchQueries guidance](#refetchqueries-guidance))

❌ **Don't**: Forget `cache.gc()` after `cache.evict()`
✅ **Do**: Always call `cache.gc()` after eviction

❌ **Don't**: Use dynamic fetch policies like `useOfflinePresetPolicy()` (causes query cascade)
✅ **Do**: Use hardcoded `'cache-and-network'` with `nextFetchPolicy: 'cache-first'`

❌ **Don't**: Skip optimistic responses on frequently-used mutations
✅ **Do**: Add optimistic responses for instant UI feedback

❌ **Don't**: Ignore version conflicts
✅ **Do**: Handle version conflicts with user-friendly messages

---

## Examples by Use Case

### Example 1: Simple List Item Addition

```typescript
const [addItemMutation] = useAddItemMutation({
  errorPolicy: 'all',
  // Optimistic response for instant feedback
  optimisticResponse: variables => ({
    __typename: 'Mutation',
    addItem: {
      ...createOptimisticEntity('Item', `temp-${generateId()}`, {
        name: variables.input.name,
        isPurchased: false,
      }),
      __typename: 'Item',
    } as any,
  }),
  // Cache update to add to array
  update: (cache, { data }) => {
    if (!data?.addItem) return;

    cache.modify({
      fields: {
        items(existingItems = [], { readField, toReference }) {
          const newItemRef = toReference(data.addItem);
          const exists = existingItems.some(
            ref => readField('id', ref) === data.addItem.id
          );
          if (exists) return existingItems;
          return [...existingItems, newItemRef];
        },
      },
    });
  },
  onError: error => {
    const { message } = handleApolloError(error, { operation: 'Add Item' });
    Alert.alert('Error', message);
  },
});
```

### Example 2: Update with Version Conflict Handling

```typescript
const [updateItemMutation] = useUpdateItemMutation({
  errorPolicy: 'all',
  optimisticResponse: variables => ({
    __typename: 'Mutation',
    updateItem: enhanceWithVersion(currentItem, variables.input) as any,
  }),
  onError: (error: any) => {
    if (handleVersionConflict(error)) {
      Alert.alert('Item Updated', getVersionConflictMessage(error), [
        { text: 'Refresh', onPress: () => refetch() },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const { message } = handleApolloError(error, { operation: 'Update Item' });
    Alert.alert('Error', message);
  },
});
```

### Example 3: Delete with Proper Cleanup

```typescript
const [deleteItemMutation] = useDeleteItemMutation({
  errorPolicy: 'all',
  update: (cache, { data }, { variables }) => {
    if (!data?.deleteItem) return;

    const itemId = variables.id;

    // Remove from parent array
    cache.modify({
      fields: {
        items(existingItems = [], { readField }) {
          return existingItems.filter(ref => readField('id', ref) !== itemId);
        },
      },
    });

    // Evict entity
    cache.evict({
      id: cache.identify({ __typename: 'Item', id: itemId }),
    });

    // CRITICAL: Garbage collect
    cache.gc();
  },
  onError: error => {
    const { message } = handleApolloError(error, { operation: 'Delete Item' });
    Alert.alert('Error', message);
  },
});
```

---

## Simplified Patterns (2025 Update)

This section documents simplified patterns adopted to reduce complexity and improve consistency.

### Use Items Array Instead of Cache Reads

When you need to access an item before a mutation, prefer using the items array already in memory over reading from the cache.

**Old Pattern (avoid):**
```typescript
const cachedItem = client.readFragment<ItemFragment>({
  id: cache.identify({ __typename: 'Item', id: itemId }),
  fragment: ItemFragmentDoc,
  fragmentName: 'ItemFragment',
});
```

**New Pattern (preferred):**
```typescript
// Items array is already in memory from the query
const item = items.find(i => i.id === itemId);
if (!item) return false;

// Use item directly for optimistic response
optimisticResponse: {
  __typename: 'Mutation',
  updateItem: {
    ...item,
    ...updates,
  },
}
```

**Why:** The items array is already in memory from the query. Reading from cache adds complexity without benefit and can fail if the item isn't in cache.

### When to Use Each Cache Update Approach

| Operation | Cache Update Needed? | Use This |
|-----------|---------------------|----------|
| **Create/Add** | YES | `createAddToParentConnectionUpdater()` |
| **Update** | NO | Apollo auto-normalizes by `__typename` + `id` |
| **Delete/Remove** | YES | `createRemoveFromParentConnectionUpdater()` |
| **Toggle field** | Optional | `cache.modify()` for instant UI (Pattern 5) |

### When to Use optimisticDataPersistence

**Only use for rapid UI operations** like quantity steppers where:
- User makes multiple rapid changes (increment/decrement)
- Changes happen faster than network round-trips
- Field-level persistence is needed for offline support

**Current valid usage:** `useShoppingListActions.ts` for quantity increment/decrement.

**Don't use for:** Standard CRUD operations (Apollo cache persistence handles this).

### When Subscriptions Need Manual writeFragment

When using custom `onData` callbacks with `CacheStrategy.NONE`, you should explicitly write entity updates to cache:

```typescript
customOnData: (payload, client) => {
  if (mutation === 'UPDATE') {
    // Write the updated entity to cache
    client.cache.writeFragment({
      id: client.cache.identify({ __typename: 'Item', id: item.id }),
      fragment: ItemFragmentDoc,
      data: item,
    });
  }
}
```

If you don't use custom `onData` (let Apollo handle it with `CacheStrategy.AUTOMATIC`), this isn't needed.

### Pattern: Subscription Updates for Filtered Connections ⭐ IMPORTANT

When items need to move between filtered connections (e.g., `unpurchasedItems` → `purchasedItems`), use the **mutation type** to determine cache operations instead of comparing old vs new values.

**Why?** Apollo auto-normalizes subscription data, which updates entity fields (like `isPurchased`). However, this normalization happens **before** the `onData` callback runs, so comparing old vs new values will show them as equal (both already updated). Use the mutation type instead.

**Pattern (from `usePantrySubscriptions.ts` and `useShoppingListSubscriptions.ts`):**
```typescript
customOnData: (payload, client) => {
  const mutation = payload.mutation;
  const item = payload.item;

  // Use mutation type directly - don't compare old vs new values (race condition)
  if (mutation === MutationType.ITEM_COMPLETED) {
    // Move from unpurchased to purchased connection
    removeFromUnpurchasedItems(client.cache, parentId, item.id);
    addToPurchasedItems(client.cache, parentId, item);
  } else if (mutation === MutationType.ITEM_UNCOMPLETED) {
    // Move from purchased to unpurchased connection
    removeFromPurchasedItems(client.cache, parentId, item.id);
    addToUnpurchasedItems(client.cache, parentId, item);
  } else if (mutation === MutationType.UPDATE || mutation === 'ITEM_UPDATED') {
    // Simple field update - just writeFragment
    client.cache.writeFragment({ ... });
  }
}
```

**Key points:**
- Apollo auto-normalizes **entity field updates** but does NOT move items between filtered connections
- Use the mutation type (`ITEM_COMPLETED`, `ITEM_UNCOMPLETED`, etc.) to know what action occurred
- This pattern aligns with how Relay handles connection updates with declarative mutation directives

**Reference implementations:**
- `src/hooks/subscriptions/usePantrySubscriptions.ts` (lines 80-126)
- `src/hooks/subscriptions/useShoppingListSubscriptions.ts` (lines 80-239)

---

## Reusable Utilities Reference

### Cache Updaters (`src/apollo/utils/cacheUpdaters.ts`)

Use these utilities instead of writing inline `cache.modify()` logic.

| Utility | Use Case |
|---------|----------|
| `createAddToParentConnectionUpdater` | Add item to parent.connectionField (e.g., Pantry.itemsConnection) |
| `createRemoveFromParentConnectionUpdater` | Remove item from parent.connectionField + optional eviction |
| `createAddToQueryFieldUpdater` | Add item to Query.fieldName array |
| `createRemoveFromQueryFieldUpdater` | Remove item from Query.fieldName array |

**Example Usage:**
```typescript
import { createAddToParentConnectionUpdater } from '#/apollo/utils';

const addToPantryItemsCache = createAddToParentConnectionUpdater<any>(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

// In mutation update function:
update: (cache, { data }) => {
  if (!data?.createPantryItem || !pantryId) return;
  addToPantryItemsCache(cache, pantryId, data.createPantryItem);
}
```

### Optimistic Response Helpers (`src/apollo/utils/createOptimisticResponse.ts`)

| Utility | Use Case |
|---------|----------|
| `createOptimisticEntity(typename, tempId, fields)` | Create temp entity for add mutations |
| `enhanceWithVersion(currentItem, updates)` | Add version/timestamp to update mutations |

### Error Handler Composables (`src/utils/errorHandlers.ts`)

Higher-order functions for wrapping mutations with consistent error handling. Used by `useCrudOperations.ts` and other management hooks.

| Utility | Use Case |
|---------|----------|
| `withVersionConflictHandling(fn, config)` | Wrap mutation with version conflict detection + alert |
| `withMutationErrorHandling(fn, config)` | Wrap mutation with Apollo error reporting + alert |
| `withGenericErrorHandling(fn, msg)` | Wrap mutation with simple error alert |
| `composeErrorHandlers(fn, handlers[])` | Chain multiple error handlers together |
| `handleVersionConflictAlert(error, config)` | Inline version conflict check for try/catch blocks |
| `handleMutationErrorAlert(error, config)` | Inline error alert for try/catch blocks |

**Example**:
```typescript
import { withVersionConflictHandling, withMutationErrorHandling } from '#/utils/errorHandlers';

const safeUpdate = withVersionConflictHandling(
  withMutationErrorHandling(updateFn, { operation: 'Update Item' }),
  { itemName: 'Item', onRefresh: refetch }
);
```

### CRUD Operations (`src/hooks/utils/useCrudOperations.ts`)

Provides standardized CRUD operation wrappers with built-in validation and error handling.

| Helper | Provides |
|--------|----------|
| `createAddOperation` | Input validation, parent ID validation, error alerts |
| `createUpdateOperation` | Version conflict handling, refetch on conflict |
| `createRemoveOperation` | Confirmation dialogs, cleanup |

---

## Apollo Client 4.x Notes

This project uses Apollo Client `^4.1.5`. AC 4.0 introduced several new hooks and APIs that are stable but **intentionally not adopted** in this codebase:

| Hook / API | Purpose | Status |
|------------|---------|--------|
| `useSuspenseQuery` | Suspense-compatible query hook (works with React `<Suspense>`) | Available, **not adopted** |
| `useBackgroundQuery` | Trigger queries in parent, read in child via `useReadQuery` | Available, **not adopted** |
| `useReadQuery` | Read data from a `useBackgroundQuery` queryRef in a child component | Available, **not adopted** (companion to `useBackgroundQuery`) |
| `useFragment` | Subscribe to a specific fragment in cache without a query | Available, not adopted (safe to evaluate) |
| `dataState` | Discriminated union on query results (`{status: 'loading' \| 'error' \| 'complete', data?}`) for type-safe data access | Available, not adopted (would require widespread refactor) |

#### AC 4.0 New Concepts

- **`dataState` property**: AC 4.0 adds a `dataState` discriminated union to query results, allowing pattern matching on `dataState.status` for type-safe data access. Not adopted because the existing `data ?? previousData` pattern is simpler for this codebase's needs.
- **`IGNORE` sentinel for optimistic responses**: AC 4.0 introduces an `IGNORE` value that can be returned from `optimisticResponse` to conditionally skip optimistic updates. Useful when a mutation should only optimistically update under certain conditions.
- **React Native caveats for Suspense hooks**: Beyond the stability issues noted below, Suspense hooks in React Native have a known pull-to-refresh jank issue — triggering a refetch that suspends can cause the scroll position to reset or the pull-to-refresh indicator to get stuck. This is an additional reason to avoid `useSuspenseQuery` in this codebase.

### Why These Are Intentionally Not Adopted

#### `useSuspenseQuery` — Incompatible with Offline-First Architecture

- **Throws errors as exceptions** instead of returning them. This breaks the `errorPolicy: 'all'` + `previousData` fallback pattern used throughout the app. Every network failure would suspend the component tree instead of gracefully degrading.
- **No `previousData` support.** Users would see loading spinners instead of last-known data during refetches. The current pattern keeps the UI populated:
  ```typescript
  const { data, previousData, error } = useQuery({
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });
  const items = data?.items ?? previousData?.items ?? [];
  ```
- **No `skip` option.** Many queries depend on conditional execution (`skip: !listId`, `skip: !user?.id`). `useSuspenseQuery` requires `skipToken` which changes the API surface significantly.
- **React Native Suspense stability issues.** Known bug [facebook/react-native#49129](https://github.com/facebook/react-native/issues/49129): Suspense fallbacks can get stuck showing instead of resolved UI.
- **Error Boundary requirement.** Would require wrapping every query-using component with Error Boundaries, fundamentally changing the error handling architecture from component-level to tree-level.

#### `useBackgroundQuery` + `useReadQuery` — Breaks Optimistic Update Flow

- **Defers data loading**, which conflicts with the synchronous cache-update-then-render pattern used by optimistic responses.
- **Current wrapper hooks already achieve render separation.** Hooks like `useShoppingListScreen()` aggregate queries in a parent, and children receive data as props — providing the same re-render reduction that `useBackgroundQuery` targets.
- **No React Native-specific guidance** from Apollo. Documentation focuses on web patterns with no known-issues coverage for RN.

#### `useFragment` — Safe but Not Currently Needed

- **No offline conflict.** Reads from cache only, never triggers network requests.
- **No Suspense dependency.** Works independently of Suspense boundaries.
- **Potential benefit for list items:** each item could subscribe to its own fragment, re-rendering only when its specific data changes.
- **Current alternatives are sufficient.** FlashList v2 + memoized item components + `mergeArrayByIdIntelligent` cache merging already handle efficient list updates. Re-evaluate only if profiling reveals list re-render bottlenecks.

### When to Re-evaluate

- Apollo releases React Native-specific Suspense guidance with offline-first patterns
- React Native resolves Suspense stability issues ([RN#49129](https://github.com/facebook/react-native/issues/49129))
- Performance profiling shows list re-render bottlenecks — then consider `useFragment` first

### Codegen Compatibility — ⚠️ OUTDATED PLUGIN

The project uses `@graphql-codegen/typescript-react-apollo` (`^4.3.3`) to generate typed hooks. **This plugin is officially declared incompatible with Apollo Client 4.0 by The Guild.** Key issues:

- Generated hook signatures do not align with AC 4.0's new types (`dataState`, new error classes)
- The plugin generates `useSuspenseQuery` variants that don't match AC 4.0's actual API
- The project currently works around this with `@ts-nocheck` on the generated file

**Recommended migration path** (when prioritized):
1. Replace `typescript-react-apollo` with: `typescript` + `typescript-operations` + `typed-document-node` plugins
2. Use `useQuery(TypedDocument, options)` directly instead of generated `useXxxQuery()` hooks
3. This produces `TypedDocumentNode` objects that provide full type inference without wrapper hooks
4. Remove `@ts-nocheck` from the generated file once migrated

### `storeFieldName` Pattern for Filtered Connections

When a single connection field is queried with different argument variants (e.g., `itemsConnection(isPurchased: true)` vs `itemsConnection(isPurchased: false)`), Apollo stores them under the same field name with serialized `keyArgs`. Use `storeFieldName` inside `cache.modify` field functions to distinguish which variant you're updating:

```typescript
cache.modify({
  id: cache.identify({ __typename: 'ShoppingList', id: listId }),
  fields: {
    itemsConnection(existing, { storeFieldName }) {
      const isPurchased = storeFieldName.includes('isPurchased":true');
      // Handle each variant appropriately
    },
  },
});
```

> **Note on `args` vs `storeFieldName`**: The `args` object is available in type policy `read`/`merge` functions but is **not** available in `cache.modify` field modifiers. For `cache.modify`, `storeFieldName` string parsing is the correct approach. The `keyArgs: ['filters']` config on `itemsConnection` ensures each filter variant gets a distinct `storeFieldName`, making `.includes()` checks reliable.

See `src/apollo/utils/shoppingListCacheUpdaters.ts` for the full implementation.

---

## Need Help?

- **Questions about patterns**: Check examples in `src/hooks/shoppingList/useShoppingListItemMutations.ts` (reference implementation)
- **Cache updater utilities**: See `src/apollo/utils/cacheUpdaters.ts`
- **Subscription setup**: See `src/hooks/subscriptions/` and `src/services/subscriptions/SubscriptionService.ts`
- **Fetch policies**: Use hardcoded `'cache-and-network'` with `nextFetchPolicy: 'cache-first'`
- **Error handling**: See `src/services/errorService.ts`, `src/utils/errorHandlers.ts`, and `src/utils/errors/versionConflict.ts`

---

**Last Updated**: 2026-02-25
**Maintainers**: Development Team
