# Local-First Architecture

**Status:** Implemented (item creates/removes across pantry & shopping). Last validated 2026-06-04
against the codebase.

**Goal.** A user can add, remove, and adjust items on their own data **instantly, with no network
round-trip and while fully offline**. The API is for **syncing across collaborators and devices**, not a
prerequisite for the action. Online-only features (smart search, barcode lookup, recipe
discovery/AI, invites/sharing, auth, image upload) degrade rather than block.

This document describes how the system actually works today. It supersedes the original planning
notes; where the implementation diverged from the plan, the divergence is called out.

---

## 1. Read path — local-first

- Apollo `InMemoryCache` is persisted to MMKV as-is (`ApolloCachePersistence.ts`): `cache.extract()` /
  `cache.restore()` with no transformation, so connection wrappers (`edges`, `pageInfo`) survive across
  launches. `cache.write/modify/evict/gc` are wrapped in `client.ts` to re-persist (debounced ~3s). Cold
  start paints from disk. On app **background**, `useAppStateLifecycle` calls `flushCachePersistence()`
  (`ApolloCachePersistence.flushPending`) to write the pending debounced snapshot immediately — so the
  last few seconds of writes (including optimistic creates) survive a fast app-kill; no-op when nothing is
  pending (see §6).
- Default fetch policy `cache-and-network` → instant cache read + background refresh.
- A transient API failure does not wipe cached lists: `usePreservedConnection` /
  `usePreservedQueryData` keep the last good value, and the `itemsConnection.merge` guard only honors an
  **authoritative** `totalCount: 0` (see the cache-connection-resilience note).
- A first-page background refetch that lands **before** the queue replays an offline create no longer
  drops that item. The `itemsConnection.merge` first-page branch preserves existing edges whose id still
  has a PENDING mutation in the queue (`queueStore.getPendingClientIds()`), then falls straight through to
  the authoritative page once the queue drains. A genuinely **server-deleted** item (no pending op) is
  still dropped, so the page stays authoritative.

## 2. Write path — the implemented pattern

Local-first mutations **write the change to the cache permanently *before* firing the mutation, and
leave it there.** They do **not** use Apollo's `optimisticResponse`.

Why not `optimisticResponse`: Apollo applies the optimistic response at the cache layer but does not put
it in the link `context`. So when the offline queue intercepts the request and completes it with a
`null` result, Apollo tears the optimistic layer down — the change flashes and vanishes. A permanent
cache write (`cache.modify` / `writeFragment` / a connection updater) goes through the persist wrapper to
MMKV and is what the queue later reads to replay. This is the house pattern documented in CLAUDE.md
("cache.modify before mutation + revert on error").

Lifecycle of a local-first mutation:

```
1. id = generateEntityId()                      // creates only — a permanent CUID v1 (the row's PK)
2. write the entity/change PERMANENTLY to cache  // shows instantly, persisted to MMKV
3. fire the mutation with context: { localFirst: true } and input.id = id
   ├─ success            → server response reconciles (idempotent: same id); catalog-merge adopts serverId
   ├─ network error      → queueLink queued it; KEEP the cache write (no revert, no alert)
   └─ real / non-success → revert the cache write + surface the error. Revert is stat-aware:
                           `revertOptimisticShoppingListItem` evicts the entity AND reverses the
                           `totalItems` / `remainingItems` / `completionRate` bump (a bare evict would
                           leave the list header inflated until the next stats refetch).
```

Every add site — **including the primary `useAddShoppingItem` / `usePantryItemMutations.addItem`** —
classifies the resolved result and reverts on a non-success payload. This matters because under the
global `errorPolicy: 'all'` a `ValidationError` / `ConflictError` **resolves** (it's a valid union member,
not a thrown error), so `onError` never fires; only inspecting `result` catches it. Skipping this is what
would leave a permanent phantom row. Shopping sites do this through `reconcileShoppingCreate` (§4); pantry
sites call `classifyCreateResult` directly and evict.

**There is no unified `useLocalFirstMutation` primitive.** The original plan proposed one; in practice
each hook applies this lifecycle directly, sharing only the helpers where the logic is genuinely
identical: the cache-write helpers (§3, §5) and `classifyCreateResult(result, payloadKey,
successTypename) → 'created' | 'queued' | 'rejected'` (`apollo/utils/classifyCreateResult.ts`), which
centralizes the "queued create is success / non-success payload is a rejection" decision so it can't
drift between sites. What stays per-site — input construction and success UX (navigate / close / toast /
restock) — is irreducibly site-specific, so a single primitive would be the wrong abstraction over it.

## 3. Identity — client-generated permanent ids

Rather than temp-ids + server reconciliation, **the client mints the real id at create time** and sends
it as the create input's `id`. `generateEntityId()` (`src/utils/generateEntityId.ts`, backed by
`@bugsnag/cuid`) returns a classic **CUID v1** matching `/^c[a-z0-9]{24}$/` (Prisma's
`@default(cuid())` fallback format). **Not** cuid2 — `@paralleldrive/cuid2` emits a different format that
fails the server's id shape.

Consequences (this dissolves the entire temp-id problem class):
- **Idempotency via the primary key.** A re-sent create (lost-after-commit) carries the same id; the
  server resolves it find-by-id → update → no duplicate. No temp→real remap, no `idMapping`, no ghost
  rows, no edge re-keying.
- **Cross-entity offline refs** resolve immediately because the real id exists from creation.

The same cuid rides the create input as `input.id` and, on queue replay, becomes the sync `clientId`.

## 4. Optimistic-offline appearance

So a newly-added item is visible immediately and survives a fully-offline create, every add site writes
the item into the cache before firing. Two shared writers keep this DRY:

- **`createOptimisticShoppingListItem(id, fields)` + `addOptimisticShoppingListItem(cache, listId, item)`**
  (both `apollo/utils/shoppingListCacheUpdaters.ts`) — the builder mints the **full** display entity with
  the client cuid baked in (mandatory offline, where no server response arrives to materialise it; without
  it the row renders blank); the writer `writeFragment`s it, adds the connection edge, and recomputes list
  stats. The builder lives in the shared apollo util (not the shoppingList feature) so add surfaces in
  other features (barcode, pantry-detail, filtered-pantry) build the same entity without crossing a
  feature boundary.
- **`buildOptimisticPantryItem(id, fields)`** (`src/hooks/home/pantry/buildOptimisticPantryItem.ts`) —
  builds the complete `PantryItem` shape that `addToPantryItemsCache` writes (an incomplete shape makes a
  list cell's `useFragment` report `complete: false` and blank the row).

Three shared reconcilers keep the response path DRY across all shopping add sites:
- **`reconcileShoppingCreate(cache, listId, id, result) → 'kept' | 'reverted'`** — the keep/revert
  decision every shopping add site applies to its resolved create. Classifies the result and, on a
  rejection, reverts (entity + stats); returns the outcome so the caller drives its own success / error UX.
  Centralizes the payload key (`addItemToShoppingList`), success typename, and the stat-aware revert in one
  place so they can't drift across sites.
- **`adoptServerShoppingListItemId(cache, serverId, clientId)`** — catalog-merge: evicts the optimistic
  cuid when the server returned a different (merged) id. Reads `clientId` off the mutation's own
  `variables.input.id` (never a shared ref), so it stays correct when adds overlap.
- **`revertOptimisticShoppingListItem(cache, listId, clientId)`** — the stat-aware revert primitive that
  `reconcileShoppingCreate` calls; also used directly on the thrown-error (`.catch` / `onError`) path,
  where there's no result to classify (§2).

The primary hooks (`useAddShoppingItem`, `usePantryItemMutations`) and the secondary add sites all route
through these.

**Success is decoupled from `result.data`.** A queued create resolves with `data: null` and no error —
that counts as success (the cache write stays; the queue replays). A **real error** or a **non-success
payload** (e.g. `ConflictError` / `ValidationError`) is a rejection: revert the optimistic item
(`revertOptimisticShoppingListItem` for shopping — entity + stats; evict for pantry).

## 5. Offline queue

- **`queueLink`** (in the link chain, after `errorLink`/`authLink`, before transport) queues a mutation
  when: (a) `isOnline === false` — any mutation; or (b) online but the request fails with a network error
  **and** the mutation opted in via `context: { localFirst: true }`. On success it calls
  `queueManager.requestDrain()` (covers API-recovery where `isOnline` never flipped). GraphQL/validation
  errors pass through to the hook. `NEVER_QUEUE_OPERATIONS` (auth) are excluded.
- **`queueStore`** persists the queue — including each mutation `DocumentNode` and variables — to MMKV,
  user-scoped. Survives restart.
- **`queueManager`** replays with batching, exponential backoff + jitter, token-refresh-before-replay,
  per-entity sequential ordering, and move-coalescing. Triggers: `useOnlineQueueSync` (offline→online),
  `useAppStateLifecycle` (background→active), `onUserChange`, and the drain-on-recovery above. A
  network/server error that exhausts in-run retries stays **PENDING** (never silently FAILED); only a real
  (validation) error → FAILED.

### Two-tier replay (`convertToSyncMutation`)

The `clientId` for replay is the client-minted cuid, read off the queued input (`input.id`, or `itemId`
for qty/move). Replay is single-arg with `clientId` **inside** `input` (the 1-arg sync API).

| Tier | Ops | Replay |
|---|---|---|
| **Sync-mapped (fast path)** | `CreatePantryItem`, `UpdatePantryItem`, `DeletePantryItem`, `AddItemToShoppingList`, `UpdateShoppingListItem`, `UpdateShoppingListItemQuantity`, `ToggleShoppingListItemPurchased`, `RemoveItemFromShoppingList`, `MoveShoppingListItem`, `ReorderShoppingListItems` — **plus the specialized single-item creates** `BarcodeCreatePantryItem` (→ `SyncPantryItem`) and `BarcodeAddItemToShoppingList` / `AddItemToShoppingListFromFilteredPantry` / `AddItemToShoppingListFromPantryItem` (→ `SyncShoppingListItem`) | dedicated `Sync*` mutation, idempotent by `clientId` |
| **Fallback (replay original)** | `AddItemToShoppingListFromRecipe`, `CreateShoppingListItemFromRecipeIngredient`, `AddItemsToShoppingList` (batch) | re-sends the **original** mutation; relies on the server's direct-create idempotency (find-by-id → update, by the client-supplied `id` / per-item `id`) |

Both tiers are duplicate-safe because the row's PK is the client cuid. The specialized single-item
creates produce the same entity (`PantryItem` / `ShoppingListItem`) from the same input fields as their
canonical counterparts, so they map onto the same `Sync*` mutation — the shopping item-builder carries
`brand` / `netWeight` / `storePrefs` / `pricing` through so the barcode add loses nothing on replay. The
remaining fallback ops genuinely have no clean `Sync*` shape: the recipe-ingredient input is a
*resolution request* (a `recipeIngredientId`, not a materialized item), and the batch is N items; their
server create path is itself id-idempotent, so re-sending the original is safe.

Shopping quantity rides the `FlexibleQuantity` scalar (`string | number`, e.g. `"1/3"` or `2`) — passed
through directly, no `unitId` wrapper. Pantry quantity is a plain `Float`. `convertToSyncMutation`
normalizes the **unit** into the `unit: UnitSpecInput` object the `Sync*` inputs expect — folding a flat
`unitId`/`unitName` (sent by `UpdateShoppingListItem(Quantity)`) into it so an offline unit change isn't
dropped on replay, and folding `UpdatePantryItem`'s flat `itemName` into `item: { name }` while backfilling
the required `pantryId` from cache.

## 6. Persistence — two mechanisms

1. **Raw cache persistence** (`ApolloCachePersistence` + the `client.ts` write wrapper). The permanent
   cache writes from §2 are re-persisted to MMKV (debounced ~3s, and flushed immediately on app
   **background** via `flushCachePersistence()` so a write inside the debounce window isn't lost to a fast
   kill — §1). This is what paints the optimistic add/remove from disk on cold start.
   **The durable backstop is the queue, not the cache:** even if a cache write were lost to a kill before
   the flush, `queueStore` persisted the *mutation* synchronously on enqueue, so the queue replays it on
   next launch and re-writes the cache. The cache flush optimizes cold-start UX (item visible
   immediately); the queue guarantees the change isn't lost.
2. **`OptimisticDataPersistence`** (`apollo/offline/OptimisticDataPersistence.ts`,
   `apollo-optimistic-data-v1`). Field-level tracking with a microtask flush (beats the cache debounce on
   a fast app-kill), restored on launch by `useOptimisticDataRestoration`. Used by the **numeric / toggle**
   mutations whose optimistic value must be exact across a kill: `useToggleShoppingItem`,
   `useAdjustPantryItemQuantity`, `useOpenPantryItemBatch`, `useWastePantryItemBatch`,
   `useItemReordering`, `useShoppingListActions`, `useMealPlanItemActions`, plus
   `useRecipePreload`/`SavedRecipes`.

## 7. Reconciliation & idempotency

- **By PK.** The cuid is `input.id` on create and `clientId` on replay; the server keys the row by it, so
  online success and queued replay converge on one row.
- **Shopping catalog-merge.** `addItemToShoppingList` is `@@unique([shoppingListId, itemId])` — if a
  client-created item resolves to a catalog item already on the list, the server keeps the **canonical
  row's PK** and increments quantity, so the returned `serverId` may differ from the client cuid. The
  shopping add hooks detect this in `update()` (returned id ≠ our cuid) and **adopt the serverId** (evict
  the stale cuid entity). PantryItems and custom (non-catalog) shopping items always keep the cuid.
- **Pantry duplicates.** A same-item create returns a duplicate error; the add sites evict the optimistic
  cuid item and offer restock / add-anyway (online), since the server keeps the existing row.

## 8. Connectivity — two failure modes, one signal

`NetInfo → networkSlice.isOnline` detects *device internet*, not "our API is reachable." The two
"can't reach the server" cases are unified behind one predicate
`isApiUnavailable(state) = !isOnline || apiReachable === false`:

- **Device offline (`isOnline === false`):** `NetInfo` drives `isOnline`. (`isOnline` errs toward
  "online" — only false when NetInfo is confident — so a transient unknown doesn't wrongly block.)
- **API down while online (timeout / captive portal / 5xx):** the **`apiReachabilityBreaker`** circuit
  breaker drives `apiReachable`. `networkStatusLink` (above `retryLink`, so one outcome per operation)
  feeds it: a real response → success; a network error or a queued-mutation result (`extensions.queued`)
  → failure. After **3 consecutive failures** it opens (`apiReachable = false`); after ~20s it half-opens
  (`apiReachable = true`) so normal traffic re-probes — one success closes it (and drains the queue), one
  failure re-opens. `useOnlineQueueSync` resets it on every connectivity transition.

Both cases behave identically because `isApiUnavailable` is read by everything:
- **`offlineModeLink`** (first in chain) short-circuits queries → serves the cache Apollo already read; no
  spinner, no error, and blocked queries never reach `retryLink`/`errorLink` (no doomed requests, no retry
  storm).
- **`queueLink`** queues `localFirst` mutations immediately instead of firing doomed requests (non-`localFirst`
  mutations still fire and surface their error — they aren't safe to auto-replay).
- **`queueManager.processQueue`** skips replay (a replay to a down API would just fail and re-trip the breaker);
  recovery (`requestDrain` on breaker close) re-drains.

The user-toggled **offline mode** (`offlineModeEnabled`) is a third input to `offlineModeLink`'s
query-blocking, orthogonal to connectivity.

## 9. Failure handling & UX

- **Offline banner.** `OfflineBanner` (`components/atoms/OfflineBanner.tsx`) is mounted in `App.tsx`
  (inside the SafeAreaView, above `<Navigation />`). It shows "You're offline — changes will sync when
  reconnected" when the device is offline (or "offline mode" when toggled on). It keys on `isOnline`
  (device internet), so it does **not** cover the API-down-while-online case, and shows no
  pending-change count — those are the natural next iteration.
- **Permanent failure.** `setFailureHandler` is registered exactly once, at module scope in `App.tsx`
  (`handleFailedMutation`): it evicts the stale optimistic entity, clears persisted optimistic fields,
  toasts the user, and **removes the entry from the queue**. `useOnlineQueueSync` intentionally does
  **not** register a handler (a comment there documents why — it mounts after `App.tsx`, so registering
  one would shadow the full handler). So a permanently-failed (validation/4xx) mutation is fully
  reverted and dequeued.
- **Network errors** no longer raise a blocking alert for opted-in mutations — they queue silently.
- **Not yet shipped:** an API-reachability-aware indicator and a pending-changes count; a uniform
  offline-degraded affordance for online-only features.

## 10. Scope

**Local-first today (opted in via `context.localFirst`, with a permanent cache write):**
- **Pantry:** create (every add surface — `usePantryItemMutations.addItem`, `useCreatePantryItem`,
  `usePantryItemSubmission`, `AddToPantrySheet`, `SelectPantryItems` onboarding, barcode), delete.
- **Shopping:** add (every add surface — `useAddShoppingItem`, `AddToShoppingListSheet`, `AddEditItem`,
  barcode, filtered-pantry, pantry-item-detail, recipe single + batch), remove, toggle-purchased, update,
  quantity ±, reorder/move.

**In scope but not yet opted in:**
- Pantry **update** (`useUpdatePantryItem` / `useUpdatePantryItemQuantity`) — Sync-mapped server-side, just
  needs the hook to write permanently + send `localFirst`.
- Shopping **clear** (`useClearShoppingListItems`).
- Pantry **granular ops** (adjust-qty, open/waste batch, consume/waste/restock) — these are deltas, not
  absolute values, and have **no `Sync*` mapping**; the fallback would replay the original delta, which is
  not idempotent. Need server-side Sync mappings or absolute-value reframing first. **Do not opt in yet.**

**Online-only (degrade, not queued):** auth, invites/share-codes/collaboration/membership, image upload,
barcode/smart-search lookup, recipe discovery/AI, recipe reviews, `markRecipeAsCooked` + pantry
deduction, server-aggregation (generate-list-from-meal-plan, add-low-stock), and the recipe **fan-out**
mutations `addRecipeToShoppingList` / `createShoppingListItemsFromRecipe` (they expand into N
server-derived items with no per-item id slot — the offline path is the client expanding the recipe
locally and using the now-id-capable batch `addItemsToShoppingList`).

**Out of current scope (own server work pending):** meal plan, storage locations, recipes-own, home-own
fields, profile, notifications. The server already accepts `id` on `createHome`, `createStorageLocation`,
`createMealPlan(Item)`, `createMealTemplate`, `createRecipe` (top-level) — so these can be migrated when
their hooks adopt the pattern and the queue gets Sync mappings (or uses the fallback tier).

## 11. Server contract (verified)

- **Client-supplied `id`** is accepted on every named client-create input: `CreatePantryItemInput`,
  `CreateShoppingListItemInput`, `BatchAddShoppingListItemInput`,
  `CreateShoppingListItemFromRecipeIngredientInput`, plus `createHome` / `createStorageLocation` /
  `createMealPlan(Item)` / `createMealTemplate` / `createRecipe` (top-level). Format: CUID v1
  `/^c[a-z0-9]{24}$/`; omitted → Prisma `@default(cuid())`.
- **NOT id-capable by design:** `createNotification` (system/cross-user generated) and the recipe fan-out
  mutations above.
- **Idempotency = find-by-id → update**, in place for both the `Sync*` mutations and the direct-create
  paths used by the fallback tier. So both replay tiers are duplicate-safe.
- **Sync result shape:** `{ clientId, serverId, operation, item, wasCreated, conflict }`. Version
  conflicts come back in `conflict` (server-wins).

## 12. Edge cases handled

- **Lost-response duplicate** — prevented by the PK (same id → find-by-id → update).
- **Ghost temp rows / temp→real remap** — eliminated (no temp ids exist).
- **Add-then-edit/delete offline** — the real id exists immediately; later ops reference it; the queue
  sequences per-entity by that id.
- **Catalog-merge id divergence** (shopping) — `adoptServerShoppingListItemId` adopts the returned
  `serverId` and evicts the cuid, reading the cuid off the mutation's own variables (§4, §7).
- **`totalCount` / stats drift** — the optimistic write adjusts list counts (`addOptimisticShoppingListItem`
  bumps `totalItems` + recomputes `remainingItems` / `completionRate`); a **rejection reverses them**
  symmetrically via `revertOptimisticShoppingListItem` (a bare evict would leave the header inflated until
  the next stats refetch).
- **Rejected-create phantom** — a non-success payload resolves under `errorPolicy: 'all'` without throwing;
  every add site (incl. the primary hooks) classifies the result and reverts, so a server-refused create
  never lingers (§2, §4).
- **First-page refetch dropping an un-replayed offline create** — the `itemsConnection.merge` preserves
  existing edges whose id is still PENDING in the queue (§1); drains to the authoritative page once
  replayed.
- **Stale persisted optimistic value on restart** — version guards + `clearPersistence` for the
  `OptimisticDataPersistence` consumers.
- **App-kill within the cache persist debounce** — covered two ways: the background flush
  (`flushCachePersistence`, §1/§6) writes the raw cache snapshot before a kill, and `OptimisticDataPersistence`'s
  microtask flush covers the numeric/toggle ops; in the worst case the **queue replays** the change on next
  launch regardless.

## 13. Divergences from the original plan (for the record)

- **No `useLocalFirstMutation` primitive** (planned §3.1). Replaced by per-site Pattern B + the shared
  cache-writers (§2, §4) and the `classifyCreateResult` helper.
- **Identity is client-generated cuid** (planned §8), not temp-id + reconciliation. This removed the
  largest planned subsystem — `idMapping` + `resolveIds` survive only to migrate any pre-cuid `temp-`
  values left in a persisted queue, and are otherwise inert.
- **Offline-UX partially shipped** (planned Phase 4): the device-offline `OfflineBanner` is mounted (§9);
  the API-reachability-aware indicator and pending-changes count are not.
- **Granular pantry deltas deliberately deferred** — no idempotent Sync mapping yet.

## 14. Key files

| Area | File |
|---|---|
| Client id generator | `src/utils/generateEntityId.ts` |
| Queue intercept | `src/apollo/offlineQueue/queueLink.ts` |
| Queue store (MMKV) | `src/apollo/offlineQueue/queueStore.ts` |
| Replay + `convertToSyncMutation` | `src/apollo/offlineQueue/queueManager.ts` |
| Queue triggers / failure toast | `src/hooks/app/useOnlineQueueSync.ts` |
| Field-level persistence | `src/apollo/offline/OptimisticDataPersistence.ts`, `src/hooks/offline/useOptimisticDataRestoration.ts` |
| Cache persistence (debounce + `flushPending`) | `src/apollo/offline/ApolloCachePersistence.ts`, `src/apollo/client.ts` (`flushCachePersistence`) |
| Background flush trigger | `src/hooks/app/useAppStateLifecycle.ts` |
| Pending-aware connection merge | `src/apollo/cache.ts` (`itemsConnectionFieldPolicy`) + `queueStore.getPendingClientIds()` |
| Shared shopping writers/reconcilers | `src/apollo/utils/shoppingListCacheUpdaters.ts` (`createOptimisticShoppingListItem`, `addOptimisticShoppingListItem`, `reconcileShoppingCreate`, `adoptServerShoppingListItemId`, `revertOptimisticShoppingListItem`) |
| Shared pantry builder | `src/hooks/home/pantry/buildOptimisticPantryItem.ts` |
| Create-result classifier | `src/apollo/utils/classifyCreateResult.ts` |
| Offline banner (mounted in `App.tsx`) | `src/components/atoms/OfflineBanner.tsx` |
| Query short-circuit when offline | `src/apollo/links/offlineModeLink.ts` |
| API-reachability circuit breaker | `src/apollo/links/apiReachabilityBreaker.ts`, `networkStatusLink.ts` |
| Unified `isApiUnavailable` predicate | `src/store/slices/networkSlice.ts` |
| Primary add hooks | `src/features/shoppingList/hooks/mutations/useAddShoppingItem.ts`, `src/hooks/home/pantry/usePantryItemMutations.ts` |
