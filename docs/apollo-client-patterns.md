# Apollo GraphQL Patterns & Best Practices

This document defines the standardized patterns for using Apollo Client in this application. Following these patterns ensures consistent offline-first behavior, optimal performance, and maintainable code.

---

## Table of Contents

1. [The data layer stays out of what renders](#the-data-layer-stays-out-of-what-renders)
2. [Cache Update Patterns](#cache-update-patterns)
3. [Optimistic Responses](#optimistic-responses)
4. [Error Handling](#error-handling)
5. [Subscriptions](#subscriptions)
6. [Fetch Policies](#fetch-policies)
7. [Query Data Preservation](#query-data-preservation)
8. [Version Conflicts](#version-conflicts)
9. [Decision Trees](#decision-trees)
10. [Fragment Composition & Data Masking](#fragment-composition--data-masking)
11. [Apollo Client 4.x Notes](#apollo-client-4x-notes)

---

## The data layer stays out of what renders

A screen, sheet or list cell gets its data from a hook in its feature's `hooks/`.
It does not import `#/apollo/*` or `@apollo/client`'s operation hooks, hold the
client, or write the cache; an `import/no-restricted-paths` zone in `eslint/`
bans the `src/apollo/**` import.

What a hook HANDS BACK matters as much as what a screen imports: a leaked
`ApolloError` or `NetworkStatus` couples a screen that imports nothing. A hook
returns plain values and callbacks — `loading` as a boolean, an outcome the
caller branches on, named functions — and a mutate wrapper hands back what
`settleMutation` settled (`Settled<TData>`), or its own outcome union, never
Apollo's own result generic. `__tests__/architecture/hookReturnTypes.test.ts` resolves
every feature hook's return type through the checker and fails on a library
type in it or one property down.

`useFragment` and the masking types stay allowed in a cell: with `dataMasking`
on, a cell subscribing to one entity is the documented pattern
([Fragment Composition & Data Masking](#fragment-composition--data-masking)).

---

## Cache Update Patterns

### Choosing a pattern

Pick by what the mutation changes; the numbered patterns below carry the code.

| Pattern                                       | Use when                                                            | Example                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| No `update` callback (preferred default)      | Mutation returns the entity; Apollo normalizes by `__typename + id` | `useAdjustPantryItemQuantity`                                              |
| `cache.modify` on parent aggregates           | Parent stat fields not in the response                              | `useRecipeReviews` (`Pantry.stats` uses its `mergeObjects` policy instead) |
| `cache.modify` BEFORE firing, revert on error | Optimistic UI without a callback                                    | `useToggleShoppingItem`                                                    |
| `updateEntityFieldsLocalFirst`                | Settings-shaped entity whose field names ARE the setting names      | `useAppSettings`, `useNotificationSettings`                                |
| `cache.modify` on connection edges + counts   | Entity moves between filtered connections                           | `moveShoppingListItemTo*` helpers                                          |
| `writeFragment`                               | Subscription push written through                                   | `usePantrySubscriptions`, `useShoppingListSubscriptions`                   |
| `refetchQueries` (last resort)                | Query shape underivable from the response                           | `useHomeSubscriptions`, `usePantryItemDetailActions`                       |

- Build optimistic responses from the cache (`cache.readFragment` + spread),
  never from hand-rolled placeholder shapes. Prefer the
  cache.modify-before-mutation + revert pattern when no callback is needed.
- Avoid `refetchQueries` unless `cache.modify` would duplicate server logic
  ([refetchQueries Guidance](#refetchqueries-guidance)).

### A field with a write-time invariant has one writer

`cache.modify` does not run type-policy merges and cannot introduce a field the
cached record lacks, so a record whose rules live in a merge policy
(`ShoppingListItem.purchaseInfo`) is written through `cache.writeFragment`.
`writePurchaseInfo` is the worked example: it carries the cached record forward,
so the policy's clear-on-flip has nothing to clear on a LOCAL write. A second
writer of such a field — the offline restoration pass — routes through
`src/apollo/utils/fieldWriters.ts` (each feature contributes its entries, e.g.
`src/features/shoppingList/offline/fieldWriters.ts`) rather than merging blind.
Library mechanism:
[`verified-library-behaviour.md` § cache.modify cannot add a field](verified-library-behaviour.md#cachemodify-cannot-add-a-field).

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
            itemRef => readField('id', itemRef) === data.addItem.id,
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
            itemRef => readField('id', itemRef) !== itemId,
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
- Apollo automatically merges based on \_\_typename + id
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
};
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

**The cache.modify form vs an optimisticResponse callback:**

```typescript
// ✅ cache.modify — simple toggle, no callback needed
await toggleMutation({
  variables: { id: itemId, purchased: newStatus },
  // No optimisticResponse — cache.modify in `update` handles instant UI
});
```

Compared to an `optimisticResponse` callback, the cache.modify form skips reading the fragment, skips constructing the response shape, and avoids "Missing field" warnings from partial responses. Reserve `optimisticResponse` for cases that genuinely need the full mutation result shape (e.g. creating an entity that doesn't exist in cache yet — see "Optimistic Responses" section below).

**When NOT to Use This Pattern**:

- Creating new entities (write the entity to the cache permanently before firing — `docs/local-first-architecture.md` § 2)
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

**Where it lives in this codebase**: recipe, meal-plan, profile, home-create, and invitation flows — paths that are not offline-critical and where reproducing the mutation's cache effect would require duplicating server logic (e.g. recomputing aggregate ratings). `grep -rn "refetchQueries" src/` shows the current call sites.

**Don't reach for `refetchQueries` on**:

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

A create writes its entity to the cache PERMANENTLY before firing, under a
client-minted id, and reverts only on a refusal — never an `optimisticResponse`,
which the offline queue's null result tears down (`docs/local-first-architecture.md`
§ 2). `useAddToPantry.addItem` is the worked example: `generateEntityId`, then
`buildOptimisticPantryItem` + `addPantryItemLocally`, then `settleMutation` with
`onFailed` reverting.

### Pattern: Selector Hook (Multiple Queries)

```typescript
import { usePreservedArrayData } from '#/hooks/apollo';

export const useSourceSelector = ({ type }: { type: 'pantry' | 'home' }) => {
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

Used by query-wrapping hooks that need to keep the last-known array stable
across refetch errors. Run `grep -rn "usePreservedArrayData\|usePreservedQueryData" src/`
to find current consumers — at the time of writing this includes
`useDefaultHome`, `useHomeQuery`, `useLazyHomeData`, `useHomeDetailManagement`,
`usePantryQuery`, `useCurrentPantry`, `useStorageLocationManagement`,
`useShoppingListDetails`, `useDietaryProfile`, and
`ShareList`.

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
  { name: '', email: '' }, // Initial value
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

// 2. Settle it: a version conflict offers the caller's refresh
await settleMutation(() => updateMutation({ variables }), {
  document: UpdateItemDocument,
  fallback: t('errors.updateItemFailed'),
  onConflictRefresh: refetch,
});
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

NOTE: These match the global `watchQuery` defaults in `src/apollo/client.ts`, so most call sites don't need to set them. Override only when the query needs to differ.
```

---

## Quick Reference

### Imports You'll Need

```typescript
// Cache update utilities
import { useApolloClient } from '@apollo/client';

// Query data preservation (IMPORTANT: Always use for array queries!)
import { usePreservedArrayData, usePreservedQueryData } from '#/hooks/apollo';

// Optimistic response helpers
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';

// A write's outcome
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';

// Fetch policies — the global watchQuery defaults already cover most cases:
// fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first', errorPolicy: 'all'
// (see src/apollo/client.ts). Override per-query only when needed.

// Subscriptions
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';
```

### Common Mistakes to Avoid

❌ **Don't**: Use `const items = data?.items ?? []` for query results
✅ **Do**: Use `const items = usePreservedArrayData(data?.items)` to prevent cascade failures

❌ **Don't**: Default to `refetchQueries` for offline-critical paths
✅ **Do**: Prefer `cache.modify()` or automatic normalization (see [refetchQueries guidance](#refetchqueries-guidance))

❌ **Don't**: Forget `cache.gc()` after `cache.evict()`
✅ **Do**: Always call `cache.gc()` after eviction

❌ **Don't**: Introduce dynamic, store-subscribed fetch policies — they cause query cascade on network-state changes
✅ **Do**: Rely on the global `watchQuery` defaults in `src/apollo/client.ts`; only override per-query when the policy needs to differ

❌ **Don't**: Let `skip` depend on volatile upstream state without a latch (causes duplicate network requests)
✅ **Do**: Use the [query activation latch](#skip-toggle-pitfall--query-activation-latch) pattern for queries gated on multi-step initialization

❌ **Don't**: Call `refetch()` when query variables already changed (double network request)
✅ **Do**: Let Apollo handle variable-change refetches automatically; use `refetch()` only for same-variable refreshes

❌ **Don't**: Leave a write's change invisible until the server answers
✅ **Do**: Write the change to the cache permanently before firing, and revert it
only on a refusal — never an `optimisticResponse`, which a queued write tears down

❌ **Don't**: Ignore version conflicts
✅ **Do**: Handle version conflicts with user-friendly messages

---

## Examples by Use Case

### Example 1: Simple List Item Addition

```typescript
const [addItemMutation] = useMutation(AddItemDocument, {
  // The server's row replaces the local one, matched by the id it was minted
  // with, so the edge is never duplicated.
  update: (cache, { data }) => {
    const added = appliedPayload(data)?.item;
    if (added) addItemToCache(cache, listId, added);
  },
});

const id = generateEntityId();
// Permanent, before firing: a queued create shows now and survives a restart.
addOptimisticItem(client.cache, listId, buildOptimisticItem(id, input));

const settled = await settleMutation(
  () =>
    addItemMutation({
      variables: { input: { ...input, id } },
      context: { localFirst: true },
    }),
  {
    document: AddItemDocument,
    fallback: t('errors.addItemFailed'),
    onFailed: () => revertOptimisticItem(client.cache, listId, id),
  },
);
```

### Example 2: Update with Version Conflict Handling

```typescript
const [updateItemMutation] = useMutation(UpdateItemDocument);

const settled = await settleMutation(
  () => updateItemMutation({ variables: { input: { ...changes, version } } }),
  {
    document: UpdateItemDocument,
    fallback: t('errors.updateItemFailed'),
    onFailed: revertSnapshot,
    onConflictRefresh: refetch,
  },
);
const updated = appliedPayload(settled.data)?.item;
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
});
```

---

## Reading entities before a mutation

When a mutation hook needs the current entity (e.g. to compute an optimistic response or detect a state change), the source of truth is the cache. Two patterns:

**Hook-owned fragment + cache.readFragment** (preferred for mutation hooks):

```typescript
// Hook declares a colocated `useUpdateX_item.graphql` fragment with the
// fields it needs, then materializes it from cache by entity id.
const item = client.cache.readFragment<UseUpdateX_ItemFragment>({
  id: client.cache.identify({ __typename: 'Item', id: itemId }),
  fragment: UseUpdateX_ItemFragmentDoc,
  fragmentName: 'useUpdateX_item',
});
if (!item) return false;
```

**In-memory array lookup** (acceptable for screens that already have the items in scope):

```typescript
// Screen already has the items array from useQuery — find by id directly.
const item = items.find(i => i.id === itemId);
if (!item) return false;
```

Use the hook-owned fragment form when the caller is a hook that runs outside the screen's render scope (mutation hooks, subscription handlers). Use the array lookup when the caller is a screen-level action handler that already holds the items array.

### Which cache update approach

| Operation         | Cache Update Needed? | Use This                                      |
| ----------------- | -------------------- | --------------------------------------------- |
| **Create/Add**    | YES                  | `createAddToParentConnectionUpdater()`        |
| **Update**        | NO                   | Apollo auto-normalizes by `__typename` + `id` |
| **Delete/Remove** | YES                  | `createRemoveFromParentConnectionUpdater()`   |
| **Toggle field**  | Optional             | `cache.modify()` for instant UI (Pattern 5)   |

### When to Use optimisticDataPersistence

**Only use for rapid UI operations** like quantity steppers where:

- User makes multiple rapid changes (increment/decrement)
- Changes happen faster than network round-trips
- Field-level persistence is needed for offline support

**Current valid usage:** `useShoppingListActions.ts` for quantity increment/decrement.

**Don't use for:** Standard CRUD operations (Apollo cache persistence handles this).

### When Subscriptions Need Manual writeFragment

When using custom `onData` callbacks with `CacheStrategy.NONE`, write entity updates to cache via the subscription handler's own colocated fragment (e.g. `usePantrySubscriptions_pantryItem`, `useShoppingListSubscriptions_item`):

```typescript
customOnData: (payload, client) => {
  if (mutation === 'UPDATE') {
    client.cache.writeFragment({
      id: client.cache.identify({ __typename: 'PantryItem', id: item.id }),
      fragment: UsePantrySubscriptions_PantryItemFragmentDoc,
      fragmentName: 'usePantrySubscriptions_pantryItem',
      data: item,
    });
  }
};
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

- `src/features/pantry/hooks/usePantrySubscriptions.ts`
- `src/features/shoppingList/hooks/useShoppingListSubscriptions.ts`

### Server events, the unread badge, and write scoping

The notification feed, each row's read-state and the unread count live in the
Apollo cache and nowhere else ([architecture.md](architecture.md) § State).
`src/features/notifications/utils/notificationCacheWrites.ts` is the one place
those transitions are applied — by the user acting locally AND by the
subscription handler. The Zustand slice keeps only `pendingExpirationLinks`,
which the cache genuinely cannot hold: `expirationNotificationChanged` can
arrive BEFORE the `notificationChanged` it enriches, when there is no row to
attach it to.

**A local write moves the badge by a delta; a server-delivered event re-reads
it.** Not a style choice — Apollo normalizes a subscription's `node` into the
cache BEFORE `onData` runs (the same ordering as the filtered-connections
pattern above), so by the time a `READ` handler asks "was this unread?", the
event's own payload has already answered "no". The guard that makes a
re-delivered event safe is therefore useless on that path, and a delta would be
wrong in both directions. `useNotificationListener` calls `reseedUnreadCount()`
on every server event instead, which is also the truer number: the badge counts
unread notifications this device has never paged in, so a local ±1 was only
ever an approximation. Verify the ordering claim with a subscription whose
`onData` reads `cache.extract()`.

**`addNotificationToFeed` must scope its write.** `notificationsConnection` is
keyed on `filters` and `cache.modify` runs for EVERY cached variant, so the
`skipStoreField: skipUnmatchedFilterVariants({ category, unreadOnly: true })`
guard is what keeps a pantry notification out of the recipes feed. Both skip
helpers read both `storeFieldName` forms — the colon form an array-`keyArgs`
field is stored under and the paren form of an unkeyed one
(`docs/verified-library-behaviour.md` § Apollo storeFieldName has two serialized
forms) — and `cacheUpdaters.test.ts` captures the real key off `makeCache()`, so
a fixture cannot drift from what Apollo writes.

---

## Reusable Utilities Reference

### Cache Updaters (`src/apollo/utils/cacheUpdaters.ts`)

Use these utilities instead of writing inline `cache.modify()` logic. Connection
variants handle relay-style `{ edges, pageInfo }` wrappers; Array variants
handle plain list fields. Every updater returns whether it changed the cache.
An add takes `{ position?: 'start' | 'end', skipStoreField? }` (connections) or
`{ position? }` (arrays) and always dedupes by id; a remove takes
`{ evictItem? }`, and `evictItem: true` evicts, releases the entity's retains
and gcs in one pass. `totalCount` moves only where the record already holds
one, so an add never introduces a count a later query reads as a cache hit.

**Connection-shaped fields** (`edges` + `pageInfo`):

| Utility                                   | Use Case                                                             |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `createAddToParentConnectionUpdater`      | Add item to `parent.connectionField` (e.g. `Pantry.itemsConnection`) |
| `createRemoveFromParentConnectionUpdater` | Remove item from `parent.connectionField` + optional eviction        |
| `createAddToQueryConnectionUpdater`       | Add item to a root-level `Query.connectionField`                     |
| `createRemoveFromQueryConnectionUpdater`  | Remove item from a root-level `Query.connectionField`                |

**Plain array fields** (no edges wrapper):

| Utility                              | Use Case                                                 |
| ------------------------------------ | -------------------------------------------------------- |
| `createAddToParentArrayUpdater`      | Add item to `parent.arrayField`                          |
| `createRemoveFromParentArrayUpdater` | Remove item from `parent.arrayField` + optional eviction |

**Misc helpers in the same file:** `safeEvict`, `safeEvictMany`,
`adoptServerEntityId`, `releaseEntity`, `setCachedFields`,
`applyOptimisticFragmentPatch`, `skipUnmatchedFilterVariants`,
`skipUnmatchedArgVariants`.

**Example Usage:**

```typescript
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

const addToPantryItemsCache = createAddToParentConnectionUpdater<PantryItem>(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

// In mutation update function:
update: (cache, { data }) => {
  if (!data?.createPantryItem || !pantryId) return;
  addToPantryItemsCache(cache, pantryId, data.createPantryItem);
};
```

### Optimistic Response Helpers (`src/apollo/utils/createOptimisticResponse.ts`)

| Utility                                    | Use Case                                  |
| ------------------------------------------ | ----------------------------------------- |
| `enhanceWithVersion(currentItem, updates)` | Add version/timestamp to update mutations |

### Mutation failure reporting (`src/utils/errorHandlers.ts`)

What `settleMutation` shares with other callers. A write's failure is settled
through `settleMutation` (see [Error Handling](#error-handling)), never handled
here directly.

| Utility                                   | Use Case                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `reportMutationFailure(error, operation)` | Report a failed write; a network failure during a known outage is not reported |
| `alertVersionConflict(config)`            | The "updated elsewhere" alert with a Refresh action                            |

### CRUD Operations (`src/hooks/utils/useCrudOperations.ts`)

`useCrudOperations()` builds one wrapper: a remove that confirms first when
given a `confirmMessage`, then settles the write.

| Helper                          | Provides                                      |
| ------------------------------- | --------------------------------------------- |
| `createRemoveOperation(config)` | Confirmation dialog, then the settled removal |

---

## Cache Persistence & Restoration

The app persists Apollo's normalized cache to MMKV so cold starts paint from cache instantly and so cached data remains available offline. Persistence is implemented in `src/apollo/offline/ApolloCachePersistence.ts` and is wired into `src/apollo/client.ts` at module init and `App.tsx` on mount.

### Why not `apollo3-cache-persist`

Apollo's official guidance recommends [`apollo3-cache-persist`](https://github.com/apollographql/apollo-cache-persist) for cache hydration. We deliberately don't use it:

- **MMKV is synchronous.** `apollo3-cache-persist` is async-only and built for AsyncStorage; with MMKV the blob is restored synchronously **before** `ApolloProvider` mounts, eliminating the timing pitfalls documented in [apollo-cache-persist#337](https://github.com/apollographql/apollo-cache-persist/issues/337) (cache appearing empty on first mount despite successful restore).
- **No explicit AC 4.x support statement.** The library's last release (March 2024) targets Apollo Client 3.0; AC 4.x compatibility is incidental, not contractual.
- **MMKV is already a native dependency.** No additional library or storage abstraction to maintain.

The trade-off: we own ~250 lines of persistence code (`ApolloCachePersistence.ts`) instead of pulling a library. That's worth it for the sync-restore property — without it, the first render would have to wait on `await persistCache()` and paint with an empty cache during the gap.

### One blob, one shape version

The whole `cache.extract()` result is one JSON string under `apollo-cache-v1`,
beside a version key holding `CURRENT_CACHE_VERSION`. That version names the
SHAPE of the blob, not the app that wrote it: bump it by hand for a `cache.ts`
change that makes old data unsafe, or a server change that redefines what
persisted data means. `__tests__/apollo/cacheSchemaVersion.test.ts` pins the
constant and hashes every type-policy module, so a policy edit cannot land
without the decision. `load()` clears and returns null on any other version, so
a mismatch costs one cold network paint.

Restore happens once, in `restorePersistedCache()` (`src/apollo/client.ts`),
called from `App.tsx` at the hydration boundary — the first point where storage
is guaranteed ready and `ApolloProvider` has not mounted. `cache.restore()`
replaces contents wholesale, so it must not run once queries are watching.

### `apolloCachePersistence` API surface

| Method                              | Use when                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `load()`                            | Read the blob at restore; null when absent or of another shape                                                                                                                                                           |
| `scheduleExtractAndSave(extractor)` | Debounced persist after every cache write (wired in `setupCachePersistence`); the extractor runs once per window, at idle                                                                                                |
| `flushPending()`                    | Write an owed save now, synchronously — the app-background transition (`useAppStateLifecycle` → `flushCachePersistence()`) and every queued write (`queueLink`, right after `addMutation`); a no-op when nothing is owed |
| `cancel()`                          | Drop an owed save — sign-out, so the previous account's last seconds never reach disk                                                                                                                                    |
| `clear()`                           | Remove everything a later `load()` could restore — session end, version mismatch, parse failure                                                                                                                          |

Rules the module holds:

- A write is skipped when two extracts match by reference — entity identity per
  top-level key plus the `__META` pin count. `extract()` returns the store's own
  objects, so an untouched cache costs no stringify; a refetch that rewrote an
  entity in place is caught because the scan covers every key, not `ROOT_QUERY`.
- `__META.extraRootIds` is pruned to ids still in the extract before the write.
  `restore()` re-retains every id listed, so a pin whose entity is gone would
  otherwise survive every launch and the list would only grow.
- Nothing is written while `isRecoveryStorage()` is true: the recovery instance
  is plaintext. The check runs before the timer AND inside the write, since
  storage can fall back between the two.
- The three `cache_persist_*` metrics report from every build
  (`docs/telemetry-setup.md`); only the human-readable breadcrumb is dev-gated.

### The `client.cache as InMemoryCache` cast

Apollo Client 4 narrows `ApolloClient.cache` to the abstract `ApolloCache`, which
doesn't expose `restore()`, `release()` or `gc()`'s options. Keep the cast narrow
— one production site: `src/apollo/logoutCleanup.ts` (`gc()` after
`clearStore()`). Helpers that need the concrete class narrow with `instanceof`
(`releaseEntity` in `cacheUpdaters.ts`) rather than casting. Don't push the cast
into application code.

### Adding a new paginated connection

- Use `itemsConnectionFieldPolicy()` or `mergeConnectionByNodeId()`
  (`src/apollo/cacheFieldPolicies.ts`) for merge logic.
- Use the `extractNodes()` / `normalizeConnection()` helpers, which return `[]`
  for missing edges.
- Use a `cache-and-network` → `cache-first` fetch policy so the network fires
  immediately on restore; stale persisted `pageInfo`/edges self-correct when
  the response arrives (a brief flash of stale pagination state is acceptable).

---

## Fragment Composition & Data Masking

`dataMasking: true` is enabled globally (`src/apollo/client.ts`). The project
follows Apollo Client 4.x's recommended pattern: **per-component / per-hook
colocated fragments**, masked at the type level, materialized through
`useFragment` (for cache subscriptions) or `cache.readFragment` (for one-shot
reads). The enforced rules are summarized in CLAUDE.md; this section carries
the mechanism, the templates, and the reasoning.

### Fragment locations

- A component / hook owns its fragment in a sibling `<Name>.graphql` file
  (e.g. `PantryDetailInfo.graphql` next to `PantryDetailInfo.tsx`,
  `useUpdatePantryItem.graphql` next to `useUpdatePantryItem.ts`).
- Naming: `<Consumer>_<entity>` (e.g. `PantryItemCard_pantryItem`,
  `useToggleShoppingItem_item`).
- Screen-level fragments compose children via spread:
  `fragment ItemDetail_X on X { ...ChildA_X ...ChildB_X /* + screen fields */ }`
  — the right shape when one screen needs the union of its children's data:
  the screen owns one fragment, children own theirs, the screen spreads them.
- Queries spread the screen-level fragment(s); mutations spread the hook-owned
  fragment.
- **Shared fragments** live in per-feature `*Fragments.graphql` files (find
  them: `ls src/features/*/graphql/*Fragments.graphql src/graphql/operations/*/[a-z]*Fragments.graphql`),
  and each carries a header naming the operations that spread it and the hooks
  that read it — that header is the contract for keeping the fragment shared.
  Don't add one without 2+ operations and 1+ hook needing the identical shape.
- Generated catalog-fragment names (`ItemFragment*`, `PantryItemDisplay*`, …)
  are banned imports; the authoritative list is the `no-restricted-imports`
  patterns in `eslint/restrictedImports.js`. If you need those fields, create a colocated
  `<Consumer>_<entity>` fragment instead.
- Use the `#operations/<domain>/...` alias rather than long relative paths.

### The two consumer shapes

| Shape                  | Prop type                                | Cache miss                   | Use for                                                                                                   |
| ---------------------- | ---------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Strict**             | `FragmentType<typeof XDoc>`              | `return null` on `!complete` | List cells (`MyRecipeCard`, `SavedRecipeCard`, `PantryItemCard`, `HomeMemberCard`) — brief blanking is OK |
| **Resilient fallback** | `FragmentType<typeof XDoc> \| XFragment` | Fall back to the source prop | Detail panels, sheets (`PantryDetailInfo`, `MealPlanSettingsSheet`) — must render without blanking        |

Pass the masked ref directly as `from`. Apollo's `useFragment` runs
`cache.identify(from)` internally (which reads only `__typename` + the type's
key fields), so the masked ref shape `{ __typename, id, $fragmentRefs }` and a
bare `{ __typename, id }` produce the same cache lookup — no manual extraction
needed.

Resilient-fallback template (preferred for new sheets/detail components):

```tsx
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { XFragmentDoc, type XFragment } from './X.generated';

interface Props {
  itemRef: FragmentType<typeof XFragmentDoc> | XFragment;
  // …other props
}

export const Foo: React.FC<Props> = ({ itemRef, … }) => {
  const fragmentResult = useFragment({
    fragment: XFragmentDoc,
    fragmentName: 'X',
    from: itemRef,
  });
  const item: XFragment = fragmentResult.complete
    ? fragmentResult.data
    : (itemRef as XFragment);
  // …direct field reads on `item`
};
```

**Guard scalar reads** that would crash on undefined when the fallback fires
(e.g. `parseISO(item.startDate)`, arithmetic on `item.qty`).
`complete: false` means the cache doesn't have every field the fragment
selects — the cast to `XFragment` lies in that case, and unguarded reads on
the masked-ref fallback will throw. Either gate the dangerous read
(`item.startDate && parseISO(item.startDate)`) or use the strict shape:

```tsx
const item: XFragment | null = fragmentResult.complete
  ? fragmentResult.data
  : null;
if (!item) return null;
```

### `id` must stay visible under masking

The masked ref only carries `id` if the operation selects `id` directly. Under
`dataMasking`, a named fragment spread (`...Frag`) is hidden from its parent —
the parent sees only the fields it selects itself plus `__typename`. So a
field written as `shoppingListItem(id: $id) { ...ItemDetail_shoppingListItem }`
masks to just `{ __typename }`: the `id` is inside the (masked) fragment. The
moment that object reaches `useFragment` / `cache.readFragment` /
`cache.identify` — or any code reads `.id` off it — key-field extraction
throws `Missing field 'id' while extracting keyFields…`.

**Rule: any selection set that spreads a fragment identifying its type must
also select `id` directly** (e.g.
`shoppingListItem(id: $id) { id ...ItemDetail_shoppingListItem }`). It's free —
`id` is already fetched inside the fragment; selecting it at the parent level
just keeps the key field visible after masking. Enforced for every operation
and fragment by `__tests__/graphql/maskingIdentity.test.ts`.

### Mutation optimistic responses and `Unmasked<>`

Mutation optimistic responses materialize their fragment from cache and
spread/inline into the response shape. Two cases:

1. **Hook reads via `cache.readFragment` then calls `enhanceWithVersion`**
   (when the fragment shape matches the mutation's payload shape) — annotate
   the return type with `Unmasked<TData>`. This is the one and only
   feature-code site where `Unmasked<>` is allowed and expected (Apollo's
   `optimisticResponse?: Unmasked<NoInfer<TData>> | ...` signature requires
   it). Example: `usePantryItemMutations.ts`.

2. **Hook constructs the optimistic shape field-by-field** (when the mutation
   selects narrower fields than the hook's read fragment) — the return type
   annotation isn't required if every field is inlined explicitly, but
   `Unmasked<TData>` is still preferred for clarity. Example:
   `useToggleShoppingItem.ts`.

`Unmasked<>` is reserved for `optimisticResponse` callbacks — nowhere else in
feature code. Don't use `@unmask` (any mode): it's an Apollo migration tool,
not a steady-state pattern. The HKT registration in
`src/types/apollo-masking.d.ts` is required for `FragmentType<typeof Doc>` to
resolve.

### Testing masked components

Tests must wrap with `renderWithApollo` from `#/test-utils/apolloMockProvider`
(so `useFragment` has an Apollo context) and include `__typename` on the
literal fixture. For hooks that read from cache via `cache.readFragment`, use
`seedCache([...])` to pre-write the entity. Do not
`jest.mock('@apollo/client/react', …)` directly — banned by lint
(`sous-chef/no-apollo-react-mock`).

### Why not `client-preset`

The client-preset bundles its own type-level fragment-masking helper
(`@graphql-codegen/client-preset`'s `useFragment`) that **conflicts** with
Apollo Client 4.x's runtime data masking. Apollo's docs explicitly advise
against client-preset for AC4 projects. Our `near-operation-file` setup
already emits `TypedDocumentNode`s, which is all Apollo's
`FragmentType<typeof Doc>` and runtime masking need.

---

## Apollo Client 4.x Notes

This project uses Apollo Client `^4.2.12`. AC 4.0 introduced several new hooks and APIs:

| Hook / API              | Purpose                                                                                                                | Status                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSuspenseQuery`      | Suspense-compatible query hook (works with React `<Suspense>`)                                                         | Available, **not adopted** (see rationale below)                                                                                                  |
| `useBackgroundQuery`    | Trigger queries in parent, read in child via `useReadQuery`                                                            | Available, **not adopted**                                                                                                                        |
| `useReadQuery`          | Read data from a `useBackgroundQuery` queryRef in a child component                                                    | Available, **not adopted** (companion to `useBackgroundQuery`)                                                                                    |
| `useFragment`           | Subscribe to a specific fragment in cache without a query                                                              | **Adopted.** See [Fragment Composition & Data Masking](#fragment-composition--data-masking) for the full pattern.                                 |
| `dataState`             | Discriminated union on query results (`{status: 'loading' \| 'error' \| 'complete', data?}`) for type-safe data access | Available, not adopted (would require widespread refactor)                                                                                        |
| `dataMasking: true`     | Strips fragment fields from parent query results so children must use `useFragment`                                    | **Enabled.** See [Fragment Composition & Data Masking](#fragment-composition--data-masking) for the colocated-fragment convention.                |
| `apollo3-cache-persist` | Apollo's recommended cache persistence library                                                                         | **Not adopted** — see [Cache Persistence & Restoration](#cache-persistence--restoration) for the MMKV-based custom implementation and the reasons |

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

#### `useFragment` — safe for offline-first

Specifics of _how_ to use it live in
[Fragment Composition & Data Masking](#fragment-composition--data-masking). The reason it's safe to adopt
broadly (unlike `useSuspenseQuery`):

- Reads from cache only, never triggers network requests — no offline conflict.
- Works independently of Suspense boundaries.
- Per-entity cache subscription: each item re-renders only when its own fields
  change.

### When to Re-evaluate Suspense/BackgroundQuery

- Apollo releases React Native-specific Suspense guidance with offline-first patterns.
- React Native resolves Suspense stability issues ([RN#49129](https://github.com/facebook/react-native/issues/49129)).
- A new screen genuinely has 2+ independent parallel queries whose waterfall
  `useBackgroundQuery` would avoid — the one shape where re-measuring the
  trade is worth it.

### Codegen Setup

The project uses `@graphql-codegen/cli` with the `near-operation-file` preset and the
`typescript-operations` + `typed-document-node` plugins. Each `*.graphql` file in `src/`
gets a colocated `*.generated.ts` next to it; the generated file exports a
`TypedDocumentNode` constant (e.g. `GetPantryItemDocument`) plus operation result/variable
types. Call sites do `useQuery(GetPantryItemDocument, options)` directly — there are no
wrapper hooks like `useGetPantryItemQuery`.

**Fragment file layout and naming, `@unmask` policy, `customDirectives` config:**
see [Fragment Composition & Data Masking](#fragment-composition--data-masking).
`@graphql-codegen/client-preset` is not used in this project — its runtime
fragment-masking helper conflicts with Apollo Client 4.x's own `dataMasking`.

Use the `#operations/<domain>/...` import alias rather than long relative paths.

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

See `src/features/shoppingList/cache/connections.ts` for the full implementation.

---

## Reference implementations

- **Mutation patterns**: `useAddShoppingItem.ts` ("create with optimistic response + `cache.modify`"), `useToggleShoppingItem.ts` ("toggle without optimistic response, using `cache.modify` for instant UI"), `useUpdatePantryItem.ts` (`enhanceWithVersion` + `Unmasked<TData>` annotation on the optimisticResponse callback).
- **Cache updater utilities**: `src/apollo/utils/cacheUpdaters.ts`
- **Subscription setup**: `src/hooks/subscriptions/` and `src/services/subscriptions/SubscriptionService.ts`
- **Fetch policies**: global `watchQuery` defaults in `src/apollo/client.ts` cover the common case. Override per-query only when the policy needs to differ.
- **Error handling**: `src/services/errorService.ts`, `src/utils/errorHandlers.ts`, `src/utils/errors/versionConflict.ts`

---

**Last Updated**: 2026-05-19
**Maintainers**: Development Team
