# Local-First Architecture

**Status:** Implemented (item creates/removes across pantry & shopping). Last validated 2026-06-10
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
1. id = generateEntityId()                      // creates only — a permanent cuid2 (the row's PK)
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
`@paralleldrive/cuid2`) returns a **cuid2** matching the backend's current `@default(cuid(2))` format.
The server's id validator (`sous-chef-api/src/utils/common/validateId.ts`,
`/^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/`) accepts both cuid2 **and** the older cuid v1
(`c` + 24 chars), so ids minted by a previous app version stay valid; only new ids use cuid2.

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
  when: (a) `isOnline === false` **and** the mutation is on the replay allowlist — `context:
  { localFirst: true }` opt-ins or `Sync*`-mapped operations (`hasSyncMapping`); or (b) online but the
  request fails with a network error **and** the mutation opted in via `context: { localFirst: true }`.
  Offline mutations NOT on the allowlist fail fast with a network-shaped error — an honest immediate
  failure instead of the old "failure toast + ghost replay on reconnect" behavior. On success it calls
  `queueManager.requestDrain()` (covers API-recovery where `isOnline` never flipped). GraphQL/validation
  errors pass through to the hook. `NEVER_QUEUE_OPERATIONS` (auth) forward straight to transport.
- **`queueStore`** persists the queue — including each mutation `DocumentNode` and variables — to MMKV,
  user-scoped. Survives restart. The persisted `context` is an **allowlisted subset** (`localFirst`,
  `operationId`) — the live Apollo operation context carries client internals that don't survive JSON
  serialization (functions silently drop; a circular value would make the MMKV write throw and lose the
  enqueue). The store also exposes `subscribe()` + `getPendingCount()` (`useSyncExternalStore`-compatible)
  so UI — the offline banner's pending-changes count — reads live queue state without polling.
- **`queueManager`** replays with batching, exponential backoff + jitter, token-refresh-before-replay,
  per-entity sequential ordering, and move-coalescing. Triggers: `useOnlineQueueSync` (offline→online),
  `useAppStateLifecycle` (background→active), `onUserChange`, and the drain-on-recovery above. A
  network/server error that exhausts in-run retries stays **PENDING** (never silently FAILED); only a real
  (validation) error → FAILED.
- **Replayed results are payload-classified** (`classifyReplayResult`, `queueErrorPolicy.ts`) — the
  replay-side counterpart of the foreground `classifyCreateResult` rule. Under `errorPolicy: 'all'` a
  server refusal RESOLVES as an error union member (`ValidationError` / `ConflictError` / …) rather than
  throwing; without classification a rejected replay would be marked SUCCESS and dequeued while the
  optimistic cache write lingers. A rejected payload routes through the permanent-failure pipeline
  (revert + toast + dequeue, via `ReplayRejectedError` → the registered failure handler). A
  `ConflictError` on a replayed **create** is **converged** — every queued create carries its
  client-minted id, so a duplicate-id conflict proves an earlier attempt already committed; dequeue as
  success.
- **Queue-health telemetry** at each drain: `offline_queue_depth` + `offline_queue_oldest_age_ms`
  gauges, `offline_queue_conflicts_total` (server-wins version conflicts) and
  `offline_queue_permanent_failures_total` counters.

### Two-tier replay (`convertToSyncMutation`)

The `clientId` for replay is the client-minted cuid, read off the queued input (`input.id`, or `itemId`
for qty/move). Replay is single-arg with `clientId` **inside** `input` (the 1-arg sync API).

| Tier | Ops | Replay |
|---|---|---|
| **Sync-mapped (fast path)** | `CreatePantryItem`, `UpdatePantryItem`, `DeletePantryItem`, `AddItemToShoppingList`, `UpdateShoppingListItem`, `UpdateShoppingListItemQuantity`, `ToggleShoppingListItemPurchased`, `RemoveItemFromShoppingList`, `MoveShoppingListItem` — **plus the specialized single-item creates** `BarcodeCreatePantryItem` (→ `SyncPantryItem`) and `BarcodeAddItemToShoppingList` / `AddItemToShoppingListFromFilteredPantry` / `AddItemToShoppingListFromPantryItem` (→ `SyncShoppingListItem`) | dedicated `Sync*` mutation, idempotent by `clientId` |
| **Sync-mapped pantry deltas** | `AdjustPantryItemQuantity`, `RestockPantryItem`, `CreatePantryItemUsage` (consume), `OpenPantryItemBatch`, `WastePantryItemBatch` | dedicated `Sync*` delta mutation, idempotent by per-operation `operationId` (from `context.operationId`, persisted with the queue entry) — NOT by entity id, since deltas are relative |
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
  (inside the SafeAreaView, above `<Navigation />`). It covers **both** unreachable cases — device
  offline AND API-down-while-online (`apiReachable === false`, the reachability breaker) — plus the
  user-toggled offline mode, with distinct i18n'd messages (`offlineBanner.*` keys, pluralized). When
  the queue has PENDING entries it shows the **pending-changes count** ("You're offline — 3 changes
  will sync when reconnected"), read live via `usePendingMutationCount()`
  (`useSyncExternalStore` over `queueStore.subscribe`).
- **Permanent failure.** `setFailureHandler` is registered exactly once, at module scope in `App.tsx`
  (`handleFailedMutation`): it evicts the stale optimistic entity, clears persisted optimistic fields,
  toasts the user, and **removes the entry from the queue**. `useOnlineQueueSync` intentionally does
  **not** register a handler (a comment there documents why — it mounts after `App.tsx`, so registering
  one would shadow the full handler). So a permanently-failed (validation/4xx) mutation is fully
  reverted and dequeued.
- **Network errors** no longer raise a blocking alert for opted-in mutations — they queue silently.
- **Not yet shipped:** a uniform offline-degraded affordance for online-only features.

## 10. Scope

**Local-first today (opted in via `context.localFirst`, with a permanent cache write):**
- **Pantry:** create (every add surface — `usePantryItemMutations.addItem`, `useCreatePantryItem`,
  `usePantryItemSubmission`, `AddToPantrySheet`, `SelectPantryItems` onboarding, barcode), delete.
- **Shopping:** add (every add surface — `useAddShoppingItem`, `AddToShoppingListSheet`, `AddEditItem`,
  barcode, filtered-pantry, pantry-item-detail, recipe single + batch), remove, toggle-purchased, update,
  quantity ±, reorder/move.
- **Shopping list create** (`useCreateShoppingList`) — the list itself. Plain-create tier: the queue
  replays the original `CreateShoppingList` keyed by the client-minted `input.id`; a duplicate replay
  surfaces as a ConflictError, which the queue drops (non-retryable) — the first attempt's row stands.
  The optimistic write also seeds both empty `itemsConnection` variants and the `Query.shoppingList`
  cache redirect serves by-id reads, so a list created offline is immediately usable (items can be
  added to it offline; the FIFO queue replays the list create before its items). Known limits:
  `isDefault: true` doesn't clear the flag on other cached lists until the post-replay refetch, and the
  list-settings screen for a fresh offline list still needs the network for collaborator/share fields.

- **Pantry update** (`useUpdatePantryItem` / `useUpdatePantryItemQuantity`) — permanent write + revert
  snapshot; replays through the idempotent `SyncPantryItem` upsert (`UpdatePantryItemQuantity` has its
  own registry builder mapping `pantryItemId`/string-quantity/flat-`unitId` onto `SyncPantryItemInput`).
- **Pantry create** (`PantrySettings` + `src/features/pantry/utils/optimisticPantry.ts`) — the pantry
  container itself. Client-minted id; the optimistic write materializes the entity, zeroed `stats`,
  empty `itemsConnection` (no-args variant — matches the screen's undefined filters/orderBy) and
  `storageLocationsConnection(first: PAGE_SIZE.COMPACT)` variants, plus the home's `pantries` /
  `pantriesConnection` membership, and the `Query.pantry` cache redirect serves by-id reads — so a
  pantry created offline is immediately usable and items added to it queue behind its create
  (`CreatePantry` is in `PARENT_CREATE_OPERATIONS`).
- **Shopping list update / delete / clear** (`useUpdateShoppingList`, `useDeleteShoppingList`,
  `useClearShoppingListItems`) — update merges over a snapshot; delete removes edge + entity up front
  and restores the snapshot on rejection; clear keeps its eager cache eviction and refetches on a
  rejection.
- **Meal plans** (`useMealPlanActions`, `useMealPlanItemActions`) — plan create (client-minted id,
  `MealPlanDisplay` materialized from cache, FIFO parent-create guard) + update/delete; item create
  (client-minted id; a replay collision on the (mealPlanId, date, mealType, recipeId) unique key
  returns the existing row), update, toggle-completed (keeps `optimisticDataPersistence` until the
  replay confirms), delete.
- **Recipes** — create (`RecipeForm`; client-minted id, list-visible offline via the MyRecipes edge
  upsert; the detail view needs the post-replay sync), delete (`MyRecipes`; eager removal, refetch on
  rejection), update + ingredients (`RecipeForm` edit; queue-only — both ops queue atomically and
  replay FIFO against the same recipe id, but the local display catches up only when the replay syncs).

- **Storage location create** (`useCreateStorageLocation`) — permanent write before firing +
  `context.localFirst`; plain-create tier keyed by the client-minted id.
- **Pantry granular deltas** (`AdjustPantryItemQuantity`, `RestockPantryItem`, `CreatePantryItemUsage`,
  `OpenPantryItemBatch`, `WastePantryItemBatch`) — now **sync-mapped** via dedicated `Sync*` delta
  mutations, idempotent by a per-operation `operationId` carried in `context.operationId` (deltas are
  relative, so entity-id idempotency can't dedupe them; the operation id can). The `operationId` is on
  the persisted-context allowlist, so it survives an app kill between enqueue and replay.

**Online-only (degrade, not queued):** auth, invites/share-codes/collaboration/membership, image upload,
barcode/smart-search lookup, recipe discovery/AI, recipe reviews, recipe favorite/saved-metadata/folders,
`markRecipeAsCooked` + pantry deduction, server-aggregation (generate-list-from-meal-plan, add-low-stock,
meal templates), and the recipe **fan-out** mutations `addRecipeToShoppingList` /
`createShoppingListItemsFromRecipe` (they expand into N server-derived items with no per-item id slot —
the offline path is the client expanding the recipe locally and using the now-id-capable batch
`addItemsToShoppingList`).
**Home create/update/delete are deliberately online-only** even though `createHome` accepts a client id:
a usable home requires the server-created membership row (permission checks read `myMembership`) and the
server-created default pantry — an offline-materialized home would be an unusable husk until sync.
This is **enforced in code**, not just convention: `queueLink` only queues allowlisted mutations
(`localFirst` opt-ins + `Sync*`-mapped ops) when the device is offline; everything else fails fast with
a network error so the hook's normal error path shows a truthful failure and nothing ghost-replays.

**Out of current scope (own server work pending):** profile, notifications. `PARENT_CREATE_OPERATIONS`
in `queueManager.ts` (`CreateShoppingList`, `CreateMealPlan`, `CreateRecipe`, `CreatePantry`) forces
strict FIFO replay for any batch containing a parent-entity create, so dependents queued behind it
(items in a new list, meals in a new plan, meals referencing a new recipe, items in a new pantry)
always replay after their parent exists.

## 11. Server contract (verified)

- **Client-supplied `id`** is accepted on every named client-create input: `CreatePantryItemInput`,
  `CreateShoppingListItemInput`, `BatchAddShoppingListItemInput`,
  `CreateShoppingListItemFromRecipeIngredientInput`, `CreateShoppingListInput`, plus `createHome` /
  `createStorageLocation` / `createMealPlan(Item)` / `createMealTemplate` / `createRecipe` (top-level).
  Format: cuid2 (validator `/^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/` also accepts legacy cuid v1
  and 24-char hex); omitted → Prisma `@default(cuid(2))`. Note `createShoppingList`
  (like `createHome` & co.) is the **plain-create tier** — a duplicate replay surfaces as a
  ConflictError rather than the find-by-id → update upsert of the `Sync*` mutations; the queue treats
  that conflict as already-synced and drops the op.
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
- **Identity is client-generated cuid2** (planned §8), not temp-id + reconciliation. This removed the
  largest planned subsystem — the `idMapping` / `resolveIds` / temp-id machinery has been fully deleted
  (no references remain in the codebase).
- **Offline-UX shipped** (planned Phase 4): the `OfflineBanner` covers device-offline, API-down, and
  offline mode, with a live pending-changes count (§9).
- **Granular pantry deltas** were initially deferred (no idempotent Sync mapping); since shipped via
  `operationId`-keyed `Sync*` delta mutations (§5, §10).

## 14. Key files

| Area | File |
|---|---|
| Client id generator | `src/utils/generateEntityId.ts` |
| Queue intercept | `src/apollo/offlineQueue/queueLink.ts` |
| Queue store (MMKV) | `src/apollo/offlineQueue/queueStore.ts` |
| Replay + `convertToSyncMutation` | `src/apollo/offlineQueue/queueManager.ts` |
| Replay payload classification + retry error policy | `src/apollo/offlineQueue/queueErrorPolicy.ts` |
| Pending-changes count (banner) | `src/hooks/offline/usePendingMutationCount.ts` |
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
