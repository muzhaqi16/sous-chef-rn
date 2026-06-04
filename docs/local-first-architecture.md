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
  start paints from disk.
- Default fetch policy `cache-and-network` → instant cache read + background refresh.
- A transient API failure does not wipe cached lists: `usePreservedConnection` /
  `usePreservedQueryData` keep the last good value, and the `itemsConnection.merge` guard only honors an
  **authoritative** `totalCount: 0` (see the cache-connection-resilience note).

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
   └─ real / non-success → revert the cache write (evict) + surface the error
```

**There is no unified `useLocalFirstMutation` primitive.** The original plan proposed one; in practice
each hook applies this lifecycle directly, sharing only the cache-write helpers (§3, §5). This kept the
migration incremental and avoided a heavy abstraction over hooks whose optimistic shapes differ widely
(rich pantry forms vs. one-line quick-adds vs. batch recipe adds).

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

- **`addOptimisticShoppingListItem(cache, listId, item)`** (`apollo/utils/shoppingListCacheUpdaters.ts`)
  — `writeFragment`s the **full** display entity (mandatory offline, where no server response arrives to
  materialise it; without it the row renders blank), adds the connection edge, and recomputes list stats.
- **`buildOptimisticPantryItem(id, fields)`** (`src/hooks/home/pantry/buildOptimisticPantryItem.ts`) —
  builds the complete `PantryItem` shape that `addToPantryItemsCache` writes (an incomplete shape makes a
  list cell's `useFragment` report `complete: false` and blank the row).

The primary hooks (`useAddShoppingItem`, `usePantryItemMutations`) and the secondary add sites all route
through these.

**Success is decoupled from `result.data`.** A queued create resolves with `data: null` and no error —
that counts as success (the cache write stays; the queue replays). A **real error** or a **non-success
payload** (e.g. `ConflictError` / `ValidationError`) is a rejection: revert (evict) the optimistic item.

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
| **Sync-mapped (fast path)** | `CreatePantryItem`, `UpdatePantryItem`, `DeletePantryItem`, `AddItemToShoppingList`, `UpdateShoppingListItem`, `UpdateShoppingListItemQuantity`, `ToggleShoppingListItemPurchased`, `RemoveItemFromShoppingList`, `MoveShoppingListItem`, `ReorderShoppingListItems` | dedicated `Sync*` mutation (`SyncPantryItem`, `SyncShoppingListItem`, `SyncDelete*`, `SyncMove*`), idempotent by `clientId` |
| **Fallback (replay original)** | the specialized creates — `BarcodeCreatePantryItem`, `BarcodeAddItemToShoppingList`, `AddItemToShoppingListFromRecipe`, `CreateShoppingListItemFromRecipeIngredient`, `AddItemsToShoppingList` (batch), `AddItemToShoppingListFromFilteredPantry`, `AddItemToShoppingListFromPantryItem` | re-sends the **original** mutation; relies on the server's direct-create idempotency (find-by-id → update, by the client-supplied `id` / per-item `id`) |

Both tiers are duplicate-safe because the row's PK is the client cuid. The fallback tier exists because
the specialized inputs don't have a dedicated `Sync*` shape — their server-side create path is itself
idempotent by id, so re-sending the original is safe.

Shopping quantity rides the `FlexibleQuantity` scalar (`string | number`, e.g. `"1/3"` or `2`) — passed
through directly, no `unitId` wrapper. Pantry quantity is a plain `Float`.

## 6. Persistence — two mechanisms

1. **Raw cache persistence** (`ApolloCachePersistence` + the `client.ts` write wrapper). The permanent
   cache writes from §2 are re-persisted to MMKV (debounced). This is what the **add/remove** path relies
   on — the entity is in the normalized cache, so it survives app-kill and the queue can read it.
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

## 8. Connectivity

`NetInfo → networkSlice.isOnline` (`isConnected && isInternetReachable !== false`) detects *internet*,
not "our API is reachable." The API-down-while-online gap (timeout / captive portal / API down) is
covered by queueLink's `localFirst` network-error branch (§5) plus the drain-on-recovery.

## 9. Failure handling & UX

- **Permanent failure.** `queueManager.setFailureHandler` is wired in `useOnlineQueueSync` → a
  non-blocking toast on a real (non-network) permanent failure. (Automatic per-entity cache revert on
  permanent failure is a future enhancement; today the toast notifies and the entry is dropped.)
- **Network errors** no longer raise a blocking alert for opted-in mutations — they queue silently.
- **Not yet shipped:** a sync-status / pending-changes indicator. `OfflineBanner`
  (`components/atoms/OfflineBanner.tsx`) exists but is **not mounted** anywhere. Online-only features do
  not yet have a uniform offline-degraded affordance.

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
- **Catalog-merge id divergence** (shopping) — adopt the returned `serverId`, evict the cuid (§7).
- **`totalCount` / stats drift** — the permanent cache writes adjust list counts (`addOptimisticShoppingListItem`
  recomputes; the connection updater bumps `totalCount`).
- **Stale persisted optimistic value on restart** — version guards + `clearPersistence` for the
  `OptimisticDataPersistence` consumers.
- **App-kill within the cache persist debounce** — `OptimisticDataPersistence`'s microtask flush covers
  the numeric/toggle ops.

## 13. Divergences from the original plan (for the record)

- **No `useLocalFirstMutation` primitive** (planned §3.1). Replaced by per-site Pattern B + the two shared
  cache-writers (§2, §4).
- **Identity is client-generated cuid** (planned §8), not temp-id + reconciliation. This removed the
  largest planned subsystem (`idMapping`, temp→real re-keying).
- **Offline-UX (sync indicator, graceful-degrade) not shipped** (planned Phase 4). Only the
  permanent-failure toast exists; `OfflineBanner` is unmounted.
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
| Cache persistence | `src/apollo/ApolloCachePersistence.ts`, `src/apollo/client.ts` |
| Shared shopping writer | `src/apollo/utils/shoppingListCacheUpdaters.ts` (`addOptimisticShoppingListItem`) |
| Shared pantry builder | `src/hooks/home/pantry/buildOptimisticPantryItem.ts` |
| Primary add hooks | `src/features/shoppingList/hooks/mutations/useAddShoppingItem.ts`, `src/hooks/home/pantry/usePantryItemMutations.ts` |
