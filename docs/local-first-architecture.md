# Local-First Architecture

**Status:** Implemented (item creates/removes across pantry & shopping). Last validated 2026-09-29
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
  pending (see §6). `queueLink` calls the same `flushPending()` right after it queues a write, so the
  queue entry and the cache change it replays against reach disk in one synchronous step and a kill
  with no background transition (force-stop, crash) cannot leave a queued create with no row.
- Default fetch policy `cache-and-network` → instant cache read + background refresh; after the first
  fetch a watcher settles on `cache-first`. What the device may have missed while backgrounded, offline
  or with the socket down is re-requested by the resync (`src/apollo/refetchEvents.ts`, Apollo 4.2's
  `RefetchEventManager`): on app foreground, API reachable again and WebSocket reconnect, it waits for the
  queue to drain, then refetches the active queries that have not opted out with `refetchOn: false`
  (`docs/apollo-client-patterns.md` § Resync).
- A transient API failure does not wipe cached lists: `usePreservedConnection` /
  `usePreservedQueryData` keep the last good value for the subject it was loaded for (each takes the
  subject's key, so a pantry or list switch never shows the previous one's rows), and the `itemsConnection.merge` guard only honors an
  **authoritative** `totalCount: 0` (see the cache-connection-resilience note).
- A first-page background refetch that lands **before** the queue replays an offline create keeps that
  item. The `itemsConnection.merge` first-page branch preserves existing edges whose id still
  has a PENDING or PROCESSING mutation in the queue (`queueStore.getUnconfirmedCreateIds()`: a replay in
  flight still protects its edge), then falls straight through to
  the authoritative page once the queue drains. A genuinely **server-deleted** item (no pending op) is
  still dropped, so the page stays authoritative.

## 2. Write path — the implemented pattern

Local-first mutations **write the change to the cache permanently _before_ firing the mutation, and
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
3. fire the mutation with input.id = id; its useMutation options set context: { localFirst: true }
   (a per-call context OBJECT replaces the hook's, so extra keys use the callback form)
   ├─ success            → server response reconciles (idempotent: same id); catalog-merge adopts serverId
   ├─ network error      → queueLink queued it; KEEP the cache write (no revert, no alert)
   └─ real / non-success → revert the cache write + surface the error. Revert is stat-aware:
                           `revertOptimisticShoppingListItem` evicts the entity AND reverses the
                           `totalItems` / `remainingItems` / `completionRate` bump (a bare evict would
                           leave the list header inflated until the next stats refetch).
```

**Where the marker lives.** `localFirst` is set once, on the hook's `useMutation` options, not on each
call. Apollo 4.2 merges execute-time options over the hook's, and a per-call `context` object REPLACES
the hook's context rather than merging into it (`src/apollo/__tests__/hookMutationContext.test.ts`), so a
call that needs another context key passes the callback form, `context: hook => ({ ...hook, key })`.
`sous-chef/queueable-write-is-local-first` enforces all three: a queueable write carries the marker, a
per-call `localFirst` on a hook that already sets it is redundant, and a per-call context object on such
a hook drops it. A helper that fires whatever mutate function its caller passes
(`createShoppingListRow`) and `client.mutate` callers pass it per call.

Every add site — **including the primary `useAddShoppingItem`** —
classifies the resolved result and reverts on a non-success payload. This matters because under the
global `errorPolicy: 'all'` a `ValidationError` / `ConflictError` **resolves** (it's a valid union member,
not a thrown error), so `onError` never fires; only inspecting `result` catches it. Skipping this is what
would leave a permanent phantom row. Shopping sites do this through `reconcileShoppingCreate` (§4); pantry
sites settle the write with `settleMutation` and evict on a failure.

**There is no unified `useLocalFirstMutation` primitive.** The original plan proposed one; in practice
each hook applies this lifecycle directly, sharing only the helpers where the logic is genuinely
identical: the cache-write helpers (§3, §5) and `settleMutation` / `settledStatus(result) → 'applied' |
'queued' | 'failed'` (`apollo/utils/settleMutation.ts`), which centralizes the "queued write is not a
failure / refusal member is a failure" decision so it can't drift between sites. It takes the result and
nothing else — the payload field and the success member are derived structurally via
`utils/errors/mutationPayload.ts`, shared with `classifyReplayResult` (§ replay) so the foreground and
replay paths apply one rule. What stays per-site — input construction and success UX (navigate / close / toast /
restock) — is irreducibly site-specific, so a single primitive would be the wrong abstraction over it.

**One shape did earn a primitive: settings.** `updateEntityFieldsLocalFirst`
(`apollo/utils/localFirstFields.ts`) runs the whole lifecycle for a _settings-shaped_ mutation — a
normalized entity whose GraphQL field names are the flat setting names (`UserSettings`,
`NotificationPreferences`), updated a field or two at a time. It writes the fields with `cache.modify`,
fires local-first, and reverts from the caller's `previous` snapshot only when
`settledStatus` says `'failed'`. It qualifies where the create sites don't because there is no
per-site input construction (the change _is_ the fields) and no success UX (the control already moved).
It returns the outcome rather than reporting it — the two call sites surface a refusal differently, and
deciding that centrally is what produces double alerts. See §10 for what uses it.

## 3. Identity — client-generated permanent ids

Rather than temp-ids + server reconciliation, **the client mints the real id at create time** and sends
it as the create input's `id`. `generateEntityId()` (`src/utils/generateEntityId.ts`, backed by
`@paralleldrive/cuid2`) returns a **cuid2** matching the backend's current `@default(cuid(2))` format.
The server's id validator (`sous-chef-api/packages/core/src/utils/common/validateId.ts`,
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

- **`createLocalShoppingListItem(id, fields)` + `addLocalShoppingListItem(cache, listId, item)`**
  (both `features/shoppingList/cache/items.ts`) — the row a create adds, written through
  `writeLocalEntity` over the readers-based `items_row` fragment: what the create knows, else what the
  cache holds, else the SDL neutral. A related `unit` / `item` is named by reference only when the cache
  holds it, so a create never overwrites a held `Unit`'s name or an `Item`'s images. The writer also adds
  the connection edge and recomputes list stats. A feature's `cache/` is outside the closed internals
  (`context/`, `hooks/mutations/`, `utils/`, `components/`, `offline/`), so add surfaces in other features
  (barcode, pantry-detail, filtered-pantry) build the same entity from it.
- **`writeLocalPantryItem(cache, id, row)`** (`src/features/pantry/cache/writeLocalPantryItem.ts`) —
  writes the row complete for every query reading a pantry item (list and detail), through
  `writeLocalEntity`: what the create knows, else what the cache holds per field, else the SDL-derived
  neutral value. An incomplete row makes a list cell report `complete: false` and blank it.

**An optimistic entity is COMPLETE for every query that reads it.** With
`returnPartialData: false`, one missing field makes the whole cache read
incomplete and `useQuery` returns nothing; online a refetch hides it, offline
there is none, so the row stays invisible for the rest of the session. A field
added to a list query (or a fragment it spreads) must therefore reach EVERY
writer that links the entity into a read connection: the optimistic builder, the
create mutation's selection (which a queued create's replay lands too), a move/restock
payload, and the subscription read-back fragment a collaborator's change arrives
through. `__tests__/apollo/optimisticEntityCompleteness.test.ts` executes the
real schema and asserts `cache.diff` completeness for each, and DERIVES the
writer list from the tree: every module using `createAddTo*ConnectionUpdater`
must appear there with a case or a reason, so a new writer cannot ship
uncovered.

A nested entity reference (`unit`, `item`) is resolved with `cache.readFragment`
selecting **every** field the query needs — it returns null on a partially
cached entity exactly as on a missing one.

The shopping add path is shared rather than copied:

- **`createShoppingListRow(cache, { listId, row, line, send, document, fallback })`**
  (`features/shoppingList/cache/createShoppingListRow.ts`) — the whole lifecycle of one row: mint the id,
  write the row, send `AddItemToShoppingList` local-first, settle with `settleMutation`, withdraw the row
  on a refusal. Returns `{ outcome, failure, data }` and never presents the failure, so each surface keeps
  its own success and error UX. `useAddShoppingItem`, `useShoppingListItemWrites.createItem`,
  `useAddPantryItemToShoppingList` and `useAddToShoppingList` go through it.
- **`reconcileShoppingCreate(cache, listId, id, result) → 'kept' | 'reverted'`** — the keep/revert decision
  for the add sites that build their own request (barcode, pantry-detail, recipe).
- **`reconcileShoppingItemCreateUpdate`** — catalog merge: when the server folded the line into an existing
  row (a different id), the minted row is withdrawn. The replay path does the same
  (`reconcileShoppingAddReplay`, § 7).
- **`withdrawShoppingListItems(cache, listId, ids, { countsSettled })`**
  (`features/shoppingList/cache/withdraw.ts`) — the one withdrawal: touches only rows still held, evicts
  them in one `safeEvictMany`, uncounts once, so a re-run changes nothing. `revertOptimisticShoppingListItem`,
  the slice revert of a batch add, and the batch reconcile (which withdraws each line the service refused)
  all use it.

**Success is decoupled from `result.data`.** A queued create resolves with `data: null` and no error —
that counts as success (the cache write stays; the queue replays). A **real error** or a **non-success
payload** (e.g. `ConflictError` / `ValidationError`) is a rejection: revert the optimistic item
(`revertOptimisticShoppingListItem` for shopping — entity + stats; evict for pantry).

## 5. Offline queue

- **`queueLink`** (in the link chain, after `errorLink`/`authLink`, before transport) queues a mutation
  when: (a) `isOnline === false` **and** the mutation is on the replay allowlist — `context:
{ localFirst: true }` opt-ins or the operations registered for replay (`REPLAY_PREPARATIONS`,
  `hasReplayPreparation`); or (b) online but the
  request fails with a network error **and** the mutation opted in via `context: { localFirst: true }`.
  Offline mutations NOT on the allowlist fail fast with a network-shaped error — an honest immediate
  failure instead of the old "failure toast + ghost replay on reconnect" behavior. On success it calls
  `queueManager.requestDrain()` (covers API-recovery where `isOnline` never flipped). GraphQL/validation
  errors pass through to the hook. `NEVER_QUEUE_OPERATIONS` (auth) forward straight to transport.
- **`queueStore`** persists the queue — including each mutation `DocumentNode` and variables — to MMKV,
  user-scoped. Survives restart. Each distinct document is stored once and named by the entries that
  send it (blob v2), so a burst of one operation does not re-serialize its AST per entry per save; the
  reader still takes the v1 array an older build wrote. The persisted `context` is an **allowlisted subset** (`localFirst`
  only) — the live Apollo operation context carries client internals that don't survive JSON
  serialization (functions silently drop; a circular value would make the MMKV write throw and lose the
  enqueue). Cumulative-op idempotency rides on `input.idempotencyKey` inside the persisted variables, not
  on the context. The store also exposes `subscribe()` + `getPendingCount()` (`useSyncExternalStore`-compatible)
  so UI — the offline banner's pending-changes count — reads live queue state without polling.
- **`queueManager`** replays **in insertion order, holding back only dependents** — the queue is
  append-only from one user's actions, so insertion order IS causal order, and an entry the server
  did not accept holds back every later entry that names its subject or its parent
  (`PARENT_REFERENCE_KEYS`: the home a pantry joins, the pantry or list an item joins, …) while
  unrelated entries continue. A transport-class deferral (unreachable, 5xx, pacing,
  `CLIENT_UPGRADE_REQUIRED`) pauses the pass instead, since every later entry would meet it too;
  only a row-scoped one (DEADLOCK, an unbuildable replay, a batch row that failed transiently) lets
  the rest replay. An entry parked for re-authentication still holds its dependents, and a session
  token that revives parked entries during a pass triggers one more pass. Nothing counts passes: the
  sole lifetime bound on a pending entry is `expireStalePending`'s 90-day age horizon, and an entry
  that reaches it is withdrawn through the failure handler (the user is told) and then cleaned up.
  Two rewrites happen at **enqueue time** in `queueStore.addMutation`: the latest move per item wins,
  and a delete supersedes the pending or parked non-create writes whose only subject is the deleted
  row (a create minted on the device goes with it, and neither is sent). Writes to one entity queued
  from the same base `version` are replayed in turn: once one lands, the next is moved onto the
  version the server returned instead of conflicting with its sibling. A create the server merged into
  a row it already held (`outcome: MERGED`) moves every write still queued against the minted id to
  the surviving row, at its version; the server refuses the minted id from then on. Both moves are
  written to the queue itself, so a restart mid-drain keeps them. Retries use exponential
  backoff + jitter;
  an auth error forces ONE token refresh and then retries through the same bounded counter (a
  failed refresh → AUTH_ERROR + failure handler — never an unbounded auth-retry loop). Triggers:
  `useOnlineQueueSync` (offline→online), `useAppStateLifecycle` (background→active), `onUserChange`,
  and the drain-on-recovery above. A network/server error that exhausts in-run retries stays
  **PENDING** (never silently FAILED); only a real (validation) error → FAILED.
- **Failed-mutation entity identity is derived from the cache, not maintained.** The failure
  handler needs the entity's `__typename` to evict it; `extractEntityInfo` reads it off the
  normalized cache key (`TypeName:<clientId>`) at failure time — the hook already wrote the
  optimistic entity there before firing, and client ids are globally-unique cuids, so the cache is
  the source of truth. No per-operation map exists; an entity that isn't cached (already evicted,
  or no single entity) yields null and the handler skips the evict — the next refetch heals.
- **Replayed results are payload-classified** (`classifyReplayResult`, `queueErrorPolicy.ts`) — the
  replay-side counterpart of the foreground `settledStatus` rule. Under `errorPolicy: 'all'` a
  server refusal RESOLVES as an error union member (`ValidationError` / `ConflictError` / …) rather than
  throwing; without classification a rejected replay would be marked SUCCESS and dequeued while the
  optimistic cache write lingers. A rejected payload routes through the permanent-failure pipeline
  (revert + toast + dequeue, via `ReplayRejectedError` → the registered failure handler). A
  `ConflictError` whose `code` is `IDEMPOTENT_REPLAY` is **converged** — the API-wide signal that this
  exact op already committed once (a client-PK create keyed by the row id, or an idempotency-keyed
  cumulative delta keyed by `input.idempotencyKey`); dequeue as success. Matched on the **code**, never
  the message; a generic `ConflictError` is a real version/uniqueness conflict → rejected. A converged
  SUCCESS payload (`converged: true` on favorites, cooking logs, and the canonical deletes) never
  reaches the converged branch here — it doesn't end in `Error`, so it's already treated as applied.
  A batch that applies with a row refused as `INTERNAL_SERVER_ERROR` or `DEADLOCK` is deferred whole
  (`BatchRowDeferredError`): each row converges on its id, so the re-send is safe, while reverting that
  row would discard a write the server never refused.
- **A replay refused because its row is gone can settle silently.** An operation listed in
  `GONE_REPLAYS` (`replayRegistry.ts`: notification mark-read and delete) treats a replayed
  `NotFoundError` as settled: its reconciler removes the row locally and the entry dequeues with no
  failure toast, since the user's intent (read or gone) already holds.
- **Replay reconcilers read the UNMASKED result.** Data masking applies only to the value
  `client.mutate` returns, so `executeMutation` captures the payload in an `update` callback and hands
  that to `reconcileReplaySuccess`; a reconciler reading the returned value sees fragment spreads as
  `{ id }` only (list totals included).
- **A version conflict lets the server's row stand.** A stale `version` is refused as `ConflictError`
  coded `VERSION_CONFLICT` and applies nothing: someone else changed the row. The write is withdrawn
  and reported through the failure handler's conflict copy, and the resync after the drain re-reads
  the row. It is never re-sent without its version.
- **Queue-health telemetry** at each drain: `offline_queue_depth` + `offline_queue_oldest_age_ms`
  gauges, `offline_queue_conflicts_total` (server-wins version conflicts) and
  `offline_queue_permanent_failures_total` counters.

### Replay as queued (`prepareReplay`)

A queued write replays as the canonical mutation it was queued as — the API's contract (sous-chef-api
`docs/api/offline-sync.md` § Replaying through the canonical mutations) makes each one safe to send again:

| Queued write                                                            | Why a re-send is safe                                                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Create with a client-minted id (`CreatePantryItem`, the batch adds, …)  | the id is the row's PK: a re-sent `createPantryItem` answers `IDEMPOTENT_REPLAY`, a batch add converges and returns the row |
| Update (`UpdatePantryItem`, `UpdateShoppingListItem`, quantity, toggle) | version-checked: a stale version applies nothing (`VERSION_CONFLICT`, § 5)                                                  |
| Delete (`DeletePantryItem`, `RemoveItemFromShoppingList`)               | converges: `converged: true`, the entity `null`                                                                             |
| Reorder (`MoveShoppingListItem`)                                        | repeats to the same order; a line removed since is `NotFoundError`                                                          |
| Cumulative change (the pantry deltas)                                   | at-most-once by `input.idempotencyKey` (`IDEMPOTENT_REPLAY`)                                                                |

What a replay restates is only what the device knows better by then. `prepareReplay`
(`src/apollo/offlineQueue/prepareReplay.ts`) looks the operation up in `REPLAY_PREPARATIONS`
(`preparationRegistry.ts`), which also names the writes `queueLink` takes offline without the caller's
`localFirst` opt-in:

- **Units** (`withCurrentUnits`, `replayPreparation.ts`): a `UnitRefInput` naming its unit by id is sent
  by symbol where one is known — captured when queued (`replayInputs['unit:<id>']`), else read from the
  cache — since an id the vocabulary repair retired cannot be re-resolved and a symbol can. A flat
  `unitId` takes no symbol, so after a refusal names it retired the retry looks up the unit's current
  id by symbol (`unitBySymbol`).
- **A pantry create** (`preparePantryItemCreate`, `features/pantry/offline/`) replays with
  `forceAdd: true`, so a stack for the same item and unit another member added meanwhile absorbs it
  (`outcome: MERGED`) instead of refusing it (§ 7).
- **The day** (`$today`) is always the replay's: it only dates the totals the response reads back.

`offline/` is public to the queue and closed to other features (an `import/no-restricted-paths` zone).
Shopping quantity rides the `FlexibleQuantity` scalar (`string | number`, e.g. `"1/3"` or `2`); pantry
quantity is a plain `Float`.

## 6. Persistence — two mechanisms

1. **Raw cache persistence** (`ApolloCachePersistence` + the `client.ts` write wrapper). The permanent
   cache writes from §2 are re-persisted to MMKV (debounced ~3s, and flushed immediately on app
   **background** via `flushCachePersistence()` so a write inside the debounce window isn't lost to a fast
   kill — §1). This is what paints the optimistic add/remove from disk on cold start.
   **The durable backstop is the queue, not the cache:** even if a cache write were lost to a kill before
   the flush, `queueStore` persisted the _mutation_ synchronously on enqueue, so the queue replays it on
   next launch. The replay's response normalizes into the cache, and a replay reconciler
   (`REPLAY_RECONCILERS`, § 7) redoes the connection work the foreground `update` would have done. The cache flush optimizes cold-start UX (item visible
   immediately); the queue guarantees the change isn't lost.
2. **`OptimisticDataPersistence`** (`apollo/offline/OptimisticDataPersistence.ts`,
   `apollo-optimistic-data-v1`). Field-level tracking with a microtask flush (beats the cache debounce on
   a fast app-kill), restored on launch by `useOptimisticDataRestoration`. When a queued write lands, only
   the fields that write saved are cleared (`clearEntitySavedBetween`), so another write still queued on
   the same entity keeps its persisted value. Used by the **numeric / toggle**
   mutations whose optimistic value must be exact across a kill: `useToggleShoppingItem`,
   `useAdjustPantryItemQuantity`, `useOpenPantryItemBatch`, `useWastePantryItemBatch`,
   `useConvertExpiredToWaste`, `useCorrectPackageSize`, `useItemReordering`, `useQuantityEditModal`,
   `useShoppingListItemWrites` and `useMealPlanItemActions`.

## 7. Reconciliation & idempotency

- **By PK.** The cuid is `input.id` on create and on its replay; the server keys the row by it, so
  online success and queued replay converge on one row.
- **Shopping catalog-merge.** `addItemToShoppingList` is `@@unique([shoppingListId, itemId])` — if a
  client-created item resolves to a catalog item already on the list, the server keeps the **canonical
  row's PK** and increments quantity, so the returned `serverId` may differ from the client cuid. The
  shopping add hooks detect this in `update()` (returned id ≠ our cuid) and **adopt the serverId** (withdraw
  the minted row). A row added offline does the same on replay (`reconcileShoppingAddReplay`), so a
  merged line never leaves a ghost beside the canonical row, and the writes queued behind it move to
  the kept row (§ 5). Custom (non-catalog) shopping items always keep the cuid.
- **Meal-plan items converge on a natural key.** The server returns the existing row for a matching
  (mealPlanId, date, mealType, recipeId); `adoptServerMealPlanItem` withdraws the minted id, in the
  foreground `update` and on replay (`reconcileCreateMealPlanItemReplay`).
- **Replay parity is enforced.** Every queueable operation whose foreground `update` adopts or withdraws
  an entity has a `REPLAY_RECONCILERS` entry; `__tests__/apollo/replayReconcilerCoverage.test.ts`
  discovers them from the hooks and fails on a gap. The delete reconcilers (`settleShoppingItemDelete`,
  `settlePantryItemDelete`, `settlePantryDelete`, `settleMealPlanDelete`, `settleMealTemplateDelete`)
  also cover the other half: a removal filters the edge out of its connection before it evicts, so a
  response that writes the deleted `{ id }` back cannot make the row readable again.
- **Pantry duplicates — decided locally.** `createPantryItem` never merges: it REFUSES with
  `DuplicatePantryItemError` and writes nothing. The key is `(pantryId, itemId, deletedAt: null)` — location,
  unit, expiry and brand are not part of it, and `forceAdd` joins the held stack instead. A queued create
  replays with `forceAdd: true` (§ 5): a stack another device added meanwhile absorbs the quantity and
  comes back as `outcome: MERGED` under its own id, and the replay reconciler swaps the minted row for
  it.
  So the add sites ask the CACHE first, via `findCachedPantryItemDuplicate`
  (`features/pantry/utils/pantryCacheReaders.ts`): the list query already caches `item { id }` and `itemName` on every
  node, so the server's key is reproducible locally with no round trip. Quick-add matches on the catalog id
  and the unit the add would create, and restocks (bumping `quantity` through `writeEntityFields`,
  because offline the restock's `update` never runs); an add whose unit is unknown is left to the server.
  The details form has no catalog id, so it matches on the name (and on the unit when one is picked, since a
  blank unit resolves to the held stack's) and only ever PROMPTS on that match. A match means no create is fired at all — nothing to undo on reconnect.
  **The read must carry the connection's key args.** `itemsConnection` is keyed on `filters`/`orderBy`, and
  client mode sends neither — which stores it as **`itemsConnection:{}`**, not a bare `itemsConnection`. A
  fragment that omits the args resolves a store key that does not exist and matches nothing, with no error:
  that shipped once and was only caught on device, because the server refusal produces the same toast and
  hides it. A seed query in a test must therefore declare the same args, or it pins a shape the app never
  writes; `pantryCacheReaders.test.ts` asserts the literal key.
  The server refusal remains the BACKSTOP for what the cache cannot see: a windowed list (`itemsFirst` is
  100, and server mode keys the field by its real filters so the read misses), or a collaborator's add. The
  barcode scanner keeps server-only detection — its UPC lookup is `network-only`, so it has no offline path.
  When the backstop fires, the add sites withdraw the optimistic row and then differ:
  the details form and the barcode scanner prompt restock / add-anyway, while the sheet's **quick-add
  silently restocks the existing row by 1** and corrects its eager "added" toast. The withdrawal is
  `revertOptimisticPantryItem` (`features/pantry/cache/items.ts`), the enforced mirror of
  `addPantryItemLocally` — it must reverse BOTH counters the publish moved. Only the connection's
  `totalCount` self-heals (the field policy drops a dangling edge on read); `Pantry.stats.totalItems`
  does not, and the header, the "All" tab badge and `usePantryScreen`'s server/client sort mode all read
  it. Ratcheted by `__tests__/apollo/pantryOptimisticRevertWiring.test.ts`.

## 8. Connectivity — two failure modes, one signal

`NetInfo → networkSlice.isOnline` detects _device internet_, not "our API is reachable." The two
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
- **`queueLink`** queues replay-allowlisted mutations (`localFirst` opt-ins or registered for replay) immediately
  instead of firing doomed requests, matching the offline path's allowlist (mutations outside the allowlist
  still fire and surface their error — they aren't safe to auto-replay).
- **`queueManager.processQueue`** skips replay (a replay to a down API would just fail and re-trip the breaker);
  recovery (`requestDrain` on breaker close) re-drains.

The user-toggled **offline mode** (`offlineModeEnabled`) is a third input to `offlineModeLink`'s
query-blocking, orthogonal to connectivity.

## 9. Failure handling & UX

- **Offline indicator.** `OfflineStatusPill` (`components/molecules/OfflineStatusPill.tsx`) sits inline
  in each screen's header, and `OfflineTransitionToaster` (`components/atoms/`, mounted once in
  `App.tsx`) announces each offline/online transition with a toast. Both read `useOfflineStatus`, so
  they cannot disagree. They cover **both** unreachable cases — device offline AND API-down-while-online
  (the reachability breaker) — plus the user-toggled offline mode, with distinct i18n'd messages
  (`offlineBanner.*` keys, pluralized). When the queue has PENDING entries the message carries the
  **pending-changes count**, read live via `usePendingMutationCount()` (`useSyncExternalStore` over
  `queueStore.subscribe`). The cause is the store's debounced `offlineBannerCause`, so a message does
  not rewrite itself mid-display.
- **Permanent failure.** `registerQueueFailureHandler` (`apollo/offlineQueue/queueFailureHandler.ts`)
  is the one registration, made from `useStartupInit`. `handleQueueFailure` withdraws the count or
  unlink its operation registered, evicts the entity the write created or changed — its subject, read
  from the operation's input type (`queuedSubject.ts`), never a parent or source it merely names —
  clears that entity's persisted optimistic fields, toasts the user in the app's own copy and **removes
  the entry from the queue**. Once the drain pass settles it re-reads the active queries, so a refused
  update's row comes back with the server's value and a refused create's row stays gone. A write whose
  input names no subject (a settings mutation, §10) evicts nothing: the re-read replaces its local value
  if its screen is open, and the next `cache-and-network` read does otherwise.
- **Reconnect ordering.** The resync that follows a reconnect waits for the queue to drain
  (`queueManager.whenIdle()`, § 1), so a refetch never paints the server's value over a queued toggle.
  A screen that MOUNTS during the drain still runs its own first `cache-and-network` fetch, which can
  land first; the replay then corrects it.
- **Network errors** on an opted-in mutation queue silently; they raise no alert.
- **The replay reads the CODE.** `queueErrorPolicy.classifyError` decides withdraw-vs-park from a
  failure's code, so anything thrown on the session path is a `SessionError` carrying one: a bare
  `Error` reads as an unknown permanent failure and withdraws the write. Measured on a device — of
  three writes queued across one revoked session, only the one whose failure carried a code survived.
- **Only a missing unit row is stale.** A `NotFoundError` on the unit resource triggers a vocabulary
  refresh and a retry; `UNIT_INVALID` does not. The API defines it as the unit being invalid for the
  operation (no conversion route, a fact the food does not record, a measure the stack cannot
  express), none of which a refresh clears — and the replay re-sends the same unit, so retrying only
  delays the withdrawal. The interactive path refetches the ranked units so the user can pick another.
- **A queued write outlives the build that shaped it.** `queueStore` rewrites each entry on load
  into this build's input shapes (`legacyExpiry.ts`, `legacyRefs.ts`), and drops from its stored
  document the fields the API has removed since (`legacySelections.ts`: the batch lines' old failure
  fields, `quantityIncremented`, the recipe add's and batch move's old lists): the API refuses a
  retired shape or an unknown field before any resolver runs, so an entry left as queued is a write
  lost after an upgrade.
- **Not yet shipped:** a uniform offline-degraded affordance for online-only features.

## 10. Scope

**Local-first today (opted in by `context: { localFirst: true }` on the `useMutation` options, with a
permanent cache write):**

- **Pantry:** create (every add surface — `usePantryItemSubmission`, `AddToPantrySheet`,
  `SelectPantryItems` onboarding, barcode), delete.
- **Shopping:** add (every add surface — `useAddShoppingItem`, `AddToShoppingListSheet`, `AddEditItem`,
  barcode, filtered-pantry, pantry-item-detail, recipe single + batch), remove, toggle-purchased, update,
  quantity ±, reorder/move.
- **Shopping list create** (`useCreateShoppingList`) — the list itself. Plain-create tier: the queue
  replays the original `CreateShoppingList` keyed by the client-minted `input.id`; a duplicate replay
  returns `ConflictError(code: IDEMPOTENT_REPLAY)`, which the queue converges — the first attempt's row
  stands.
  The optimistic write also seeds both empty `itemsConnection` variants and the `Query.shoppingList`
  cache redirect serves by-id reads, so a list created offline is immediately usable (items can be
  added to it offline; the FIFO queue replays the list create before its items). Known limits:
  `isDefault: true` doesn't clear the flag on other cached lists until the post-replay refetch, and the
  list-settings screen for a fresh offline list still needs the network for collaborator/share fields.

- **Pantry update** (`useUpdatePantryItem` / `useUpdatePantryItemQuantity`) — permanent write + revert
  snapshot; replays as itself at the version it holds (§ 5).
- **Pantry create** (`PantrySettings` + `src/features/pantry/cache/pantry.ts`) — the pantry
  container itself. Client-minted id; the optimistic write materializes the entity, zeroed `stats`,
  empty `itemsConnection` (no-args variant — matches the screen's undefined filters/orderBy) and
  `storageLocationsConnection(first: PAGE_SIZE.COMPACT)` variants, plus the home's `pantries` /
  `pantriesConnection` membership, and the `Query.pantry` cache redirect serves by-id reads — so a
  pantry created offline is immediately usable and items added to it queue behind its create
  (the drain holds an item behind the create of the pantry it names).
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
  `localFirst`; plain-create tier keyed by the client-minted id.
- **App settings + notification preferences** (`useAppSettings`, `useNotificationSettings`) — both go
  through `updateEntityFieldsLocalFirst` (§2): `cache.modify` the changed fields on `UserSettings` /
  `NotificationPreferences`, fire, revert from the caller's snapshot only on a rejection. No
  `optimisticResponse` anywhere here — an optimistic layer is torn down the moment the mutation
  completes, and offline that completion is `queueLink`'s null result, which is what snapped every
  toggle back while the change sat queued. Replay is the plain-create tier: settings writes are
  naturally idempotent (last write wins on the same fields), so a duplicate replay converges.
  **Offline mode is the one exception to "the cache is the source of truth"** — the switch renders from
  the Zustand store, because that is what `offlineModeLink` reads and what is mirrored to MMKV; the
  server copy is a cross-device mirror. `useAppSettings` syncs the store back off the query, so a
  server rejection reverts the store too.
- **Pantry granular deltas** (`AdjustPantryItemQuantity`, `RestockPantryItem`, `CreatePantryItemUsage`,
  `OpenPantryItemBatch`, `WastePantryItemBatch`, `ConvertExpiredToWaste`, `ConvertExpiredBatchesToWaste`)
  — replay as the **original canonical mutation**, made at-most-once by a client-minted
  `input.idempotencyKey` the server records in the same transaction as the delta (deltas are relative, so
  entity-id idempotency can't dedupe them; the key can). A replay returns
  `ConflictError(code: IDEMPOTENT_REPLAY)`, which the queue converges. The key rides in the persisted
  variables, so it survives an app kill between enqueue and replay.

**Online-only (degrade, not queued):** auth, invites/share-codes/collaboration/membership, image upload,
barcode/smart-search lookup, recipe discovery/AI, recipe reviews, recipe favorite/saved-metadata/folders,
`markRecipeAsCooked` + pantry deduction, server-aggregation (generate-list-from-meal-plan, add-low-stock,
meal templates), and the recipe **fan-out** mutations `addRecipeToShoppingList` /
`createShoppingListItemsFromRecipe` (they expand into N server-derived items with no per-item id slot —
the offline path is the client expanding the recipe locally and using the now-id-capable batch
`addItemsToShoppingList`).
**Home create is local-first** (`useCreateHome`): the create writes the home with a placeholder owner
membership through `writeLocalHome` (`src/features/home/cache/optimisticHome.ts`), and on replay
`reconcileCreateHomeReplay` adopts the server's membership row (`adoptServerMembership`), the one thing
the client cannot key. Home update and delete stay online-only.
The online-only list is **enforced in code**, not just convention: `queueLink` only queues allowlisted mutations
(`localFirst` opt-ins + registered ops) when the device is offline; everything else fails fast with
a network error so the hook's normal error path shows a truthful failure and nothing ghost-replays.

**Profile** is local-first too: `useUpdateProfile` and `useDietaryProfile` write through
`localFirstFields` and send with `localFirst`, like the settings above.

Replay is insertion-ordered and dependency-aware, so
dependents queued behind a parent-entity create (items in a new list, meals in a new plan, meals
referencing a new recipe, items in a new pantry) replay only after their parent has landed — the
drain reads the parent reference off the input, so no per-feature special-casing.

## 11. Server contract (verified)

- **Client-supplied `id`** is accepted on every named client-create input: `CreatePantryItemInput`,
  `BatchAddShoppingListItemInput`,
  `CreateShoppingListItemFromRecipeIngredientInput`, `CreateShoppingListInput`, plus `createHome` /
  `createStorageLocation` / `createMealPlan(Item)` / `createMealTemplate` / `createRecipe` (top-level).
  Format: cuid2 (validator `/^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/` also accepts legacy cuid v1
  and 24-char hex); omitted → Prisma `@default(cuid(2))`. Note `createShoppingList`
  (like `createHome` & co.) answers a duplicate replay with `ConflictError(code: IDEMPOTENT_REPLAY)`;
  the queue treats that as already synced and drops the op.
- **NOT id-capable by design:** `createNotification` (system/cross-user generated) and the recipe fan-out
  mutations above.
- **Every canonical mutation is safe to re-send** (§ 5): creates by id, updates by version, deletes
  converge, deltas by `idempotencyKey`. A create that lands on a held row reports `outcome: MERGED`
  and returns the surviving row; later writes naming the minted id are refused.

## 12. Edge cases handled

- **Lost-response duplicate** — prevented by the PK (same id → find-by-id → update).
- **Ghost temp rows / temp→real remap** — eliminated (no temp ids exist).
- **Add-then-edit/delete offline** — the real id exists immediately; later ops reference it; the queue
  sequences per-entity by that id.
- **Catalog-merge id divergence** (shopping) — `reconcileShoppingItemCreateUpdate` (foreground) and
  `reconcileShoppingAddReplay` (replay) withdraw the minted row when the returned row is another, reading
  the minted id off the mutation's own variables (§4, §7).
- **`totalCount` / stats drift** — the optimistic write adjusts list counts (`addLocalShoppingListItem`
  bumps `totalItems` + recomputes `remainingItems` / `completionRate`); a **rejection reverses them**
  symmetrically via `revertOptimisticShoppingListItem` (a bare evict would leave the header inflated until
  the next stats refetch).
- **Rejected-create phantom** — a non-success payload resolves under `errorPolicy: 'all'` without throwing;
  every add site (incl. the primary hooks) classifies the result and reverts, so a server-refused create
  never lingers (§2, §4).
- **First-page refetch dropping an un-replayed offline create** — the `itemsConnection.merge` preserves
  existing edges whose id is still PENDING or PROCESSING in the queue (§1); drains to the authoritative
  page once replayed.
- **First-page refetch of a multi-page list** — an entry an insert or reorder pushed past the refreshed
  page stays held until a page that covers it is refreshed (`mergeAuthoritativeFirstPage`,
  `src/apollo/cacheFieldPolicies.ts`), so `fetchMore` resumes without skipping it.
- **Stale persisted optimistic value on restart** — version guards + `clearPersistence` for the
  `OptimisticDataPersistence` consumers.
- **App-kill within the cache persist debounce** — covered two ways: the background flush
  (`flushCachePersistence`, §1/§6) writes the raw cache snapshot before a kill, and `OptimisticDataPersistence`'s
  microtask flush covers the numeric/toggle ops; in the worst case the **queue replays** the change on next
  launch regardless.
- **Collaborator-connection staleness window (accepted)** — the shopping-list subscriptions
  (`useShoppingListSubscriptions.ts`) live-maintain `collaboratorsConnection` membership for the **active
  list only**. Other lists' collaborator/membership connections are not patched from subscription events;
  they self-correct via `cache-and-network` on the next visit. With the persisted MMKV cache this means a
  non-active list can show a briefly stale collaborator set until it is reopened — an expected, accepted
  window, not a bug (it mirrors the `pantryEvents` active-container-only maintenance).

## 13. Divergences from the original plan (for the record)

- **No `useLocalFirstMutation` primitive** (planned §3.1). Replaced by per-site Pattern B + the shared
  cache-writers (§2, §4) and `settleMutation`.
- **Identity is client-generated cuid2** (planned §8), not temp-id + reconciliation. This removed the
  largest planned subsystem — the `idMapping` / `resolveIds` / temp-id machinery has been fully deleted
  (no references remain in the codebase).
- **Offline-UX shipped** (planned Phase 4): the offline indicator (`OfflineStatusPill` + `OfflineTransitionToaster`) covers device-offline, API-down, and
  offline mode, with a live pending-changes count (§9).
- **Replay through `Sync*` twins retired** (2026-09): every queued write replays as its canonical
  mutation (§ 5), after the API made each safe to re-send and deprecated the twins.

## 14. Key files

| Area                                               | File                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client id generator                                | `src/utils/generateEntityId.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Queue intercept                                    | `src/apollo/offlineQueue/queueLink.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Queue store (MMKV)                                 | `src/apollo/offlineQueue/queueStore.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Replay                                             | `src/apollo/offlineQueue/queueManager.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Replay preparation + registry                      | `src/apollo/offlineQueue/prepareReplay.ts`, `replayPreparation.ts`, `preparationRegistry.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Feature replay preparers                           | `src/features/pantry/offline/replayPreparers.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Replay payload classification + retry error policy | `src/apollo/offlineQueue/queueErrorPolicy.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Pending-changes count (banner)                     | `src/hooks/offline/usePendingMutationCount.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Queue triggers / failure toast                     | `src/hooks/app/useOnlineQueueSync.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Field-level persistence                            | `src/apollo/offline/OptimisticDataPersistence.ts`, `src/hooks/offline/useOptimisticDataRestoration.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Cache persistence (debounce + `flushPending`)      | `src/apollo/offline/ApolloCachePersistence.ts`, `src/apollo/client.ts` (`flushCachePersistence`), `src/apollo/offlineQueue/queueLink.ts` (flush on enqueue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Background flush trigger                           | `src/hooks/app/useAppStateLifecycle.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Pending-aware connection merge                     | `src/apollo/cacheFieldPolicies.ts` (`itemsConnectionFieldPolicy`, `mergeAuthoritativeFirstPage`) + `queueStore.getUnconfirmedCreateIds()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Shared shopping writers/reconcilers                | `src/features/shoppingList/cache/items.ts` (`createLocalShoppingListItem`, `addLocalShoppingListItem`, `reconcileShoppingCreate`, `revertOptimisticShoppingListItem`), `createShoppingListRow.ts`, `withdraw.ts` (`withdrawShoppingListItems`)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Replay reconcilers                                 | `src/apollo/offlineQueue/queueReplayReconcilers.ts` (`REPLAY_RECONCILERS`), each feature's `offline/replayReconcilers.ts`; coverage: `__tests__/apollo/replayReconcilerCoverage.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Resync after foreground / reconnect                | `src/apollo/refetchEvents.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Local row writers (`writeLocalEntity`)             | `src/apollo/utils/writeLocalEntity.ts`; `writeLocalPantryItem`, `writeLocalPantry` (`src/features/pantry/cache/`), `writeLocalHome` (`src/features/home/cache/optimisticHome.ts`), `writeLocalStorageLocation` (`src/features/catalog/hooks/useCreateStorageLocation.ts`), `writeLocalShoppingList` and `addLocalShoppingListItem` (`src/features/shoppingList/cache/`), `writeLocalRecipe` (`src/features/recipes/utils/recipeCacheWriters.ts`), `writeLocalFavorite` (`src/features/recipes/cache/favorites.ts`), `writeLocalMealPlan` and `writeLocalMealPlanItem` (`src/features/mealPlan/cache/`), `writeLocalMealTemplate` and `addTemplateItemToCache` (`src/features/mealPlan/cache/`) |
| Settings-shaped field writer                       | `src/apollo/utils/localFirstFields.ts` (`updateEntityFieldsLocalFirst`, `writeEntityFields`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Write-outcome settling and classification          | `src/apollo/utils/settleMutation.ts` (`settleMutation`, `settledStatus`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Optimistic-entity completeness guard               | `__tests__/apollo/optimisticEntityCompleteness.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Offline indicator                                  | `src/components/molecules/OfflineStatusPill.tsx` (in each screen header), `src/components/atoms/OfflineTransitionToaster.tsx` (mounted in `App.tsx`), both reading `src/hooks/app/useOfflineStatus.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Query short-circuit when offline                   | `src/apollo/links/offlineModeLink.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| API-reachability circuit breaker                   | `src/apollo/links/apiReachabilityBreaker.ts`, `networkStatusLink.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Unified `isApiUnavailable` predicate               | `src/store/slices/networkSlice.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Primary add hooks                                  | `src/features/shoppingList/hooks/mutations/useAddShoppingItem.ts`, `src/features/pantry/components/modals/AddToPantrySheet/AddToPantrySheet.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
