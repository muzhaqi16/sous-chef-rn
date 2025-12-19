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

### ❌ Anti-Pattern: refetchQueries

**DON'T USE** `refetchQueries` unless absolutely necessary!

**Why**:
- Extra network requests (bad for performance)
- Doesn't work offline
- Slower UX (wait for network)
- Goes against offline-first principles

**Migration**:
```typescript
// ❌ BAD - Old refetchQueries pattern
const [updateMutation] = useUpdateMutation({
  refetchQueries: [{ query: GetItemsDocument }],
});

// ✅ GOOD - Use cache.modify or automatic normalization
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
import { useErrorHandler } from '#/utils/errorHandling';

const { handleApolloError } = useErrorHandler();

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
import { useErrorHandler } from '#/utils/errorHandling';
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

❌ **Don't**: Use `refetchQueries`
✅ **Do**: Use `cache.modify()` or automatic normalization

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

## Need Help?

- **Questions about patterns**: Check examples in `src/hooks/shoppingList/useShoppingListManagement.ts` (reference implementation)
- **Subscription setup**: See `src/hooks/apollo/useStandardSubscription.ts`
- **Fetch policies**: See `src/apollo/policies/offlineFetchPolicies.ts`
- **Error handling**: See `src/utils/errorHandling.ts` and `src/utils/errors/versionConflict.ts`

---

**Last Updated**: 2025-11-03
**Maintainers**: Development Team
