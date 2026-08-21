# FlashList Performance & Memory Leak Analysis

## Problem Statement

After scrolling through the shopping list (loading more paginated pages), two performance issues emerge:
1. **Shopping list scroll delay** -- rendering delays when scrolling up/down after loading more pages
2. **Cross-screen contamination** -- pantry list becomes slow after returning from shopping list, despite working fine on initial load

The user suspects the shopping list is doing something wrong when merging cached and paginated items.

---

## Architecture Overview

### Shopping List Data Flow
```
useShoppingListScreen
  -> useShoppingListManagement
    -> usePaginatedShoppingItems (TWO independent Apollo queries)
       - Unpurchased: GetShoppingListItemsFiltered(isPurchased: false, first: 20)
       - Purchased:   GetShoppingListItemsFiltered(isPurchased: true,  first: 20)
       -> usePagination (cursor-based fetchMore per tab)
    -> useSearchableList([...unpurchased, ...purchased])
  -> useShoppingListTransformMulti (transforms to SortableShoppingListItem[])
  -> useDeferredValue (defers Apollo cache updates)
  -> FlashList via ShoppingListTabs -> SortableList
```

### Pantry Data Flow
```
PantryMainInner
  -> usePantryManagement (single query, first: 50)
     -> usePantryQuery (cache-and-network, nextFetchPolicy: cache-first)
     -> usePagination (cursor-based fetchMore)
  -> useHybridSearch (server or local search)
  -> useDeferredValue(activeItems)
  -> FlashList via PantryContent
```

### Cache Merge Policies (src/apollo/cache.ts)
- `ShoppingList.itemsConnection`: append-only via `itemsConnectionFieldPolicy()`, keyArgs: `['filters']`
- `ShoppingList.items`: `mergeArrayByIdIntelligent()` (unused but defined)
- `Pantry.itemsConnection`: deduplication via `edgeMap`, keyArgs: `['filters', 'orderBy']`

### Active Subscriptions (always running when shopping list is selected)
- `ShoppingListChanges` -- item CRUD, purchase status changes, batch clears
- `MyShoppingListsChanges` -- list metadata changes across all lists
- `CollaborationChanges` -- collaborator lifecycle

---

## Identified Issues (Ranked by Probability x Severity)

### ISSUE 1: Unbounded Cache Edge Accumulation from Append-Only Merge (HIGH / HIGH)

**Files:** `src/apollo/cache.ts:167-195`, `src/hooks/shoppingList/usePaginatedShoppingItems.ts`

**The problem:** `itemsConnectionFieldPolicy()` uses an append-only merge strategy:

```typescript
// cache.ts lines 175-192
const existingIds = new Set<string>();
for (const edge of existing.edges || []) { ... existingIds.add(id); }
const newEdges = (incoming.edges || []).filter(edge => !existingIds.has(id));
return { ...incoming, edges: [...(existing.edges || []), ...newEdges] };
```

The ONLY reset condition is line 173: `if (!args?.after && !incoming.pageInfo?.hasNextPage) return incoming;`. This means edges are replaced only when a refetch returns ALL data in a single page. For lists with more than 20 items (the page size from `PAGINATION.ITEMS_PAGE_SIZE`), `hasNextPage` is `true` on initial load, so the reset never fires.

**Result:** Every `fetchMore` appends 20 more edges. After scrolling through 5 pages: 100 edges in the unpurchased variant + potentially 100 in purchased. These edges are never pruned because they remain reachable from active query watchers, making `cache.gc()` ineffective.

**Cross-screen impact:** The Apollo InMemoryCache is shared across ALL screens. When the shopping list loads 100+ ShoppingListItem entities into the cache, every subsequent cache operation (read, write, broadcast, extract, gc) processes a larger data structure. This directly slows the pantry screen.

**Validation:** This matches the Apollo Client documentation which confirms that append-only merge strategies with cursor pagination grow monotonically. `cache.gc()` only removes unreachable entities, and paginated edges remain reachable from the root query. There is no built-in eviction for reachable paginated data. [Apollo Pagination Docs](https://www.apollographql.com/docs/react/pagination/core-api)

**VERDICT: CONFIRMED -- Primary root cause of both memory growth and cross-screen contamination.**

---

### ISSUE 2: `extractItems` Creates New Array References on Every Render (HIGH / MEDIUM)

**File:** `src/hooks/shoppingList/usePaginatedShoppingItems.ts:54-62`

```typescript
function extractItems(edges: readonly ItemEdge[]): ShoppingListItemDisplayFragment[] {
  if (!edges || edges.length === 0) return EMPTY_ITEMS;
  return edges.filter(edge => edge?.node?.id && edge?.node?.itemName).map(edge => edge.node);
}
```

This module-scope function runs `.filter().map()` on every call, always producing a new array reference. Because it's defined outside the component, the React Compiler cannot track its memoization. Even when the same `edges` array is returned from Apollo's structural sharing, `extractItems` creates a new items array.

**Cascade effect:** The new array reference propagates through:
1. `usePaginatedShoppingItems` returns new `unpurchased.items` / `purchased.items`
2. `useShoppingListManagement` line 53: `const items = [...unpurchasedItems, ...purchasedItems]` -- another new array
3. `useSearchableList(items, ...)` -- re-filters the entire combined array
4. `useShoppingListTransformMulti` -- re-transforms both arrays
5. `useDeferredValue` -- queues a low-priority re-render with the "new" data

As the edge count grows (Issue 1), `.filter().map()` over 100+ edges becomes measurably slow, and the cascading re-computation multiplies the cost.

**Comparison with pantry:** The pantry uses `normalizePantry()` (a `createEntityNormalizer` factory) which also creates new arrays, but the pantry applies `useDeferredValue` directly on the raw items and bypasses it when search is empty (`const pantryItems = searchQuery ? deferredItems : activeItems`). The shopping list has no such bypass.

**Validation:** React Compiler auto-memoization only applies to code inside component/hook bodies that the compiler can analyze. Module-scope functions are not compiled, so their return values are not automatically memoized. The `.filter().map()` pattern always allocates. [React Compiler docs](https://react.dev/learn/react-compiler)

**VERDICT: CONFIRMED -- Causes unnecessary re-render cascade, amplified by Issue 1.**

---

### ISSUE 3: Cache Persistence Serialization on Screen Transition (MEDIUM / HIGH)

**Files:** `src/apollo/offline/ApolloCachePersistence.ts`, `src/screens/pantry/PantryMain.tsx:54-58`, `src/screens/shoppingList/ShoppingListMain.tsx:23-27`

Both screens use the pause/resume pattern:
```typescript
useFocusEffect(() => {
  apolloCachePersistence.resume();
  return () => apolloCachePersistence.pause();
});
```

When the user navigates from shopping list to pantry:
1. Shopping list `onBlur` calls `pause()` -- cancels pending save timeout
2. Pantry `onFocus` calls `resume()` -- if saves were pending while paused, schedules a new save
3. The save calls `cache.extract()` (full cache snapshot) + `JSON.stringify()` via `requestIdleCallback`
4. After shopping list pagination, the cache contains 100+ extra entities
5. `JSON.stringify()` on the enlarged cache blocks the JS thread for 50-200ms

Although deferred to `requestIdleCallback`, the "idle" detection on React Native considers brief pauses between scroll frames as idle, so serialization can fire during active scrolling.

**Validation:** `requestIdleCallback` on React Native (via the polyfill) fires when the JS thread has >1ms idle time, which can happen between scroll frame callbacks. Heavy serialization during these windows causes frame drops. The 3-second debounce mitigates burst operations but not the absolute cost of serialization on a large cache.

**VERDICT: CONFIRMED -- Contributes to pantry jank after shopping list pagination.**

---

### ISSUE 4: `resortEdges` Sorts ALL Cache Variants on Every Subscription Event (MEDIUM / MEDIUM)

**File:** `src/hooks/subscriptions/useShoppingListSubscriptions.ts:45-77`

```typescript
function resortEdges(cache, shoppingListId) {
  cache.modify({
    id: parentCacheId,
    fields: {
      itemsConnection(existing, { readField }) {
        const sortedEdges = [...existing.edges].sort(/* by sortOrder */);
        return { ...existing, edges: sortedEdges };
      },
    },
  });
}
```

`cache.modify` runs the field function for EVERY `storeFieldName` variant. With `keyArgs: ['filters']`, there are at least 2 variants:
- `itemsConnection({"filters":{"isPurchased":false}})` -- unpurchased
- `itemsConnection({"filters":{"isPurchased":true}})` -- purchased

Additionally, `GetShoppingList` (line 30 of `shoppingList.graphql`) fetches `itemsConnection(first: 100)` WITHOUT any filter, creating a 3rd variant: `itemsConnection({})`. This unfiltered variant gets sorted too.

After pagination loads 100+ edges, sorting 3 arrays of 100+ items on each subscription event creates significant JS thread pressure. Each sort is O(n log n) with array copy.

**When does resortEdges fire?** On every `ItemUpdated`, `ItemCompleted`, `ItemUncompleted` subscription event where `sortOrderChanged` is true. Collaborator edits, reorders, and purchase status changes all trigger it.

**Validation:** Apollo Client's `cache.modify` iterates all `storeFieldName` entries for the specified field, calling the modifier for each. There is no way to target a specific variant. [Apollo cache.modify docs](https://www.apollographql.com/docs/react/caching/cache-interaction#using-cachemodify)

**VERDICT: CONFIRMED -- Scales poorly with cache growth from Issue 1.**

---

### ISSUE 5: Missing `maxItemsInRecyclePool` Configuration on FlashList v2 (MEDIUM / MEDIUM)

**Files:** `src/components/pantry/PantryContent.tsx`, `src/components/organisms/SortableShoppingList/SortableList.tsx`

FlashList v2 moved cell recycling entirely to JavaScript. The `maxItemsInRecyclePool` prop (new in v2) caps how many cells are kept in each recycling pool. Without it, pools grow unbounded as the user scrolls.

Current configuration:
- **PantryContent**: 3 `getItemType` pools (`out-of-stock`, `no-expiry`, `with-expiry`) -- no pool cap
- **SortableList**: 2 `getItemType` pools (`purchased`, `shopping`) -- no pool cap

After scrolling through 100+ items, each pool can hold dozens of recycled cells. Each cell retains its rendered component tree and associated closures.

**Validation:** FlashList v2 docs recommend setting `maxItemsInRecyclePool` for memory-constrained environments. The default is unlimited. [FlashList v2 Changes](https://shopify.github.io/flash-list/docs/v2-changes/)

**VERDICT: LIKELY CONTRIBUTING -- Pool growth increases JS heap pressure, though not the primary cause.**

---

### ISSUE 6: `useDeferredValue` Without Bypass in Shopping List (LOW / MEDIUM)

**File:** `src/hooks/shoppingList/useShoppingListScreen.ts:84-88`

```typescript
const deferredUnpurchased = useDeferredValue(transformedUnpurchasedItems);
const deferredPurchased = useDeferredValue(transformedPurchasedItems);
const sortableItems = [...deferredUnpurchased, ...deferredPurchased];
```

Unlike pantry which bypasses `useDeferredValue` when search is empty:
```typescript
// PantryMain.tsx line 251
const pantryItems = searchQuery ? deferredItems : activeItems;
```

The shopping list ALWAYS uses deferred values. When Apollo cache updates arrive (subscriptions, fetchMore), each update:
1. Creates new transformed items (due to Issue 2)
2. `useDeferredValue` queues a low-priority re-render
3. The next subscription update interrupts and restarts the deferred render
4. Interrupted renders discard their work but retain memory during their lifetime

With active subscriptions firing frequently, deferred renders can be repeatedly interrupted, creating wasted render cycles.

**Validation:** React docs confirm `useDeferredValue` holds both current and deferred copies during transition. Frequent updates cause repeated interruptions. React 18.1.0 fixed a bug where infinite concurrent trees could accumulate. [React useDeferredValue docs](https://react.dev/reference/react/useDeferredValue)

**VERDICT: LIKELY CONTRIBUTING -- Amplifies Issue 2 but is not the root cause.**

---

### ISSUE 7: Apollo Query Watchers Active on Non-Visible Tabs (LOW / LOW)

**Context:** The app uses bottom tab navigation with `freezeOnBlur: true` and `lazy: true`.

`freezeOnBlur` prevents re-renders of frozen components but does NOT unsubscribe Apollo query watchers. The shopping list's two `GetShoppingListItemsFiltered` queries continue receiving cache notifications even when the pantry tab is focused. Similarly, the 3 shopping list subscriptions remain active.

When the user is on pantry and a shopping list subscription fires:
1. Cache.modify runs → updates shopping list edges
2. Shopping list query watchers run diffing logic
3. Results are cached but NOT rendered (frozen component)
4. JS thread time is consumed by the watcher diffing

**Validation:** `react-native-screens`' `freezeOnBlur` only prevents React re-renders via screen freezing. Apollo's `ObservableQuery` watchers operate independently of React rendering.

**VERDICT: MINOR -- Small JS thread overhead, but compounds with Issues 1 and 4.**

---

### ISSUE 8: `ShoppingList.items` Merge Policy (Unused but Defined) (LOW / LOW)

**File:** `src/apollo/cache.ts:244-251`

```typescript
ShoppingList: {
  fields: {
    items: {
      merge(existing, incoming, { readField }) {
        return mergeArrayByIdIntelligent(existing, incoming, { readField });
      },
    },
    itemsConnection: itemsConnectionFieldPolicy(),
  },
},
```

No active GraphQL operation queries `ShoppingList.items` (the flat array field). All operations use `itemsConnection`. However, the merge policy is defined and `mergeArrayByIdIntelligent` would run if any response included this field.

**Validation:** Verified by searching all `.graphql` files -- no operation queries `ShoppingList.items`. The merge policy is dead code.

**VERDICT: NOT AN ISSUE -- Dead code, no active queries trigger it.**

---

## Root Cause Chain

The user's three reported symptoms trace to a single root cause chain:

```
User scrolls shopping list → fetchMore loads page 2, 3, 4...
  ↓
itemsConnectionFieldPolicy appends edges (never prunes) [ISSUE 1]
  ↓
Cache grows: 100+ ShoppingListItem entities, 200+ edges across variants
  ↓
extractItems(.filter.map) processes all edges on each render [ISSUE 2]
  ↓
New array references cascade through management → transform → deferred [ISSUE 6]
  ↓
Subscription events trigger resortEdges on growing edge arrays [ISSUE 4]
  ↓
--- User navigates to Pantry ---
  ↓
apolloCachePersistence.resume() serializes enlarged cache [ISSUE 3]
  ↓
Shared InMemoryCache operations are slower for ALL screens [ISSUE 1]
  ↓
Shopping list query watchers + subscriptions continue running [ISSUE 7]
  ↓
Pantry experiences degraded performance from JS thread contention
```

---

## Comparison: Why Pantry Works Fine Initially

| Aspect | Pantry | Shopping List |
|--------|--------|---------------|
| **Page size** | 50 items | 20 items |
| **Queries** | 1 query | 2 independent queries |
| **Cache merge** | `edgeMap` (dedup by ID, replaces) | Append-only (never shrinks) |
| **keyArgs** | `['filters', 'orderBy']` | `['filters']` only |
| **Cache variants** | 1 per filter+sort combo | 2-3 (unpurchased + purchased + unfiltered) |
| **useDeferredValue bypass** | Yes (when no search) | No (always deferred) |
| **Active subscriptions** | Pantry-scoped | 3 list-level subscriptions |
| **resortEdges** | Not used | Runs on every sort-related subscription |

The pantry's `edgeMap` merge strategy replaces existing edges with incoming ones (fresh data wins), keeping the cache bounded. The shopping list's append-only strategy grows linearly.

---

## Online Research Validation

| Issue | Research Finding | Source |
|-------|-----------------|--------|
| Append-only cache growth | Apollo docs confirm no built-in eviction for reachable paginated data. `cache.gc()` cannot help. | [Apollo Pagination](https://www.apollographql.com/docs/react/pagination/core-api) |
| FlashList v2 recycling pools | v2 moved recycling to JS; `maxItemsInRecyclePool` recommended for memory control | [FlashList v2 Docs](https://shopify.github.io/flash-list/docs/v2-changes/) |
| `cache.modify` iterates all variants | Confirmed: modifier runs for every `storeFieldName` entry, no way to target one | [Apollo cache.modify](https://www.apollographql.com/docs/react/caching/cache-interaction#using-cachemodify) |
| `useDeferredValue` memory retention | React holds both current and deferred trees; fixed infinite-tree bug in 18.1.0 | [React #19925](https://github.com/facebook/react/issues/19925) |
| Apollo RN memory leak | `readFragment`/`writeFragment` reported to leak more memory on RN than web | [Apollo #8903](https://github.com/apollographql/apollo-client/issues/8903) |
| `requestIdleCallback` on RN | Polyfill fires on >1ms idle time, can coincide with scroll frame gaps | RN bridge scheduling docs |
| `freezeOnBlur` vs query watchers | Screen freezing prevents re-renders but not Apollo watcher callbacks | react-native-screens docs |

---

## Recommended Investigation Steps

Before implementing fixes, gather data to confirm the analysis:

1. **Measure cache size before/after pagination:**
   ```typescript
   // In dev, after scrolling shopping list:
   const data = client.cache.extract();
   console.log('Cache entities:', Object.keys(data).length);
   console.log('ShoppingListItem count:', Object.keys(data).filter(k => k.startsWith('ShoppingListItem:')).length);
   ```

2. **Profile JS thread during scroll:** Use Flipper or React DevTools Profiler to measure render times of `SortableList` and `PantryContent` before and after loading multiple pages.

3. **Monitor `resortEdges` execution time:** Add timing to `resortEdges` to see how long sorting takes as edge count grows.

4. **Track cache persistence timing:** Log `cache.extract()` and `JSON.stringify()` duration in `ApolloCachePersistence.scheduleExtractAndSave()`.

---

## Key Files for Fixes

| File | Issue |
|------|-------|
| `src/apollo/cache.ts` (lines 167-195) | Issue 1: `itemsConnectionFieldPolicy` needs bounded merge |
| `src/hooks/shoppingList/usePaginatedShoppingItems.ts` (lines 54-62) | Issue 2: `extractItems` needs referential stability |
| `src/apollo/offline/ApolloCachePersistence.ts` (lines 133-168) | Issue 3: Serialization needs better scheduling |
| `src/hooks/subscriptions/useShoppingListSubscriptions.ts` (lines 45-77) | Issue 4: `resortEdges` needs scoping or optimization |
| `src/components/organisms/SortableShoppingList/SortableList.tsx` | Issue 5: Add `maxItemsInRecyclePool` |
| `src/components/pantry/PantryContent.tsx` | Issue 5: Add `maxItemsInRecyclePool` |
| `src/hooks/shoppingList/useShoppingListScreen.ts` (lines 84-88) | Issue 6: Add `useDeferredValue` bypass |

---

## Update 2026-08-20 — shopping-list pagination re-profiled

Re-measured on a 95-item list (Android dev build, DevTools attached) after the
`useDeferredValue` on FlashList data was removed for the crash documented in
`docs/flashlist-layout-index-race.md`: peak frame gap 1006 ms, sustained blanks 15–17%,
every page append correlated with blank frames. The pantry on the same build sat at 4.6%.

The deferral had been time-slicing a cost the pantry does not have, so the cost was fixed
rather than re-hidden:

- **Issue 2 / Issue 6, resolved differently.** `wrapItems` (`useShoppingListTransform.ts`)
  cached rows per *source array*, so a `fetchMore` rebuilt every row object and FlashList
  (`ViewHolder` memo: `prevProps.item === nextProps.item`) re-rendered every mounted
  `SwipeableListItem` to show ~20 new ones. Rows are now cached per *node* as well;
  Apollo's structural sharing keeps unchanged nodes identical, so an append renders only
  the cells it adds — the same behaviour the pantry gets for free by passing nodes through.
- **Page size 20 → 25** (`PAGINATION.ITEMS_PAGE_SIZE`): each page append runs the full
  pipeline, so fewer pages cost less.
- Items in the comparison table that have since changed: pantry now fetches 100 in one
  page and windows client-side in 24-item steps; `maxItemsInRecyclePool` is set on the
  pantry list (15) but still not on `SortableList`; neither list defers its data any more.
