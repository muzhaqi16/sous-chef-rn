# Apollo GraphQL Patterns & Best Practices

This document defines the standardized patterns for using Apollo Client in this application. Following these patterns ensures consistent offline-first behavior, optimal performance, and maintainable code.

---

## Table of Contents

1. [The data layer stays out of what renders](#the-data-layer-stays-out-of-what-renders)
2. [Building the client](#building-the-client)
3. [Cache Update Patterns](#cache-update-patterns)
4. [Optimistic Responses](#optimistic-responses)
5. [Query Data Preservation](#query-data-preservation)
6. [Resync](#resync)
7. [Version Conflicts](#version-conflicts)
8. [Decision Trees](#decision-trees)
9. [Reading entities before a mutation](#reading-entities-before-a-mutation)
10. [Reusable Utilities Reference](#reusable-utilities-reference)
11. [Cache Persistence & Restoration](#cache-persistence--restoration)
12. [Fragment Composition & Data Masking](#fragment-composition--data-masking)
13. [Apollo Client 4.x Notes](#apollo-client-4x-notes)

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
Apollo's own result generic. `sous-chef/hook-returns-no-library-type` resolves
every feature hook's return type through the checker and fails on a library
type in it or one property down.

`useFragment` and the masking types stay allowed in a cell: with `dataMasking`
on, a cell subscribing to one entity is the documented pattern
([Fragment Composition & Data Masking](#fragment-composition--data-masking)).

---

## Building the client

`src/apollo` builds nothing when it is imported. `createApolloClient(options)`
(`src/apollo/client.ts`) builds the client, wires cache persistence, and
registers it in `clientRegistry`, together with the token-refresh and reset
bridges. The host calls it once: the mobile app in `src/app/apolloClient.ts`,
which is the module that exports `client`.

Core code outside a component reads the client with `requireApolloClient()`,
which throws if the client has not been built yet. `getApolloClient()` returns
`null` instead, for a caller with nothing to do before then.

The host supplies the WebSocket transport as `options.webSocket`
(`WebSocketTransport` in `src/apollo/links/wsLink.ts`): the socket class, and
optionally a keep-alive interval in place of the 12-second default. On mobile,
`createNativeWebSocketTransport()` (`src/native/webSocketTransport.ts`)
subclasses React Native's `WebSocket` to send `x-api-key` on the upgrade, and
lengthens the keep-alive under Detox. Without the option, the link uses the
global `WebSocket`.

---

## Cache Update Patterns

### Choosing a pattern

Pick by what the mutation changes; the numbered patterns below carry the code.

| Pattern                                      | Use when                                                            | Example                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| No `update` callback (preferred default)     | Mutation returns the entity; Apollo normalizes by `__typename + id` | `useAdjustPantryItemQuantity`                                              |
| `cache.modify` on parent aggregates          | Parent stat fields not in the response                              | `useRecipeReviews` (`Pantry.stats` uses its `mergeObjects` policy instead) |
| Local write BEFORE firing, revert on refusal | A field edit that shows at once and survives being queued           | `useToggleShoppingItem`, `usePublishRecipe` (Pattern 5)                    |
| `updateEntityFieldsLocalFirst`               | Settings-shaped entity whose field names ARE the setting names      | `useAppSettings`, `useNotificationSettings`                                |
| `cache.modify` on connection edges + counts  | Entity moves between filtered connections                           | `moveShoppingListItemTo*` helpers                                          |
| `writeFragment`                              | Subscription push written through                                   | `usePantrySubscriptions`, `useShoppingListSubscriptions`                   |
| `refetchQueries` (last resort)               | Query shape underivable from the response                           | `useHomeSubscriptions`, `usePantryItemDetailActions`                       |

- A write that shows before the server answers is written into the cache
  before firing and reverted on a refusal (Pattern 5); no write in the app
  passes an `optimisticResponse`. If one is ever needed, build it from the
  cache (`cache.readFragment` + spread), never from a hand-rolled shape.
- Avoid `refetchQueries` unless `cache.modify` would duplicate server logic
  ([refetchQueries Guidance](#refetchqueries-guidance)).

### A field with a write-time invariant has one writer

`cache.modify` does not run type-policy merges and cannot introduce a field the
cached record lacks, so a record whose rules live in a merge policy
(`ShoppingListItem.purchaseInfo`) is written through `cache.writeFragment`.
`writePurchaseInfo` is the worked example: it writes with
`extensions: { local: true }`, which Apollo hands to the merge function (4.1+;
`writeFragment`'s options type omits `extensions`, but `write` forwards them),
and the policy merges a local write field-wise instead of clearing on a flip. A second
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
// `useAdjustPantryItemQuantity`: no `update`. The payload spreads the item's
// readers, and Apollo merges it into the cache by `__typename` + `id`.
const [adjustMutation] = useMutation(AdjustPantryItemQuantityDocument, {
  context: { localFirst: true },
});
```

The same hook shows the new quantity before the server answers by writing the
row locally first (Pattern 5); the response then settles it.

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

### Pattern 5: A local write before firing - For Simple Field Updates ⭐ RECOMMENDED

**Use When**: Editing fields of an entity the cache already holds — a toggle, a setting, a rename — where the change shows at once and survives being queued.

**Shape**: snapshot the fields, write the new values into the cache, fire the mutation with `context: { localFirst: true }`, settle it, and put the snapshot back only when it `failed`.

- **The write is permanent, not an optimistic layer.** Apollo tears an `optimisticResponse` layer down on the offline queue's null result, which reverts the change while it is still queued.
- **It is made before firing, not in `update`.** `update` runs only with a server payload, so a queued write would show nothing.
- **It goes through `writeEntityFields`** (`src/apollo/utils/localFirstFields.ts`), a `cache.writeFragment`: `cache.modify` cannot introduce a field the cached record lacks. A field whose rules live in a merge policy takes its own writer instead ([one writer](#a-field-with-a-write-time-invariant-has-one-writer)).
- **`queued` is not a failure.** `settleMutation` answers `applied | queued | failed`, and only `failed` reverts.
- **The settle shows the failure.** It alerts by default; `present: 'toast'` shows the same copy as an error toast, and `present: 'none'` hands it to the caller as `failure`, for a caller that combines several writes into one message.
- **The snapshot omits what the cache lacks.** `snapshotFields` keeps only the keys the read carried, so a revert never blanks a field it never saw. Read it from the cache, not from a query result that may not have answered yet.

**Example - a field edit that states its version** (`usePublishRecipe`):

```typescript
const [mutate] = useMutation(UpdateRecipeDocument, {
  context: { localFirst: true },
});

const setSubmitted = async (recipeId: string, submitted: boolean) => {
  const entity = { __typename: 'Recipe', id: recipeId };
  const held = client.cache.readFragment<RecipeReadersFragment>({
    id: client.cache.identify(entity),
    fragment: RecipeReadersFragmentDoc,
    returnPartialData: true,
  });
  const patch = {
    status: submitted ? RecipeStatus.PendingReview : RecipeStatus.Draft,
    isPublished: false,
  };
  const previous = snapshotFields(held, patch);
  writeEntityFields(client.cache, entity, patch);

  const status = submitted ? RecipeStatus.Published : RecipeStatus.Draft;
  const settled = await settleMutation(
    () =>
      // Sends once earlier writes to this row have settled, at the version the
      // cache holds then; rejects without sending when it holds none.
      chainVersionedWrite(client.cache, entity, version =>
        mutate({ variables: { input: { id: recipeId, status, version } } }),
      ),
    {
      document: UpdateRecipeDocument,
      fallback: t('labels.failedToUpdateRecipe'),
      onFailed: () => writeEntityFields(client.cache, entity, previous),
    },
  );
  return settled.status !== 'failed';
};
```

**Example - a settings-shaped entity** (`useUpdateHomeFields`, `useAppSettings`, `useNotificationSettings`). `updateEntityFieldsLocalFirst` wraps the same write, fire and revert, and returns the outcome for the caller to report:

```typescript
const { persisted } = await updateEntityFieldsLocalFirst({
  cache: client.cache,
  entity: { __typename: 'Home', id: homeId },
  updates,
  previous: snapshotFields(home, updates),
  logLabel: 'Update Home Fields',
  mutate: () => updateHomeMutation({ variables: { input } }),
});
```

**Example - a field with a merge-policy invariant** (`useToggleShoppingItem`). A tick is an `updateShoppingListItem` carrying only the flag; `purchaseInfo` is written through its one writer, and the row moves between the filtered `itemsConnection` variants in the same step:

```typescript
const [updatePurchase] = useMutation(UpdateShoppingListItemDocument, {
  context: { localFirst: true },
});

writePurchaseInfo(
  client.cache,
  itemId,
  { isPurchased: newStatus },
  { updatedAt: new Date().toISOString() },
);
const counterChange = recordListCounters(client.cache, listId, () => {
  moveShoppingListItemToPurchased(client.cache, listId, { id: itemId });
});

const settled = await settleMutation(
  () =>
    updatePurchase({
      variables: {
        input: {
          id: itemId,
          version: snapshot.version,
          purchaseTracking: { isPurchased: newStatus },
        },
      },
    }),
  {
    document: UpdateShoppingListItemDocument,
    fallback: t('errors.updateItemFailed'),
    // Puts back the flag, the connection move and the counters.
    onFailed: revert,
  },
);
```

**When NOT to Use This Pattern**:

- Creating a new entity: write the whole row before firing (`docs/local-first-architecture.md` § 2, and [New Entity](#pattern-new-entity-createadd) below)
- Adding to or removing from a list: the edge writers of Pattern 1
- A change the server must compute (a total, a merged quantity): send it and let the response normalize (Pattern 2)

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

No write in the app passes an `optimisticResponse`. A change the user should see
before the server answers is written into the cache before the mutation fires —
a whole row for a create (below), the edited fields for an update (Pattern 5),
an unlinked edge for a removal (Pattern 4) — and is reverted only when the write
settles as `failed`. That write is permanent rather than a layer, which is what
lets it outlive the offline queue's null result and an app restart.

### Pattern: New Entity (Create/Add)

A create writes its entity to the cache PERMANENTLY before firing, under a
client-minted id, and reverts only on a refusal — never an `optimisticResponse`,
which the offline queue's null result tears down (`docs/local-first-architecture.md`
§ 2). `useAddToPantry.addItem` is the worked example: `generateEntityId`, then
`writeLocalPantryItem` + `addPantryItemLocally`, then `settleMutation` with
`onFailed` reverting. `writeLocalPantryItem` states only what the create knows;
`writeLocalEntity` fills the rest of the row fragment (the entity's readers plus
its empty connections) from the cache where held, else from the SDL-derived
neutral base. A nested record completes the same way from its type's neutral
(`NEUTRAL_*_BY_TYPE`), so a create names a related entity (an owner, a home) by
`id` only when `isHeld` says the cache has it; otherwise it leaves the field to
its neutral, since a reference to an absent entity reads incomplete.

---

## Query Data Preservation

A query on `errorPolicy: 'ignore'` reads `undefined` both while loading and
after a failure, so a hook that must keep showing the last good value wraps it:

| Hook                                        | Holds                                             |
| ------------------------------------------- | ------------------------------------------------- |
| `usePreservedQueryData(data, initial, key)` | Any value                                         |
| `usePreservedConnection(connection, key)`   | A connection's nodes, `totalCount` and `pageInfo` |
| `usePreservedNodes(connection, key)`        | An `edges`-only connection's nodes                |

All three live in `src/hooks/apollo/`. `key` names the SUBJECT the value was
loaded for (the variables that identify it, or the operation name for a query
with none): a value is only ever handed back for the key it was loaded under,
so switching pantry, list or category never re-serves the previous subject's
data, even when the new subject's fetch fails. Apollo's `previousData` is not
variable-scoped; a hook that falls back to it compares the data's own id with
the current subject first (`useShoppingListItemsQuery`).

```typescript
const { data } = useQuery(GetPantryDocument, {
  variables: { pantryId, filter },
  errorPolicy: 'ignore',
});
const items = usePreservedNodes(
  data?.pantry?.itemsConnection,
  JSON.stringify([pantryId, filter]),
);
```

`grep -rn "usePreserved" src/` lists the consumers.

---

## Resync

A mounted screen settles on `cache-first` after its first fetch, and the
live-event channel only delivers what happens after it connects. So the client
re-requests its active queries whenever the device may have missed changes,
through Apollo 4.2's `RefetchEventManager` (`src/apollo/refetchEvents.ts`):

| Event             | Fires when                                                       |
| ----------------- | ---------------------------------------------------------------- |
| `appForeground`   | The `appLifecycle` port goes from background/inactive to `active` |
| `apiReachable`    | `isApiUnavailable` goes from true to false (link or breaker)     |
| `wsReconnected`   | `onWebSocketReconnected`                                         |
| `languageChanged` | The resolved language really changes; after one, each navigation |

The events are declared (`void` payloads) in
`src/types/apollo-default-options.d.ts`. `createRefetchEventManager()` is
passed to the `ApolloClient` constructor with one coalescing default handler;
`connectResyncSources(client, { onNavigation })` attaches the sources at app
start in `App.tsx`, because a source subscribes as it is set and importing the client
must not subscribe to the store, the app lifecycle and the socket.

The handler:

1. merges a trigger into a resync that is already waiting;
2. waits for `queueManager.whenIdle()`, so a refetch never paints the server's
   older values over writes still replaying;
3. closes the batch, so a later trigger starts the next resync;
4. skips when there is no session or one is ending
   (`LogoutCleanup.isInLogoutProcess()`);
5. runs `client.refetchQueries({ include: 'active' })`, refetching a query when
   any coalesced event's `matchesRefetchOn` accepts it, and counts it in
   `resync_queries_total{source}` (`source` is the event names joined by `+`).

`include: 'active'` already leaves out standby watchers (`skipToken` or
`skip: !isFocused`) and `cache-only` reads.

**A language switch catches up on navigation.** Catalog names come in the
request's language, but a screen paused at the switch has no active query for
the refetch to reach, and resumes on `cache-first`
([probe](verified-library-behaviour.md#apollo-tears-down-a-paused-screens-query-resubscribing-reads-the-current-fetch-policy)).
So after a real switch `languageChanged` also fires on every navigation
(`onNavigation`, wired in `App.tsx`; payload `switched: false`), and a batch of
only that event refetches just the active queries not answered since the
switch. The set is per switch, not per language: names live on shared entities,
so a screen paused through `en` → `es` → `en` reads what the `es` screens wrote.
A query joins it only once its refetch answers, and a catch-up waits while the
API is unavailable. A switch before any query exists (rehydration applying the
saved language) is not one. No screen carries code for it, and none is
remounted.

Evicting the names instead would blank every screen offline, and
`include: 'all'` does not reach a paused screen's torn-down query.

**A transient query opts out** with `refetchOn: false`: searches,
autocompletes, analytics, conversion and join-code previews, barcode lookups,
`CanDeleteAccount`. `__tests__/apollo/transientQueriesDeclineResync.test.ts`
fails when a Search*, Autocomplete*, \*Analytics or named preview query lacks
it. A one-shot `client.query` needs no opt-out; nothing re-runs it.

**A refresh must reach the server.** A `useLazyQuery` re-execute reuses the
observable's current policy, which the global `nextFetchPolicy: 'cache-first'`
has already switched, and `execute` in 4.2.12 takes no `fetchPolicy`. A lazy
query that re-issues to refresh sets `nextFetchPolicy: 'network-only'` on the
hook (`useRecipeIngredientMatching`); a time-to-live warmer uses
`client.query({ fetchPolicy: 'network-only' })` through `fromServer`
(`src/apollo/utils/fromServer.ts`), which returns nothing while the network is
withheld so a cached answer is never stamped fresh. Probe:
`src/apollo/__tests__/lazyReexecuteFetchPolicy.test.tsx`.

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
  ├─ Is this a SIMPLE FIELD UPDATE (toggle, setting, rename)?
  │   └─ YES → Write the fields locally before firing, revert on refusal (Pattern 5)
  │               [Shows at once, survives being queued]
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

No. Every write that shows before the server answers is a local write made
before firing:

```
START
  │
  ├─ Does the write CREATE an entity?
  │   └─ Write the whole row under a client-minted id, then fire (New Entity)
  │
  ├─ Does it EDIT fields of a row the cache holds?
  │   └─ Write the fields, then fire; revert on refusal (Pattern 5)
  │
  ├─ Does it REMOVE a row?
  │   └─ Unlink it, then fire; restore on refusal (Pattern 4)
  │
  └─ Does the server compute the result?
      └─ Fire and let the response normalize (Pattern 2)
```

An `optimisticResponse` is a layer Apollo removes when the mutation settles,
and the offline queue settles a queued write with a null result, so the change
would vanish while it is still waiting to be sent.

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
  ├─ Is it a search, autocomplete, preview or analytics read?
  │   └─ YES → defaults + refetchOn: false (see Resync)
  │
  ├─ Does a lazy query re-issue it to pick up changes?
  │   └─ YES → nextFetchPolicy: 'network-only' on the hook
  │
  ├─ Is it a one-shot warmer or time-to-live refresh?
  │   └─ YES → client.query({ fetchPolicy: 'network-only' }) via fromServer
  │
  └─ DEFAULT → fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first'

NOTE: The defaults are the global `watchQuery` defaults in `src/apollo/defaultOptions.ts`, so most call sites set nothing. Don't restate them; override only when the query needs to differ. A query that must not run yet takes `skipToken` in place of its options, never `skip:` with placeholder variables.
```

---

## Quick Reference

### Imports You'll Need

```typescript
// Cache update utilities
import { useApolloClient } from '@apollo/client';

// Query data preservation, scoped by subject key
import {
  usePreservedConnection,
  usePreservedNodes,
} from '#/hooks/apollo/usePreservedConnection';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';

// A list of masked refs, read live
import { useFragmentList } from '#/hooks/apollo/useFragmentList';

// A query that must not run yet
import { skipToken } from '@apollo/client/react';

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

❌ **Don't**: Let an `errorPolicy: 'ignore'` list read as empty after a failed refetch
✅ **Do**: Wrap it in `usePreservedConnection` / `usePreservedNodes` with the subject's key

❌ **Don't**: Call `cache.readFragment` over query data while rendering — a masked result keeps its identity when only masked fields change, so the read freezes
✅ **Do**: `useFragment` (`from: x ?? null`) or `useFragmentList` for a list (lint: `renderTimeReadFragment`)

❌ **Don't**: Pass `skip: !id` with `variables: { id: id ?? '' }`
✅ **Do**: `useQuery(Doc, id ? { variables: { id } } : skipToken)`

❌ **Don't**: Add an app-lifecycle or reconnect listener that refetches
✅ **Do**: Rely on [Resync](#resync); opt a transient query out with `refetchOn: false`

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
  // Every call queues when the API is unreachable.
  context: { localFirst: true },
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
  () => addItemMutation({ variables: { input: { ...input, id } } }),
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

| Operation         | Cache Update Needed? | Use This                                             |
| ----------------- | -------------------- | ---------------------------------------------------- |
| **Create/Add**    | YES                  | `createAddToParentConnectionUpdater()`               |
| **Update**        | NO                   | Apollo auto-normalizes by `__typename` + `id`        |
| **Delete/Remove** | YES                  | `createRemoveFromParentConnectionUpdater()`          |
| **Toggle field**  | YES, before firing   | A local field write, reverted on refusal (Pattern 5) |

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

The notification feed, each row's read-state and the unread badge live in the
Apollo cache and nowhere else ([architecture.md](architecture.md) § State).
The badge is `Query.notificationSummary { id unreadCount hasUrgent }`, whose
`id` is the caller's user id, so it normalizes as `NotificationSummary:<userId>`;
`GetUnreadNotifications` and `GetNotifications` select it at the root, and
`useUnreadNotificationCount` and the OS badge (`badgeSync.ts`) read it from the
cache. `src/features/notifications/utils/notificationCacheWrites.ts` is the one
place the transitions are applied — by the user acting locally AND by the
subscription handler. The Zustand slice keeps only `pendingExpirationLinks`,
which the cache genuinely cannot hold: the expiration enrichment on the pantry
event stream (`usePantrySubscriptions` → `linkExpirationData`) can arrive
BEFORE the notification it enriches, when there is no row to attach it to.

**Every notification write states the badge; a local delta stands in only until
it answers.** Each notification mutation selects `notificationSummary` on its
payload, so the response lands on the same `NotificationSummary:<userId>`
record `Query.notificationSummary` points at and settles the badge by
normalization — a response that states a count settles it. The local write
moves the badge by a delta BEFORE the mutation fires
(`notificationBadgeCacheUpdaters.ts`, which finds the record through
`ROOT_QUERY.notificationSummary` and no-ops when none is cached), so a queued or
offline write shows at once; no handler applies a delta after a response. A
queued write's replay writes its response the same way. A refusal carries no
summary, so its rollback is the one delta that follows a response.

**A server-delivered event re-reads the badge.** Not a style choice — Apollo
normalizes a subscription's `node` into the cache BEFORE `onData` runs (the same
ordering as the filtered-connections pattern above), so by the time a `READ`
handler asks "was this unread?", the event's own payload has already answered
"no". The guard that makes a re-delivered event safe is therefore useless on
that path, and a delta would be wrong in both directions.
`useNotificationListener` calls `reseedUnreadCount()` on every server event
instead, which re-reads `Query.notificationSummary` through the
`NotificationSummary` query (`network-only`, coalesced over 300 ms); an
aggregate `BULK_*` event, whose rows are unknown here, re-reads the unread feed
(`GetUnreadNotifications`), which states the badge too. The server's count is
also the truer number: it counts unread notifications this device has never
paged in, which a local ±1 could only approximate. Verify the ordering claim
with a subscription whose `onData` reads `cache.extract()`.

**The pantry's counts follow the same rule.** A local write moves
`stats.totalItems` by a delta (`adjustPantryItemCount`), the one count a row
alone can settle. Every `ITEM_CHANGED` event, another device's AND this
device's own echo, re-reads the whole `stats`, header and location tabs
together, through `PantrySummaryForEvent`, coalesced in `usePantrySubscriptions`.
The server pushes no stats event: `PANTRY_UPDATED` is pantry metadata (its
schema doc), so without the re-read a remote delete removes the row and leaves
the header and tabs counting it.

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

| Utility | Use Case |
| ------- | -------- |

**Misc helpers in the same file:** `safeEvict`, `safeEvictMany` (evicts,
releases each entity's retains, one gc), `adoptServerEntityId`,
`releaseEntity`, `skipUnmatchedFilterVariants`, `skipUnmatchedArgVariants`.
An `evictItem: true` removal also filters the edge out of the owning
connection, so a delete response that writes back the deleted `{ id }` cannot
make the row readable again.

**Field patches** (`src/apollo/utils/localFirstFields.ts`): `snapshotFields`
captures what a local write is about to change, `writeEntityFields` writes it
through a fragment (so an unheld field is added, not silently skipped), and the
revert writes the snapshot back. `updateEntityFieldsLocalFirst` runs the whole
lifecycle for a settings-shaped entity.

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

### Local row helpers (`src/apollo/utils/createOptimisticResponse.ts`)

| Utility                                    | Use Case                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `enhanceWithVersion(currentItem, updates)` | The row a local write stores: the cached entity with the edit, `version` kept (the server moves it) and `updatedAt` stamped |

### CRUD Operations (`src/hooks/utils/useCrudOperations.ts`)

`useCrudOperations()` builds one wrapper: a remove that confirms first when
given a `confirmMessage`, then settles the write.

| Helper                          | Provides                                      |
| ------------------------------- | --------------------------------------------- |
| `createRemoveOperation(config)` | Confirmation dialog, then the settled removal |

---

## Cache Persistence & Restoration

The app persists Apollo's normalized cache to MMKV so cold starts paint from cache instantly and so cached data remains available offline. Persistence is implemented in `src/apollo/offline/ApolloCachePersistence.ts`; `createApolloClient()` wires it as it builds the client, and `App.tsx` restores it on mount.

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
- Use `extractNodes()` (`src/utils/connectionUtils.ts`), which returns `[]` for
  missing edges.
- Every document that writes a merged connection's `edges` also selects
  `pageInfo { hasNextPage endCursor }`, even for a fixed-size preview: the
  first-page merge reads a missing `hasNextPage` as "this page is the whole
  list" and cuts every other reader of the field down to it. A fragment used
  only to read the cache (`readFragment`, `useFragment`) writes nothing and is
  exempt on its own; there is no allowlist (`sharedConnectionSelections.test.ts`).
- Use a `cache-and-network` → `cache-first` fetch policy so the network fires
  immediately on restore; stale persisted `pageInfo`/edges self-correct when
  the response arrives (a brief flash of stale pagination state is acceptable).

---

## Fragment Composition & Data Masking

`dataMasking: true` is enabled globally (`src/apollo/client.ts`). The project
follows Apollo Client 4.x's recommended pattern: **per-component / per-hook
colocated fragments**, masked at the type level, materialized through
`useFragment` (anything that renders or derives from the data) or
`cache.readFragment` (one-shot reads in handlers, effects, mutation and
subscription callbacks). The enforced rules are summarized in CLAUDE.md; this
section carries the mechanism, the templates, and the reasoning.

### Never read a fragment while rendering

With masking on, Apollo compares a query's results on the masked selection and
keeps the same `data` object when that selection is unchanged. A change to a
field that lives only behind a spread therefore neither re-emits the query nor
changes `data.x`'s identity, and a render-time `cache.readFragment(data.x)` —
memoized by the React Compiler on that identity — stays on the old value for
the whole mount
([verified](verified-library-behaviour.md#apollo-masked-results-keep-identity-when-only-masked-fields-change)).
Read it with `useFragment({ from: data?.x ?? null })`, or for a list with
`useFragmentList` (`src/hooks/apollo/useFragmentList.ts`), which wraps Apollo
4.1's array `from`: one live result per entry, `null` for an entry not
completely cached, left to the caller to count rather than drop. Don't re-select
a field inline in the query just so the query re-emits; that dependency is
invisible and the next cleanup freezes the value. The lint entry
`renderTimeReadFragment` (`docs/rules/restricted-syntax.md`) bans a
`readFragment` in a feature hook's render body; a module-level helper called
while rendering is not caught, so review holds that part.

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

| Shape                  | Prop type                                | Cache miss                   | Use for                                                                                                                                                                    |
| ---------------------- | ---------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strict**             | `FragmentType<typeof XDoc>`              | `return null` on `!complete` | List cells (`MyRecipeCard`, `SavedRecipeCard`, `PantryItemCard`, `HomeMemberCard`, `MealPlanItemCard`, `TemplateCard`), and `MealPlanSettingsSheet` — brief blanking is OK |
| **Resilient fallback** | `FragmentType<typeof XDoc> \| XFragment` | Fall back to the source prop | Detail panels (`PantryDetailInfo`), and cells whose parent already reads the full entry live to sort it (`BatchListItem`, `ReviewCard`) — must render without blanking     |

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
and fragment by `sous-chef/selects-key-field-directly`;
`@graphql-eslint/require-selections` asks for the `id` of any type carrying one
but accepts it inside a spread, so it cannot hold this alone.

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

`Unmasked<>` appears only where Apollo's own signature carries it: an
`optimisticResponse` callback's return, and the data a cache writer passes
between `cache.readFragment` / `writeFragment` (both typed `Unmasked<TData>`,
e.g. `writeEntityFields`, `writeLocalEntity`). Never a
prop, state or a hook's return that reaches what renders. Don't use `@unmask` (any mode): it's an Apollo migration tool,
not a steady-state pattern. The HKT registration in
`src/types/apollo-masking.d.ts` is required for `FragmentType<typeof Doc>` to
resolve.

### Testing masked components

Tests must wrap with `renderWithApollo` from `#/test-utils/apolloMockProvider`
(so `useFragment` has an Apollo context) and include `__typename` on the
literal fixture. For hooks that read from cache via `cache.readFragment`, use
`seedCache([...])` to pre-write the entity. Do not
`jest.mock('@apollo/client/react', …)` directly — banned by lint
(`no-restricted-syntax`: `apolloReactMock`).

### Why not `client-preset`

The client-preset bundles its own type-level fragment-masking helper
(`@graphql-codegen/client-preset`'s `useFragment`) that **conflicts** with
Apollo Client 4.x's runtime data masking. Apollo's docs explicitly advise
against client-preset for AC4 projects. Our `near-operation-file` setup
already emits `TypedDocumentNode`s, which is all Apollo's
`FragmentType<typeof Doc>` and runtime masking need.

---

## Apollo Client 4.x Notes

This project uses Apollo Client `^4.2.12`. What each 4.x feature is used for here:

| Hook / API                                                 | Purpose                 | Status                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hook / API                                                 | Since                   | Status                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---                                                        | ---                     | ---                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `dataMasking: true` + `useFragment`                        | 4.0                     | **Adopted.** See [Fragment Composition & Data Masking](#fragment-composition--data-masking).                                                                                                                                                                                                                                                                                                                                           |
| `useFragment` with an array `from`                         | 4.1                     | **Adopted** through `useFragmentList` for lists of masked refs.                                                                                                                                                                                                                                                                                                                                                                        |
| `from: null` on `useFragment`                              | 4.1                     | **Adopted** for a fragment whose source may be absent (`from: x ?? null`), in place of a placeholder id.                                                                                                                                                                                                                                                                                                                               |
| `skipToken`                                                | 4.0                     | **Adopted** for queries. A query that must not run yet passes `skipToken` instead of its options. It keeps the last run's `variables` and `data`, so a hook whose subject can change while skipped compares `result.variables` with the current subject ([verified](verified-library-behaviour.md#apollo-skiptoken-keeps-serving-the-last-runs-data)). `useSubscription` has no `skipToken` overload, so subscriptions stay on `skip`. |
| Modern signatures (`DeclareDefaultOptions`)                | 4.2                     | **Adopted.** `src/types/apollo-default-options.d.ts` declares `errorPolicy: 'all'` and `returnPartialData: false`, so result types carry them; manually passed generics are rejected.                                                                                                                                                                                                                                                  |
| `RefetchEventManager` + `refetchOn`                        | 4.2                     | **Adopted** with app-owned sources. See [Resync](#resync). The built-in `windowFocusSource` / `onlineSource` listen to browser `window` events and do nothing in React Native.                                                                                                                                                                                                                                                         |
| `extensions` on cache writes, read in `merge`              | 4.1                     | **Adopted** for `writePurchaseInfo` (`extensions: { local: true }`).                                                                                                                                                                                                                                                                                                                                                                   |
| Hook-level `context` on `useMutation`                      | 4.0 (callback form 4.1) | **Adopted.** `localFirst` is set on the `useMutation` options; a per-call context object replaces it, so extra keys use the callback form (`docs/local-first-architecture.md` § 2).                                                                                                                                                                                                                                                    |
| `cache.updateFragment`                                     | 3.5                     | Available. Most local writes need a snapshot for their revert, so `snapshotFields` + `writeEntityFields` is used instead.                                                                                                                                                                                                                                                                                                              |
| `dataState`                                                | 4.0                     | Not used. Screens gate on `loading && !data` (CLAUDE.md) and classify a surface with the app's own `useDataState`.                                                                                                                                                                                                                                                                                                                     |
| `useSuspenseQuery` / `useBackgroundQuery` / `useReadQuery` | 4.0                     | **Not adopted** (rationale below).                                                                                                                                                                                                                                                                                                                                                                                                     |
| `@defer` / `@stream`                                       | 4.1                     | **Not adopted.** The API (Apollo Server 5 on graphql 16) has no incremental delivery.                                                                                                                                                                                                                                                                                                                                                  |
| `apollo3-cache-persist`                                    | —                       | **Not adopted** — see [Cache Persistence & Restoration](#cache-persistence--restoration).                                                                                                                                                                                                                                                                                                                                              |

#### AC 4.0 New Concepts

- **`dataState` property**: AC 4.0 adds `dataState` (`'empty' | 'partial' | 'streaming' | 'complete'`) to query results; `dataState === 'complete'` narrows `data` in the types.
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

**Fragment file layout and naming, and the `@unmask` policy:**
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

- **Mutation patterns**: `useAddToPantry.ts` (local-first create through `writeLocalPantryItem` + `settleMutation`), `createShoppingListRow` in `src/features/shoppingList/cache/createShoppingListRow.ts` (the shopping-row create lifecycle every add site shares), `useToggleShoppingItem.ts` (a permanent local write, reverted on a refusal), `updateEntityFieldsLocalFirst` (settings-shaped entities).
- **Replay reconciliation**: `REPLAY_RECONCILERS` in `src/apollo/offlineQueue/queueReplayReconcilers.ts`; `__tests__/apollo/replayReconcilerCoverage.test.ts` fails when a queueable mutation's foreground `update` adopts or withdraws an entity and no reconciler does the same on replay.
- **Resync**: `src/apollo/refetchEvents.ts`.
- **Fragment reads**: `useFragmentList` (`src/hooks/apollo/useFragmentList.ts`); `useRecipeData` for a single masked entity.
- **Cache updater utilities**: `src/apollo/utils/cacheUpdaters.ts`
- **Subscription setup**: `src/hooks/subscriptions/` and `src/services/subscriptions/SubscriptionService.ts`
- **Fetch policies**: global `watchQuery` defaults in `src/apollo/defaultOptions.ts` cover the common case. Override per-query only when the policy needs to differ.
- **Error handling**: `src/apollo/utils/settleMutation.ts` (it also reports a failed write, quiet for a network failure during a known outage), `src/services/errorService.ts`, `src/utils/errors/versionConflict.ts`

---

**Last Updated**: 2026-09-29
**Maintainers**: Development Team
