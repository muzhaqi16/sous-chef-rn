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
9. [Fragment Composition & Data Masking](#fragment-composition--data-masking)
10. [Apollo Client 4.x Notes](#apollo-client-4x-notes)

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
    },
  };
};
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
      },
    };
  }

  // Use version-aware helper (keeps current version, updates timestamp)
  return {
    __typename: 'Mutation',
    updateItem: enhanceWithVersion(currentItem, variables.input),
  };
};
```

### Pattern: Toggle/Boolean Update

```typescript
optimisticResponse: variables => {
  const currentItem = items.find(item => item.id === variables.id);

  return {
    __typename: 'Mutation',
    togglePurchased: enhanceWithVersion(currentItem, {
      isPurchased: variables.purchased,
    }),
  };
};
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

### Result-union mutations (errors-as-data) ⭐ PRIMARY PATTERN

Every domain mutation returns a **result union** — one success `*Payload` member
plus typed error members (`ValidationError | ForbiddenError | NotFoundError |
ConflictError`, all named `*Error`). Under the global `errorPolicy: 'all'`
(`src/apollo/client.ts`) these error members **resolve as data — they do not
throw.** A hook that reads only `result.data` therefore sees a truthy payload and
silently treats a server refusal as success.

**Handle them by inspecting `__typename`, never by throwing.** (Apollo treats
errors-as-data as a _schema_ technique with no prescribed client handler; the
community consensus — and this codebase — inspect the union.) Two helpers, with a
combiner so the rejected branch is a single call:

| Helper                                   | File                                        | Role                                                                                                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `classifyCreateResult(result)`           | `src/apollo/utils/classifyCreateResult.ts`  | `'created' \| 'queued' \| 'rejected'` — inspects `__typename`; `result.error` (transport) ⇒ rejected; offline-queued `null` ⇒ success; a falsy `result` (the call threw) ⇒ rejected                                                        |
| `alertIfRejected(result, message)`       | `src/apollo/utils/alertRejectedMutation.ts` | **the combiner** ⭐ — classify + alert in one call; returns `true` if rejected. Alerts **unconditionally**, so it covers BOTH a resolved error member AND a resolved transport error. Use at sites with **no** mutation `onError`.         |
| `alertRejectedMutation(result, message)` | `src/apollo/utils/alertRejectedMutation.ts` | lower-level — alerts only when `!result.error` (the resolved-error-member case). Use **only** alongside a mutation `onError` that handles the transport case, to avoid double-alerting. The pantry/shopping reference hooks use this form. |

> ⚠️ **The transport-error trap.** Under `errorPolicy:'all'`, a network/GraphQL
> error **resolves** the mutation with `{ data: undefined, error }` — it does NOT
> throw, so `executeMutation`'s error callback (which only catches throws) never
> fires for it. If you drop the mutation `onError`, that error is yours to
> surface. `alertIfRejected` does (it alerts on `result.error` too);
> `alertRejectedMutation` does NOT (it suppresses `result.error` for callers that
> kept `onError`). **Pick one channel per site — never both, or you double-alert.**

**Canonical shape** (identical for online-only and local-first mutations —
`'queued'` keeps the optimistic write, `'rejected'` surfaces + reverts). Use
`alertIfRejected` and drop the mutation `onError`:

```ts
const result = await executeMutation(
  () => someMutation({ variables, context: { localFirst: true } }),
  error => handleMutationError(error, { operation: 'Update Member' }), // rare genuine throw
);
if (!result) return; // threw — handled above (uncommon under errorPolicy:'all')
if (alertIfRejected(result, t('errors.updateMemberRoleFailed'))) {
  revertSnapshot(); // site-specific cleanup
  return;
}
// success
```

> **Neither helper takes the field name or the success typename.** Both are
> derived from the result: the payload is the mutation's single top-level field,
> and it's the success member when its `__typename` doesn't end in `Error`
> (`src/utils/errors/mutationPayload.ts`, shared with the offline queue's
> `classifyReplayResult` so the foreground and replay paths can't disagree).
> `__tests__/graphql/mutationResultInvariants.test.ts` asserts both rules against
> the generated SDL and every authored operation. An earlier signature took them
> as strings; neither was checkable, and a stale one silently classified every
> create as `'rejected'`, reverting its optimistic write forever.

> **Keep the `if (!result) return` guard above `alertIfRejected`.** A falsy result
> means the call threw and `executeMutation`'s `onError` already told the user, so
> `alertIfRejected` returns `false` for it — deliberately unlike
> `classifyCreateResult`, which reports `'rejected'` because the _write_ didn't
> land. The two answer different questions; dropping the guard double-alerts.

**Rules:**

- **Don't throw to handle a data-error.** `unwrapPayload` (throw-based, in
  `finallyHelpers.ts`) exists for a few callers that deliberately let the
  throw propagate to a screen-level catch — but the default is the data-inspection
  pair above. It reads linearly and handles the offline-queued `null`, which
  `unwrapPayload` would wrongly throw on (`GraphQLNetworkError`).
- **Guard every `update()` / `onCompleted` side-effect on the success
  `__typename`.** Cache eviction, `logout()`, navigation, marking a user
  onboarded — a resolved `*Error` member reaches these callbacks (it didn't
  throw), so an unguarded callback fires on a _refusal_. Move success side-effects
  into the imperative flow (after the `alertIfRejected` check) or guard the
  callback with `if (data?.field?.__typename !== 'XPayload') return;`.
- **i18n:** user-facing copy always comes from `t('...')` — a refusal naming a
  `field` resolves `errors.field.<field>` with the caller's string as fallback,
  and the server's `message` is never displayed (see
  [Localizing refusals](#localizing-refusals--field-routes-the-servers-message-never-displays)). The
  `operation` label is a **telemetry tag — a plain inline string, never
  translated** (matches the codebase-wide `trackEvent`/`operation:` convention;
  these flow to Loki/Telemetry, never to the user).
- **`useCrudOperations`** uses `findFirstErrorMember` (via `surfaceCrudDataError`)
  rather than `classifyCreateResult`, because it needs the refused member's own
  `message` to show the user and the classifier only returns an outcome. Both
  apply the same shared `isErrorTypename` rule, so they agree on which member is
  the refusal.

**Reference implementations:** `useUpdateShoppingItem.ts`,
`useAdjustPantryItemQuantity.ts`, `useWastePantryItemBatch.ts`,
`useOpenPantryItemBatch.ts`, `DeleteAccountScreen.tsx`.

### Localizing refusals — `field` routes, the server's `message` never displays

A refusal that names a `field` routes to LOCALIZED copy. `field` says which
input was refused — the actionable part when one mutation carries four
sub-inputs — and `alertRejectedMutation` / `alertIfRejected` already turn it
into copy from `errors.field.*`, falling back to the caller's own string for an
unmapped field or an unattributed refusal. Callers pass their generic copy and
get the specific version for free; do not re-implement the rule at a call site.

`message` is server-authored **English**: the client sends no `Accept-Language`
and its token carries no locale, so there is nothing for the server to localize
against, and the API says so itself — _"use error codes for programmatic
handling, not message strings"_ and _"map error codes to localized messages in
your client"_ (`sous-chef-api/docs/api/errors.md`, Best Practices). Displaying
it puts English in front of every es / it / sq user and skips the
plural-category, addressee-gender and canonical-vocabulary guards the app
enforces on all its own copy. Never branch on `message` text either — route on
`code` and `field` only.

The cost is recorded rather than hidden: one field can carry several rules —
`unit` refuses both "batches still exist" and "no conversion path" — so its
string names both remedies. Adding a mapping to `errors.field.*` is opt-in; a
field with none simply keeps the caller's copy.

> **Known deviation:** `useCrudOperations`' `surfaceCrudDataError` still shows
> the refused member's own `message` (English) when present. It predates this
> rule; treat it as migration debt, not a pattern to copy.

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

| Method                                          | Description                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `handleApolloError(error, config)`              | Parse Apollo error → flat `{ code, message, category, shouldRetry, isAuthError }` |
| `parseApolloError(error, config)`               | Parse Apollo error → structured `ErrorResult` with `success` flag                 |
| `handleMutation(fn, config)`                    | Wrap an async mutation with try/catch, returns `ErrorResult<T>`                   |
| `handleMutationWithVersionConflict(fn, config)` | Like `handleMutation` but adds `isVersionConflict` flag                           |
| `getUserFriendlyMessage(errorCode)`             | Map error code to user-facing string                                              |
| `getErrorCategory(errorCode)`                   | Map error code prefix to category (e.g., `AUTH_` → `"Authentication"`)            |
| `shouldRetry(errorCode)`                        | Whether the error is retryable (timeouts, rate limits, etc.)                      |
| `isAuthError(errorCode)`                        | Whether the error is auth/authz related                                           |
| `reportError(error, context)`                   | Log a non-Apollo error to console + Telemetry                                     |
| `getErrorMessage(error)`                        | Extract a user-friendly message from any error                                    |

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

All real-time subscriptions go through the singleton `SubscriptionService` at
`src/services/subscriptions/SubscriptionService.ts`. It handles deduplication,
cache update strategy selection, pending-delete race conditions, parent-deletion
filtering, and dev-mode logging — all in one place. Hooks call
`subscriptionService.register(...)` to get `{ onData, onError, onComplete }`
handlers and spread them into `useSubscription`.

### Pattern: Standard Subscription

```typescript
import { useSubscription } from '@apollo/client/react';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';

const handlers = subscriptionService.register({
  subscriptionName: 'ShoppingListItemsChanged',
  entityType: 'ShoppingListItem',
  enableDeduplication: true,
  userId: user?.id,
  cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
});

useSubscription(ShoppingListItemsChangedDocument, {
  variables: { listId },
  skip: !listId,
  ...handlers,
});
```

### Pattern: Subscription with custom cache logic

When the subscription needs to move items between filtered connections, set
`cacheUpdateStrategy: CacheStrategy.NONE` and provide a `customOnData` callback.
See `usePantrySubscriptions.ts` and `useShoppingListSubscriptions.ts` for
reference implementations.

```typescript
const handlers = subscriptionService.register<PantryChangesPayload>({
  subscriptionName: 'PantryChanges',
  entityType: 'PantryItem',
  enableDeduplication: true,
  userId: user?.id,
  entityId: pantryId,
  cacheUpdateStrategy: CacheStrategy.NONE,
  customOnData: (payload, client) => {
    // Custom cache update logic — e.g., move between filtered connections
    // based on payload.mutation type
  },
});
```

### Pending-delete tracking

When deleting an entity optimistically, register the pending delete so a
subscription echo doesn't re-add it via auto-normalization:

```typescript
subscriptionService.registerPendingDelete(
  itemId,
  parentId,
  'PantryItem',
  'Pantry',
  'itemsConnection',
);
await deleteItemMutation({ variables: { id: itemId } });
```

The service re-evicts the entity if the subscription arrives after the optimistic delete.

---

## Fetch Policies

### Global Defaults (Set in `src/apollo/client.ts`)

`watchQuery` (i.e. anything backing `useQuery`) is configured globally with:

```typescript
defaultOptions: {
  watchQuery: {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
  },
  query:  { fetchPolicy: 'network-only', errorPolicy: 'all' },
  mutate: {                              errorPolicy: 'all' },
},
```

**Most `useQuery` call sites do not need to set these explicitly.** Set per-query
only when the policy needs to differ from the default (e.g. autocomplete +
`cache-first`, login + `network-only`).

**Do not introduce dynamic, store-subscribed fetch policies.** A hook that
returns a fetchPolicy string derived from `store.isOnline` causes Apollo to
see "options changed" on every network-state flip, which re-fires every active
query (the documented cascade that motivated removing `useOfflinePresetPolicy`).
Handle offline gracefully via the existing defaults instead — `errorPolicy: 'all'`
keeps cached data on network failures, and `usePreservedArrayData` preserves
the last good array across refetch errors.

### `nextFetchPolicy` — String vs Function Form

Apollo Client 4.x supports both a string and a function for `nextFetchPolicy`.

**String form** (simple cases):

```typescript
nextFetchPolicy: 'cache-first',
```

After the first fetch, all re-renders use `cache-first`. On variable changes, Apollo automatically reverts to `initialFetchPolicy` (`cache-and-network`). Suitable for most queries.

**Function form** (fine-grained control):

```typescript
nextFetchPolicy(currentFetchPolicy, context) {
  if (context.reason === 'variables-changed') {
    return context.initialFetchPolicy; // cache-and-network for fresh data
  }
  return 'cache-first'; // cache-first after fetch completes
},
```

The function receives a `context` with:

- `reason: 'after-fetch'` — query just completed a network request
- `reason: 'variables-changed'` — query variables changed (filter/sort/ID)
- `initialFetchPolicy` — the original `fetchPolicy` value
- `observable` / `options` — the query observable and current options

Use the function form when you need different behavior for variable changes vs post-fetch re-renders. For offline-first queries with filters/sort, the function form makes the intent explicit: fresh data on user-initiated changes, cached data for re-renders.

### Skip Toggle Pitfall & Query Activation Latch

**Problem:** When a query uses `skip` and the skip value toggles (`true → false → true → false`) during initialization, Apollo resets the `fetchPolicy` to its initial value on each `true → false` transition. With `cache-and-network`, this fires a duplicate network request every time.

This commonly occurs when the skip condition depends on multiple upstream states that settle at different times during app startup (e.g., `isHomeSelectionReady`, `selectedPantryId`).

```typescript
// ❌ PROBLEM: hasValidId flickers during startup → duplicate requests
const hasValidId = !!id && isReady && !isLoggedOut;
const { data } = useQuery(QUERY, {
  skip: !hasValidId, // toggles during init
  fetchPolicy: 'cache-and-network', // re-applied on each skip→unskip
  nextFetchPolicy: 'cache-first', // ← ignored when skip resets the policy
});
```

**Solution — Query Activation Latch:** Once the query activates for a given entity ID, latch it active so transient state churn doesn't re-skip it. The latch resets when the ID changes or the user logs out.

```typescript
// ✅ CORRECT: Latch prevents skip flickering
const [activatedForId, setActivatedForId] = useState<string | null>(null);

// Latch: once validation passes, keep query active for this ID
if (hasValidId && entityId && activatedForId !== entityId) {
  setActivatedForId(entityId);
}

// Release: clear on logout
if (activatedForId && isLoggedOut) {
  setActivatedForId(null);
}

const isLatched = activatedForId === entityId && !!entityId;
const shouldSkip = !hasValidId && !isLatched;

const { data } = useQuery(QUERY, {
  skip: shouldSkip,
  fetchPolicy: 'cache-and-network',
  nextFetchPolicy: 'cache-first',
});
```

**How the latch auto-resets:**

- **Entity ID changes** (e.g., user switches pantries): `activatedForId !== entityId` → latch doesn't match → `isLatched = false` → skip depends on `hasValidId` again → fresh fetch when ready
- **Logout**: explicitly clears the latch
- **Home deletion**: entity ID becomes `undefined` → `isLatched = false` → query skips

**Important:** Uses the "adjusting state during render" pattern (`useState` + conditional `setState`) to stay compatible with the React Compiler. Do not use `useRef` for this — reading `ref.current` during render causes compiler bailout.

**Reference implementation:** `src/hooks/home/pantry/usePantryQuery.ts`

### Avoid Redundant `refetch()` on Variable Changes

Apollo automatically re-executes a query when its variables change. Calling `refetch()` explicitly in addition to a variable change causes a **double network request**.

```typescript
// ❌ WRONG: Double fetch on ID change
if (prevId !== currentId) {
  setPrevId(currentId);
  refetch(); // Apollo already refetches because variables.id changed
}

// ✅ CORRECT: Let Apollo handle variable-change refetches
if (prevId !== currentId) {
  setPrevId(currentId);
  // Reset UI state only — Apollo handles the refetch
  setFilter('all');
  setSearch('');
}
```

Use `refetch()` only for user-initiated actions (pull-to-refresh) or when you need to re-fetch with the **same** variables.

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
// Implementation (you don't need to write this, it's already available
// at src/hooks/apollo/usePreservedQueryData.ts)
export function usePreservedQueryData<T>(
  currentData: T | undefined,
  initialValue: T,
): T {
  // "Adjusting state during render" pattern — the React-recommended way to
  // sync state with props without an effect. No useRef/useMemo: the React
  // Compiler auto-memoizes, and reading ref.current during render bails out
  // of compilation (see CLAUDE.md "React Compiler Conventions").
  const [lastSuccessfulValue, setLastSuccessfulValue] =
    useState<T>(initialValue);
  const [prevData, setPrevData] = useState<T | undefined>(currentData);

  if (currentData !== prevData) {
    setPrevData(currentData);
    if (currentData !== undefined) {
      setLastSuccessfulValue(currentData);
    }
  }

  return currentData !== undefined ? currentData : lastSuccessfulValue;
}

export function usePreservedArrayData<T>(
  currentData: T[] | undefined | null,
): T[] {
  return usePreservedQueryData(currentData ?? undefined, [] as T[]);
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

Used by query-wrapping hooks that need to keep the last-known array stable
across refetch errors. Run `grep -rn "usePreservedArrayData\|usePreservedQueryData" src/`
to find current consumers — at the time of writing this includes
`useDefaultHome`, `useHomeQuery`, `useLazyHomeData`, `useHomeDetailManagement`,
`usePantryQuery`, `useCurrentPantry`, `useStorageLocationManagement`,
`useItemSelector`, `useShoppingListDetails`, `useDietaryProfile`, and
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
};
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
    },
  }),
  // Cache update to add to array
  update: (cache, { data }) => {
    if (!data?.addItem) return;

    cache.modify({
      fields: {
        items(existingItems = [], { readField, toReference }) {
          const newItemRef = toReference(data.addItem);
          const exists = existingItems.some(
            ref => readField('id', ref) === data.addItem.id,
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
    updateItem: enhanceWithVersion(currentItem, variables.input),
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

- `src/hooks/subscriptions/usePantrySubscriptions.ts` (lines 80-126)
- `src/hooks/subscriptions/useShoppingListSubscriptions.ts` (lines 80-239)

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
guard is what keeps a pantry notification out of the recipes feed.
`createAddToParentConnectionUpdater` accepted that option and ignored it until
2026-08-23.

---

## Reusable Utilities Reference

### Cache Updaters (`src/apollo/utils/cacheUpdaters.ts`)

Use these utilities instead of writing inline `cache.modify()` logic. Connection
variants handle relay-style `{ edges, pageInfo }` wrappers; Array variants
handle plain list fields.

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
| `createAddToQueryFieldUpdater`       | Add item to a root-level `Query.arrayField`              |

**Misc helpers in the same file:** `incrementNestedCounter`, `setCachedFields`,
`createItemEvictor`, `safeEvict`, `safeEvictMany`, `gcResetResultCache`.

**Example Usage:**

```typescript
import { createAddToParentConnectionUpdater } from '#/apollo/utils';

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

| Utility                                            | Use Case                                  |
| -------------------------------------------------- | ----------------------------------------- |
| `createOptimisticEntity(typename, tempId, fields)` | Create temp entity for add mutations      |
| `enhanceWithVersion(currentItem, updates)`         | Add version/timestamp to update mutations |

### Error Handler Composables (`src/utils/errorHandlers.ts`)

Higher-order functions for wrapping mutations with consistent error handling. Used by `useCrudOperations.ts` and other management hooks.

| Utility                                     | Use Case                                              |
| ------------------------------------------- | ----------------------------------------------------- |
| `withVersionConflictHandling(fn, config)`   | Wrap mutation with version conflict detection + alert |
| `withMutationErrorHandling(fn, config)`     | Wrap mutation with Apollo error reporting + alert     |
| `withGenericErrorHandling(fn, msg)`         | Wrap mutation with simple error alert                 |
| `composeErrorHandlers(fn, handlers[])`      | Chain multiple error handlers together                |
| `handleVersionConflictAlert(error, config)` | Inline version conflict check for try/catch blocks    |
| `handleMutationErrorAlert(error, config)`   | Inline error alert for try/catch blocks               |

**Example**:

```typescript
import {
  withVersionConflictHandling,
  withMutationErrorHandling,
} from '#/utils/errorHandlers';

const safeUpdate = withVersionConflictHandling(
  withMutationErrorHandling(updateFn, { operation: 'Update Item' }),
  { itemName: 'Item', onRefresh: refetch },
);
```

### CRUD Operations (`src/hooks/utils/useCrudOperations.ts`)

Provides standardized CRUD operation wrappers with built-in validation and error handling.

| Helper                  | Provides                                             |
| ----------------------- | ---------------------------------------------------- |
| `createAddOperation`    | Input validation, parent ID validation, error alerts |
| `createUpdateOperation` | Version conflict handling, refetch on conflict       |
| `createRemoveOperation` | Confirmation dialogs, cleanup                        |

---

## Cache Persistence & Restoration

The app persists Apollo's normalized cache to MMKV so cold starts paint from cache instantly and so cached data remains available offline. Persistence is implemented in `src/apollo/offline/ApolloCachePersistence.ts` and is wired into `src/apollo/client.ts` at module init and `App.tsx` on mount.

### Why not `apollo3-cache-persist`

Apollo's official guidance recommends [`apollo3-cache-persist`](https://github.com/apollographql/apollo-cache-persist) for cache hydration. We deliberately don't use it:

- **MMKV is synchronous.** `apollo3-cache-persist` is async-only and built for AsyncStorage; with MMKV we can hydrate critical entities synchronously **before** `ApolloClient` is instantiated, eliminating the timing pitfalls documented in [apollo-cache-persist#337](https://github.com/apollographql/apollo-cache-persist/issues/337) (cache appearing empty on first mount despite successful restore).
- **No explicit AC 4.x support statement.** The library's last release (March 2024) targets Apollo Client 3.0; AC 4.x compatibility is incidental, not contractual.
- **MMKV is already a native dependency.** No additional library or storage abstraction to maintain.

The trade-off: we own ~500 lines of persistence code (`ApolloCachePersistence.ts`) instead of pulling a library. That's worth it for the sync-restore property — without it, the first render would have to wait on `await persistCache()` and paint with an empty cache during the gap.

### Two-phase critical/deferred restore

Bulk-restoring the entire persisted cache synchronously at module init blocks the JS thread on a large `JSON.parse` (50-200ms for a populated cache). To avoid that, persisted entities are split into two partitions:

- **Critical** — `ROOT_QUERY`, `User`, `Home`, `UserProfile`, `UserSettings`, `DietaryProfile`, `NotificationPreferences` (~30 entities, ~5ms). Restored synchronously at module init by `initializeClient()` so cache-first queries hit immediately on first render.
- **Deferred** — everything else (`PantryItem`, `ShoppingListItem`, `Recipe`, etc.). Restored via `requestIdleCallback` after first paint by `apolloCachePersistence.restoreDeferred(client.cache)`, called from a `useEffect` in `App.tsx`.

If a screen mounts before the deferred phase fires, the cache miss falls back to network and renders the first page (20-50 items via pagination). That's an acceptable degradation — the screen still paints fast.

This split is a **custom optimization** — it's not a recognized community pattern. It's justified by measured cold-start blocking on this codebase; don't replicate the pattern elsewhere without similar evidence.

### `apolloCachePersistence` API surface

| Method                                        | Use when                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `loadCritical()`                              | Synchronously read critical partition at `initializeClient`                           |
| `load()`                                      | Migration fallback when split-key format is absent                                    |
| `restoreDeferred(cache)`                      | Schedule idle-callback bulk restore after first paint (called from `App.tsx`)         |
| `loadDeferred()`                              | Internal — read deferred partition (used by `restoreDeferred`)                        |
| `save(cache)` / `scheduleExtractAndSave(...)` | Debounced persist after cache writes (wired in `setupCachePersistence`)               |
| `saveImmediate(cache)`                        | Synchronous flush — use for logout / app termination                                  |
| `pause()` / `resume()`                        | Suspend persistence during logout transitions                                         |
| `markDirty(keys)`                             | Mark cache keys as changed for incremental persistence                                |
| `cancel()`                                    | Abort pending debounced save **and** any in-flight `restoreDeferred` — call on logout |
| `clear()`                                     | Wipe all persisted cache from MMKV                                                    |
| `getStats()` / `isValid()`                    | Diagnostics                                                                           |
| `partitionCache(cache)`                       | Internal — split normalized cache into critical/deferred buckets                      |

### Lifecycle

- **Module init** (`src/apollo/client.ts` → `initializeClient`): Phase 1 sync restore via `loadCritical()` (or `load()` migration fallback). Wire `setupCachePersistence(client)` to debounce-persist on every cache write.
- **App mount** (`App.tsx` useEffect): `apolloCachePersistence.restoreDeferred(client.cache)` schedules Phase 2.
- **Logout** (`src/apollo/logoutCleanup.ts`): `cancelCachePersistence()` → `apolloCachePersistence.cancel()` (aborts pending save AND any pending deferred restore — important: without this, a deferred restore could fire after `clearStore()` and write stale entities back into the cleared cache).

### The `client.cache as InMemoryCache` cast

Apollo Client 4 narrows `ApolloClient.cache` to the abstract `ApolloCache<TCacheShape>`, which doesn't expose `restore()` or `gc()`. Any call boundary that hits those methods has to cast. Keep the cast narrow — currently one production site: `src/apollo/logoutCleanup.ts` (`gc()` after `clearStore()`). The deferred restore path lives inside `apolloCachePersistence` and is no longer a cast boundary callers have to think about. Don't push the cast into application code.

### Adding a new paginated connection

- Use `itemsConnectionFieldPolicy()` or `mergeConnectionByNodeId()`
  (`src/apollo/utils/cacheUpdaters.ts`) for merge logic.
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
  patterns in `.eslintrc.js`. If you need those fields, create a colocated
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
(`no-restricted-syntax`).

### Why not `client-preset`

The client-preset bundles its own type-level fragment-masking helper
(`@graphql-codegen/client-preset`'s `useFragment`) that **conflicts** with
Apollo Client 4.x's runtime data masking. Apollo's docs explicitly advise
against client-preset for AC4 projects. Our `near-operation-file` setup
already emits `TypedDocumentNode`s, which is all Apollo's
`FragmentType<typeof Doc>` and runtime masking need.

---

## Apollo Client 4.x Notes

This project uses Apollo Client `~4.1.7`. AC 4.0 introduced several new hooks and APIs:

| Hook / API              | Purpose                                                                                                                | Status                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSuspenseQuery`      | Suspense-compatible query hook (works with React `<Suspense>`)                                                         | Available, **not adopted** (see rationale below)                                                                                                  |
| `useBackgroundQuery`    | Trigger queries in parent, read in child via `useReadQuery`                                                            | Available, **not adopted**                                                                                                                        |
| `useReadQuery`          | Read data from a `useBackgroundQuery` queryRef in a child component                                                    | Available, **not adopted** (companion to `useBackgroundQuery`)                                                                                    |
| `useFragment`           | Subscribe to a specific fragment in cache without a query                                                              | **Adopted.** See [Fragment Composition & Data Masking](#fragment-composition--data-masking) for the full pattern.                                        |
| `dataState`             | Discriminated union on query results (`{status: 'loading' \| 'error' \| 'complete', data?}`) for type-safe data access | Available, not adopted (would require widespread refactor)                                                                                        |
| `dataMasking: true`     | Strips fragment fields from parent query results so children must use `useFragment`                                    | **Enabled.** See [Fragment Composition & Data Masking](#fragment-composition--data-masking) for the colocated-fragment convention.                       |
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

See `src/apollo/utils/shoppingListCacheUpdaters.ts` for the full implementation.

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
