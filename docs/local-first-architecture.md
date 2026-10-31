# Local-First Architecture

**Status:** Implemented for every write `queueLink` can replay (§10). Last validated 2026-10-31
against the codebase.

**Goal.** A user can add, remove, and adjust items on their own data **instantly, with no network
round-trip and while fully offline**. The API is for **syncing across collaborators and devices**, not a
prerequisite for the action. Online-only features (smart search, barcode lookup, recipe
discovery/AI, invites/sharing, auth, image upload) degrade rather than block.

This document describes how the system actually works today. It supersedes the original planning
notes; where the implementation diverged from the plan, the divergence is called out.

---

Everything below that is "on disk" — the persisted cache, the offline queue,
the store's persisted slices — is written through `storage` and `zustandStorage`
from `src/store/deviceStorage.ts`, the platform's key-value store. On mobile
that is the encrypted MMKV instance (`src/native/storage/mmkv.ts`, adapted in
`keyValueStore.ts` beside it), so "MMKV" below means device storage there. When
storage falls back to the unencrypted recovery instance, neither the cache nor
the queue is written: the queue then lives in memory for the session.

## 1. Read path — local-first

- Apollo `InMemoryCache` is persisted to MMKV as one blob (`ApolloCachePersistence.ts`):
  `cache.extract()` / `cache.restore()`, so connection wrappers (`edges`, `pageInfo`) survive across
  launches. The only changes on the way are pruning `__META.extraRootIds` whose entity is gone, and
  skipping a save when no entity changed. The blob is stored with its shape (`apollo-cache-version`,
  `shape-7`; a mismatch wipes it) and the language it was answered in (`apollo-cache-language`, which
  the `languageChanged` resync reads). `cache.write/modify/evict/gc` are wrapped in `client.ts` to
  re-persist (debounced 3 s, then saved when idle). Cold start paints from disk. On app **background**,
  `useAppStateLifecycle` calls `flushCachePersistence()` (`ApolloCachePersistence.flushPending`) to write
  the owed snapshot immediately; a no-op when nothing is owed (see §6).
- Default fetch policy `cache-and-network` → instant cache read + background refresh; after the first
  fetch a watcher settles on `cache-first`. What the device may have missed while backgrounded, offline
  or with the socket down is re-requested by the resync (`src/apollo/refetchEvents.ts`, Apollo 4.2's
  `RefetchEventManager`). Its sources (`connectResyncSources`) are a return to the app with the live
  channel closed (or after 30 s away), the API reachable again, a WebSocket reconnect, a language
  change, leaving a household, and a screen shown again. Triggers settle together (1.5 s, at most
  5 s); the resync waits for the queue to drain, then refetches the active queries on screen that have
  not opted out with `refetchOn: false` and have not answered since the trigger. A hidden home tab
  catches up when it is shown (`docs/apollo-client-patterns.md` § Resync).
- A transient API failure does not wipe cached lists: `usePreservedConnection` /
  `usePreservedQueryData` keep the last good value for the subject it was loaded for (each takes the
  subject's key, so a pantry or list switch never shows the previous one's rows), and the `itemsConnection.merge` guard only honors an
  **authoritative** `totalCount: 0` (see the cache-connection-resilience note).
- A first-page background refetch that lands **before** the queue replays an offline create cannot
  lose that item: the row is in its pending layer (§2), over the page, so the merge takes the page as it
  stands. A genuinely **server-deleted** item has no pending write holding it and drops.

## 2. Write path — the implemented pattern

A local-first write is **held as an Apollo optimistic layer until the server has it.** The cache's root
holds only what the server said. Each write it has not taken is one layer over that root, and a screen
reads the two together. So the change shows at once, a queued write keeps showing across a restart,
and a refusal drops the layer, with nothing to undo.

`PendingWrites` (`src/apollo/pendingWrites/pendingWrites.ts`, one per cache through `pendingWritesOf`)
records the layers itself. An `optimisticResponse` cannot do this job: Apollo removes that layer when
its mutation settles, and the queue settles a queued write with a `null` result, so the change would
vanish while it waits.

**One `LocalWrite` per operation.** `LOCAL_WRITES` (`src/apollo/pendingWrites/localWriteRegistry.ts`)
maps an operation to what it changes on the device; a feature keeps its own in `offline/localWrites.ts`.
`__tests__/apollo/localWriteCoverage.test.ts` holds every local-first operation to one, or to a stated
reason for having none (those show on the answer).

| Member      | Runs                                                     | Does                                                                                |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apply`     | In a layer: when made, on every rebuild, after a restart | Shows the change                                                                    |
| `capture`   | Once, when the write is made                             | Reads from the cache what its caller did not pass                                   |
| `commit`    | On the root, after the server confirms                   | Writes what the answer does not state, such as a new row's edge                     |
| `refused`   | When the server refuses a queued write for good          | Undoes what the write left outside the cache, which dropping its layer cannot reach |
| `orderedBy` | At send                                                  | Names what the write is sent in order behind, when its input names no row           |

`apply` gives the same result from the same variables, inputs and cache, because it re-runs whenever
the server's data under it changes. `sous-chef/local-write-is-deterministic` bans clocks, id minting
and eviction there: what it cannot re-derive goes in `inputs`, which are queued with the write, so they
are JSON.

Lifecycle of a local-first mutation:

```
1. id = generateEntityId()                  // creates only: a permanent cuid2, the row's PK
2. pendingWritesOf(cache).send(document, variables, settle, inputs)
   │  the layer shows the change now; the mutation leaves once the earlier writes it builds on
   │  have answered (an edit behind its row's create, a version behind the write that moved it)
   ├─ applied → the answer is in the root; `commit` adds what it does not state; the layer goes
   ├─ queued  → the layer stays; the queue stores the variables and inputs and replays them
   └─ failed  → the layer goes; the screen ends on what the server said
```

A replay ends the same way: `queueManager` confirms with the replay's answer, so `commit` runs for a
foreground write and a queued one alike, and the two cannot drift. A write on a row whose create was
refused is refused with it, and only the create's failure is reported.

**What `commit` owes.** The answer normalizes itself, so `commit` writes only what it does not state,
and writing one starts from the mutation's selection. `AddTemplateItem` answers the template alone, so
its `commit` writes the row; `DeleteRecipeFolder` answers a name and a count, so its `commit` repeats
`apply`. A removal answered "not found" counts as applied: `commit` runs with the refusal member as its
data, so `appliedPayload(data)` is null there and the write settles its own counts. An `evict` in a
layer does not reach the root, so `apply` hides a row with `hideEntity`
(`src/apollo/utils/writeLocalEntity.ts`), and `commit` is what removes it.

**The fence.** A request sent after a mutation's response sees its write, so only a read already in
flight at the confirm can hold state from before it. `confirm` waits for those reads (`ReadFence`,
`src/apollo/pendingWrites/readFence.ts`, at most 30 s). Meanwhile the layer shows the answer, and the
commit writes the answer again, ordered, in case such a read put a row back. With no read in flight it
commits at once.

**The rebuild.** A layer stores the whole entity it touched, so it hides the root's later change to any
other field of that entity. Each write to the root schedules a rebuild (one per 50 ms), which swaps
every layer for one new generation applying every write, in order, over the new root. Verified:
`#apollo-an-optimistic-layer-copies-the-whole-entity`. `cache.batch` undoes a layer change made inside
its `update`, so a write is never begun from one.

**Where the marker lives.** `localFirst` is set once, on the hook's `useMutation` options, not on each
call. Apollo 4.2 merges execute-time options over the hook's, and a per-call `context` object REPLACES
the hook's context rather than merging into it (`src/apollo/__tests__/hookMutationContext.test.ts`), so a
call that needs another context key passes the callback form, `context: hook => ({ ...hook, key })`.
`send` hands its `settle` a context that carries the marker and the write's id, which is how `queueLink`
finds the write. `sous-chef/queueable-write-is-local-first` enforces it: a queueable write carries the
marker, a per-call `localFirst` on a hook that already sets it is redundant, a per-call context object on
such a hook drops it, and a local-first write takes no `optimisticResponse`. A helper that fires whatever
mutate function its caller passes (`createShoppingListRow`) and `client.mutate` callers pass it per call.

**Settling.** Under the global `errorPolicy: 'all'` a `ValidationError` / `ConflictError` **resolves**
(it's a valid union member, not a thrown error), so `onError` never fires and only inspecting the result
catches it. `settleMutation` / `settledStatus(result) → 'applied' | 'queued' | 'failed'`
(`apollo/utils/settleMutation.ts`) centralizes that decision: a queued write is no failure, a refusal
member is one. It takes the result (and `removal`, under which "not found" means applied). The payload
field and the success member are derived structurally via `utils/errors/mutationPayload.ts`, shared with
`classifyReplayResult` (§ replay), so the foreground and replay paths apply one rule. What stays
per-site — input construction and success UX (navigate / close / toast / restock) — is irreducibly
site-specific.

**Field edits share one `LocalWrite`.** `entityFields` (`apollo/pendingWrites/entityFields.ts`) is the
write whose change is fields on one row, in that row's own field names: `apply` writes them with
`cache.writeFragment` (never `cache.modify`, which skips a field's write-time invariant), and the answer
states the row, so nothing is left to commit. `sendFields` (`sendFields.ts`) sends one. It returns the
outcome rather than reporting it: its callers (`useUpdateSettings`, `useNotificationSettings`,
`useUpdateHomeFields`, `useMealTemplateEditor`, `useDeviceTimezoneSync`, `useCompleteOnboarding`) surface
a refusal differently, and deciding that centrally is what produces double alerts.

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

The same cuid rides the create input as `input.id`, and its replay sends the same input.

## 4. Optimistic-offline appearance

A create's `apply` writes the whole row, so a newly-added item is visible immediately and survives a
fully-offline create. Two shared writers keep this DRY:

- **`createLocalShoppingListItem(id, fields)` + `addLocalShoppingListItem(cache, listId, item)`**
  (both `features/shoppingList/cache/items.ts`) — the row a create adds, written through
  `writeLocalEntity` over the readers-based `items_row` fragment: what the create knows, else what the
  cache holds, else the SDL neutral. A related `unit` / `item` is named by reference only when the cache
  holds it, so a create never overwrites a held `Unit`'s name or an `Item`'s images. The writer also adds
  the connection edge and recomputes list stats. A feature's `cache/` is outside the closed internals
  (`context/`, `hooks/mutations/`, `utils/`, `components/`, `offline/`, `graphql/`), so add surfaces in
  other features
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
writer that links the entity into a read connection: the local row writer, the
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
  hold the row as a pending write, send `AddItemToShoppingList` local-first, settle with
  `settleMutation`. Returns `{ id, outcome, failure, data }`, where `id` is the row the line landed on
  (the server's when it folded the add into a line it held, else the minted id), and never presents the
  failure, so each surface keeps its own success and error UX. `useAddShoppingItem`,
  `useShoppingListItemWrites.createItem`, `useAddPantryItemToShoppingList`, `useAddToShoppingList`,
  `usePantryItemDetailActions` and
  `useAddScannedItem` go through it. A row names the item its line names, unless it states its own
  `itemId` (a scanned line naming a product record still names the record's item).
- **Catalog merge** — when the server folded the line into a row it held (a different id), the minted
  row was only ever in the write's layer, so it goes with it, and `addRows.commit` lists the row the
  answer names. On replay, `reconcileShoppingAddReplay` moves the writes queued behind it (§ 7).

**Success is decoupled from `result.data`.** A queued create resolves with `data: null` and no error —
that counts as success (the layer stays; the queue replays). A **real error** or a **non-success
payload** (e.g. `ConflictError` / `ValidationError`) settles `failed`, and the layer goes.

## 5. Offline queue

- **`queueLink`** (in the link chain, after `errorLink`/`authLink`, before transport) queues a mutation
  on the replay allowlist — `localFirst` opt-ins or the operations registered for replay
  (`REPLAY_PREPARATIONS`, `hasReplayPreparation`) — when:

  - (a) the device is offline (`shouldTreatAsOffline`: NetInfo says offline and nothing has proven the
    API reachable);
  - (b) the reachability breaker is open (`apiReachable === false`);
  - (c) it names a row an undelivered queued write changes (`getUndeliveredIds`: pending, replaying or
    parked for re-auth), as its subject or a parent (`dependencyIdsOf`). Sent at once it would overtake
    that write: an edit before the create it names, or a second write at the same base version. It
    queues behind it (`queuedReason: 'behind-queued'`) and `drainAfterPass` sends it next. A write
    still in flight online is not in the queue, so an edit made while its row's create is on the wire
    is sent at once, and can meet `NotFoundError` or a `VERSION_CONFLICT` against the local row's
    version. That window is an open gap;
  - (d) a `localFirst` write sent online fails with a network error before any result.

  Offline, a mutation NOT on the allowlist fails fast with `OfflineRejectedError`, an honest immediate
  failure instead of a ghost replay on reconnect; with only the breaker open it is forwarded and
  surfaces its own error. On success it calls `queueManager.requestDrain()` (covers API-recovery where
  `isOnline` never flipped). GraphQL/validation errors pass through to the hook.
  `NEVER_QUEUE_OPERATIONS` (auth) forward straight to transport. A queue at `MAX_QUEUE_SIZE` (100) with
  nothing terminal to evict refuses the enqueue, and `withdrawUnqueueableWrite` withdraws the local
  write.

- **`queueStore`** persists the queue to MMKV, user-scoped: each entry's operation name and variables,
  never its document. Survives restart. A reloaded entry is sent as this build's document for its
  operation (`MUTATION_DOCUMENTS`, which codegen writes from every `.graphql` mutation); an entry whose
  operation this build does not declare is dropped on load. The persisted `context` is an **allowlisted subset** (`localFirst`
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
  version the server returned instead of conflicting with its sibling. A converged answer is the row
  as it stands, so past one step it carries another device's change: the writes behind it keep their
  version and meet that as a conflict. A create the server merged into
  a row it already held (`outcome: MERGED`) moves every write still queued against the minted id to
  the surviving row, at its version; the server refuses the minted id from then on. Two kinds are not
  moved: a queued removal of the minted row is dropped, since removing the surviving row would remove
  stock the person never saw (they are told, `queuedRemovalKept`), and a write that overwrites the
  quantity or unit the merge combined (`MERGED_QUANTITY_OVERWRITES`) is withdrawn as a conflict. Both moves are
  written to the queue itself, so a restart mid-drain keeps them. Retries use exponential
  backoff + jitter;
  an auth error forces ONE token refresh and then retries through the same bounded counter. A failed
  refresh PARKS the entry (`AUTH_ERROR`) until a new session token revives it (`onSessionToken`); a
  parked entry the 24 h terminal cleanup ages out is withdrawn through the failure handler. A rate
  limit holds every drain until its `retryAfterMs` (`drainNotBefore`). Triggers: `useOnlineQueueSync`
  (offline→online), `useAppStateLifecycle` (every return to `active`), `onUserChange`,
  `onSessionToken`, the resync's `whenIdle`, `drainAfterPass` (a write queued while a pass runs) and
  the drain-on-recovery above. At drain start, an entry a killed process left PROCESSING goes back to
  PENDING; a replay times out after 30 s. A network/server error that exhausts in-run retries stays
  **PENDING** (never silently FAILED); only a real (validation) error → FAILED.
- **Failed-mutation entity identity is derived from the cache, not maintained.** The failure
  handler names the entity's `__typename` in its toast, and needs it to evict for a write with no layer;
  `extractEntityInfo` reads it off the normalized cache key (`TypeName:<clientId>`) at failure time.
  Client ids are globally-unique cuids, so the cache is the source of truth. No per-operation map
  exists; an entity that isn't cached yields null and the handler skips the evict — the next refetch
  heals.
- **Replayed results are payload-classified** (`classifyReplayResult`, `queueErrorPolicy.ts`) — the
  replay-side counterpart of the foreground `settledStatus` rule. Under `errorPolicy: 'all'` a
  server refusal RESOLVES as an error union member (`ValidationError` / `ConflictError` / …) rather than
  throwing; without classification a rejected replay would be marked SUCCESS and its commit would
  keep a change the server refused. A rejected payload routes through the permanent-failure pipeline
  (drop + toast + dequeue, via `ReplayRejectedError` → the registered failure handler). A write
  that already committed answers its success payload with `converged: true` and the row as it stands,
  so it is treated as applied. A `ConflictError` whose `code` is `IDEMPOTENT_REPLAY` is **converged**
  too: this exact op committed once, but its row is gone or the caller can no longer read it, so there
  is no row to commit; dequeue as success. Matched on the **code**, never the message; a generic
  `ConflictError` is a real version/uniqueness conflict → rejected.
  A batch that applies with a row refused as `INTERNAL_SERVER_ERROR` or `DEADLOCK` is deferred whole
  (`BatchRowDeferredError`): each row converges on its id, so the re-send is safe, while dropping that
  row would discard a write the server never refused.
- **A replay refused because its row is gone can settle silently.** An operation listed in
  `GONE_REPLAYS` (`replayRegistry.ts`: notification mark-read and delete, meal-plan item delete) treats a replayed
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

| Queued write                                                            | Why a re-send is safe                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Create with a client-minted id (`CreatePantryItem`, the batch adds, …)  | the id is the row's PK: a re-send converges and returns the row, or answers `IDEMPOTENT_REPLAY` if it is gone |
| Update (`UpdatePantryItem`, `UpdateShoppingListItem`, quantity, toggle) | version-checked: a stale version applies nothing (`VERSION_CONFLICT`, § 5)                                    |
| Delete (`DeletePantryItem`, `RemoveItemFromShoppingList`)               | converges: `converged: true`, the entity `null`                                                               |
| Reorder (`MoveShoppingListItem`)                                        | repeats to the same order; a line removed since is `NotFoundError`                                            |
| Cumulative change (the pantry deltas)                                   | at-most-once by `input.idempotencyKey`: a re-send converges and returns the row                               |

What a replay restates is only what the device knows better by then. `prepareReplay`
(`src/apollo/offlineQueue/prepareReplay.ts`) looks the operation up in `REPLAY_PREPARATIONS`
(`preparationRegistry.ts`), which also names the writes `queueLink` takes offline without the caller's
`localFirst` opt-in:

- **Units** (`withCurrentUnits`, `replayPreparation.ts`): the unit's symbol is captured when the write
  is queued (`replayInputs['unit:<id>']`, else read from the cache), since an id the vocabulary repair
  retired cannot be re-resolved and a symbol can. A batch line always sends its unit by symbol. A single
  row whose symbol was captured keeps its id until a refusal names it retired, since the service creates
  a counting unit for a symbol it does not know. A flat `unitId` takes no
  symbol, so after such a refusal the retry looks up the unit's current id by symbol (`unitBySymbol`).
- **A pantry create** (`preparePantryItemCreate`, `features/pantry/offline/`) replays with
  `forceAdd: true`, so a stack for the same item and unit another member added meanwhile absorbs it
  (`outcome: MERGED`) instead of refusing it (§ 7).
- **The day** (`$today`) is always the replay's: it only dates the totals the response reads back.

`offline/` is public to the queue and closed to other features (the `feature-queue` element in
`eslint/boundaries.js`).
Shopping quantity rides the `FlexibleQuantity` scalar (`string | number`, e.g. `"1/3"` or `2`); pantry
quantity is a plain `Float`.

## 6. Persistence

**The queue is the only store a local write needs.** The cache on disk holds what the server said, plus
the reference data offline reads use:

1. **The offline queue** (`queueStore`, `apollo-mutation-queue`, user-scoped by
   `apollo-queue-current-user`). Written synchronously on every enqueue and change: each entry's
   operation name, variables, and its pending write's id and inputs. It is the durable record of what
   the server has not taken (§5). At launch `restorePersistedCache` hands it to `pendingWrites.restore`
   over the restored root, so every queued write shows from the first paint. A sign-in does the same
   (`queueManager`), since a session end cleared the layers.
2. **Raw cache persistence** (`ApolloCachePersistence` + the `client.ts` write wrapper).
   `cache.extract()` returns the root, so no pending write reaches the blob, and a layer's own write
   schedules no save. It is re-persisted debounced ~3s and flushed on app **background** via
   `flushCachePersistence()` (§1). A kill inside the debounce loses only server data the next read
   brings back, never a write, so this store may be slow, late or lost without harm, which is what lets
   an asynchronous storage port carry it.

Offline reads also rely on persisted Zustand state: the root store's reference caches
(`cachedUnits`, `cachedCategories`, `cachedBrands`, `cachedStores`, `cachedItemSuggestions` and their
fetch stamps), the offline-mode flag (`user_offline_mode`), the catalog freshness stamps
(`sous-chef-catalog-fetch-times`), the receipt draft (`sous-chef-receipt-draft`, so a scan made offline
survives a restart) and recipe captures (`sous-chef-recipe-captures`).

## 7. Reconciliation & idempotency

- **By PK.** The cuid is `input.id` on create and on its replay; the server keys the row by it, so
  online success and queued replay converge on one row.
- **Shopping catalog-merge.** `addItemToShoppingList` is `@@unique([shoppingListId, itemId])` — if a
  client-created item resolves to a catalog item already on the list, the server keeps the **canonical
  row's PK** and increments quantity, so the returned `serverId` may differ from the client cuid. The
  minted row was only ever in its layer, and `addRows.commit` lists the row the answer names, so a merged
  line never leaves a ghost beside the canonical row. On replay, `reconcileShoppingAddReplay` moves the
  writes queued behind it to the kept row (§ 5). Custom (non-catalog) shopping items always keep the
  cuid.
- **Meal-plan items converge on a natural key.** The server returns the existing row for a matching
  (mealPlanId, date, mealType, recipeId). The write's `commit` lists it (`adoptServerMealPlanItem`),
  and `reconcileCreateMealPlanItemReplay` moves the writes queued behind the minted id.
- **Replay parity holds by construction.** `commit` runs for a foreground answer and a replay's alike,
  so `REPLAY_RECONCILERS` is left with what only a replay has: moving the writes queued behind a merged
  row onto the survivor. A queueable mutation takes no `update` of its own, which no replay would run
  (`__tests__/apollo/queueableWritesTakeNoUpdate.test.ts`).
  A removal's `commit` also covers the other half: it takes the edge out of its connection before it
  evicts, so a response that writes the deleted `{ id }` back cannot make the row readable again.
- **Pantry duplicates — decided locally.** `createPantryItem` never merges: it REFUSES with
  `DuplicatePantryItemError` and writes nothing. The key is `(pantryId, itemId, deletedAt: null)` — location,
  unit, expiry and brand are not part of it, and `forceAdd` joins the held stack instead. A queued create
  replays with `forceAdd: true` (§ 5): a stack another device added meanwhile absorbs the quantity and
  comes back as `outcome: MERGED` under its own id, and `commit` lists that row in place of the minted
  one.
  So the add sites ask the CACHE first, via `findCachedPantryItemDuplicate`
  (`features/pantry/utils/pantryCacheReaders.ts`): the list query already caches `item { id }` and `itemName` on every
  node, so the server's key is reproducible locally with no round trip. Quick-add matches on the catalog id
  and the unit the add would create, and restocks through its own pending write; an add whose unit is
  unknown is left to the server.
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
  When the backstop fires, the layer goes and the add sites differ:
  the details form and the barcode scanner prompt restock / add-anyway, while the sheet's **quick-add
  silently restocks the existing row by 1** and corrects its eager "added" toast.

## 8. Connectivity — two failure modes, one signal

`NetInfo → networkSlice.isOnline` detects _device internet_, not "our API is reachable." The
predicates in `networkSlice.ts` combine it with the API's own reachability, `apiReachable`, which is
tri-state: `true`/`false` once proven, `null` untried since the link dropped.

- `shouldTreatAsOffline = !isOnline && apiReachable !== true`: NetInfo says offline and nothing has
  proven the API reachable. A `/health` success while NetInfo says offline proves NetInfo wrong.
- `isApiUnavailable = apiReachable === false || shouldTreatAsOffline`: the server cannot be reached.
- `blocksCacheMissQueries = offlineModeEnabled || shouldTreatAsOffline`: deliberately narrower (below).
- `isNetworkWithheld = offlineModeEnabled || isApiUnavailable`.

**API down while online (timeout / captive portal / 5xx):** the **`apiReachabilityBreaker`** circuit
breaker (`closed | open`) drives `apiReachable`. `networkStatusLink` (above `retryLink`, so one outcome
per operation) feeds it: a real response → success; a network error, or a write queued after one
(`queuedReason: 'network-error'`) → failure. A write queued without touching the wire and an
`OfflineRejectedError` count as nothing. The first failure while closed fires one `/health` probe at
once: a success forgives the blip, a failure opens the circuit (3 consecutive failures open it anyway,
for an environment with no `/health`). While open, a `/health` probe loop (20 s, backing off to 120 s,
jittered) closes it on the first success, which drains the queue. `useOnlineQueueSync` resets it when the
device comes online; going offline calls `onDeviceOffline()`, which leaves `apiReachable` `null` and
starts probing.

Who reads what:

- **`offlineModeLink`** (first in chain) answers a query from the cache itself (`readQuery`) while
  `isNetworkWithheld`, so blocked queries never reach `retryLink`/`errorLink`. On a cache miss it
  answers an `offline.noCachedData` error when `blocksCacheMissQueries`; with only the breaker open it
  forwards the miss as an organic probe, so a failure there is a real network error. `RefreshToken` and
  `GetUserSettings` pass the user's offline mode while the server is reachable (`ALWAYS_ALLOW`), so
  tokens rotate and offline mode can be switched off.
- **`queueLink`** queues replay-allowlisted mutations when offline or the breaker is open (§5). The two
  differ for the rest: offline they fail fast; with only the breaker open they are forwarded and
  surface their own error.
- **`queueManager.processQueue`** skips replay while `isApiUnavailable` (a replay to a down API would just
  fail and re-trip the breaker); recovery (`requestDrain` on breaker close) re-drains.

The user-toggled **offline mode** (`offlineModeEnabled`) is a third input to `offlineModeLink`'s
query-blocking, orthogonal to connectivity.

## 9. Failure handling & UX

- **Offline indicator.** `OfflineStatusPill` (`components/molecules/OfflineStatusPill.tsx`) sits inline
  in each screen's header and fades in once a cause has held for 30 s (offline mode at once), so a
  passing hiccup shows nothing. No toast announces a transition: `OfflineTransitionAnnouncer`
  (`components/atoms/`, mounted once in `App.tsx`) reads it to a screen reader only. Both read
  `useOfflineStatus`, so they cannot disagree. They cover **both** unreachable cases — device offline AND API-down-while-online
  (the reachability breaker) — plus the user-toggled offline mode, with distinct i18n'd messages
  (`offlineBanner.*` keys, pluralized). When the queue has PENDING entries the message carries the
  **pending-changes count**, read live via `usePendingMutationCount()` (`useSyncExternalStore` over
  `queueStore.subscribe`). The cause is the store's debounced `offlineBannerCause`, so a message does
  not rewrite itself mid-display.
- **Permanent failure.** `registerQueueFailureHandler` (`apollo/offlineQueue/queueFailureHandler.ts`)
  is the one registration, made from `useCoreStartup` (`src/bootstrap/`). `handleQueueFailure` refuses the
  write (`pendingWrites.refuse`: its `refused`, then its layer goes), toasts the user in the app's own
  copy and **removes the entry from the queue**. A write with no layer evicts the entity it created or
  changed instead — its subject, read from the operation's input type (`queuedSubject.ts`), never a
  parent or source it merely names. Once the drain pass settles it re-reads the active queries, so a
  refused update's row shows the server's value.
- **Reconnect ordering.** The resync that follows a reconnect waits for the queue to drain
  (`queueManager.whenIdle()`, § 1), so a refetch reads what the queue sent. A screen that MOUNTS during
  the drain still runs its own first `cache-and-network` fetch, which lands under the layers.
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
- **Nothing is carried forward for an older build.** An older build does not work against the
  current API, so the queue converts nothing an older build stored: an entry is sent as this
  build's document with its variables as stored (§ 5), and the API refusing it withdraws it
  through the reported path.
- **Not yet shipped:** a uniform offline-degraded affordance for online-only features.

## 10. Scope

**What is local-first is decided in code, not here.** A write is local-first when its `useMutation`
sets `localFirst` (or a helper passes it per call); `sous-chef/queueable-write-is-local-first` holds
every queueable write to it, and `queueLink` queues only those and the registered replays (§5).
Everything else is online-only and fails fast offline. On 2026-10-30, 92 of the 147 authored mutations
were queueable. Areas, with what is worth knowing beyond the pattern:

- **Shopping:** every add surface goes through `createShoppingListRow` (§4); remove, toggle and record
  purchased, update, quantity, aisle, reorder (`MoveShoppingListItem`, coalesced to the latest per
  item), clear, complete/reactivate, budget, reminder, template, recurring, copy, set default, move to
  pantry (single; the batch move writes nothing before it lands).
- **Shopping list create** (`useCreateShoppingList`) seeds both empty `itemsConnection` variants, and
  the `Query.shoppingList` cache redirect serves by-id reads, so a list created offline takes items at
  once (the drain holds them behind its create). Known limits: `isDefault: true` doesn't clear the flag
  on other cached lists until the post-replay refetch, and the list-settings screen for a fresh offline
  list still needs the network for collaborator/share fields.
- **Suggestions:** dismiss and undo (`useSuggestionDismissal`). The dismissal's layer hides the
  suggestion in its cached sections; a refusal drops it and Undo's own write puts back exactly that
  entry, never a refetch. Undo is sent only after the dismissal settles, so a queued pair replays in order.
- **Pantry:** item create (every add surface through `usePantryIntake`), update, quantity, the
  granular deltas, delete, restock and usage; pantry create, update and delete. A pantry created
  offline materializes zeroed `stats`, the empty `itemsConnection` and `storageLocationsConnection`
  variants and the home's membership, and `Query.pantry` serves by-id reads.
- **Pantry granular deltas** (`AdjustPantryItemQuantity`, `RestockPantryItem`, `CreatePantryItemUsage`,
  `OpenPantryItemBatch`, `WastePantryItemBatch`, `ConvertExpiredToWaste`) are relative, so entity-id
  idempotency can't dedupe them: each carries a client-minted `input.idempotencyKey` the server records
  in the delta's transaction, and a replay answers the row with `converged: true`.
- **Catalog:** storage locations (create, update, delete, default), stores, usual stores (ordered by
  `useUsualStoreWrites`' `writeOrder`).
- **Home:** create (`writeLocalHome` with a placeholder owner membership, which goes with the layer
  when the server's answer lands), update (`useUpdateHomeFields`), mark default. Delete, leave,
  transfer, invites and membership are online-only.
- **Meal plans:** plan and item create, update, toggle completed, delete, duplicate; meal templates and
  their items. An item create that collides on (mealPlanId, date, mealType, recipeId) returns the
  existing row.
- **Recipes:** create, fork, publish, delete, favorites (add, remove, saved metadata, folders),
  `MarkRecipeAsCooked`, ingredient matching, add-to-list from a recipe (`AddItemsToShoppingListFromRecipe`,
  rows written locally). `UpdateRecipe` from the form is queued but writes nothing local: the detail
  catches up when the replay lands.
- **Receipts:** check-in (`useReceiptCheckIn`), which stamps list lines, moves and intakes locally.
- **Settings, profile, notifications:** field edits through `sendFields`
  (§2), profile, dietary profile and sharing, brand lists, language, onboarding completion, notification
  read/delete, the device time zone. **Offline mode is the one exception to "the cache is the source of
  truth"**: the switch renders from the Zustand store, because that is what `offlineModeLink` reads and
  what is mirrored to MMKV; the server copy is a cross-device mirror, and `useAppSettings` syncs the
  store back off the query, so a refusal reverts the store too.

**Online-only:** auth, sessions and device credentials; account deletion; home and shopping-list
membership (invites, join codes and share codes, collaborators, roles, transfer, leave, delete home);
image uploads and item photos; catalog edits (`CreateItem`, item edit suggestions, `MarkItemForReview`,
primary image); server-computed captures (`CreateReceiptParse`, `CreateRecipeCapture`); recipe reviews;
user reports; `OpenCatalogRecipe`; relinking a pantry row to another item or unit
(`ChangePantryItemItem`, `ChangePantryItemUnit`). Barcode lookup, smart search and recipe discovery are
reads: they degrade to the cache.

Replay is insertion-ordered and dependency-aware, so dependents queued behind a parent-entity create
(items in a new list, meals in a new plan, meals referencing a new recipe, items in a new pantry)
replay only after their parent has landed — the drain reads the parent reference off the input
(`dependencyIdsOf`), so no per-feature special-casing, and an online write naming one queues behind it.

## 11. Server contract (verified)

- **Client-supplied `id`** is accepted on every named client-create input: `CreatePantryItemInput`,
  `BatchAddShoppingListItemInput`, `CreateShoppingListInput`, plus `createHome` /
  `createStorageLocation` / `createMealPlan(Item)` / `createMealTemplate` / `createRecipe` (top-level).
  Format: cuid2 (validator `/^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/` also accepts legacy cuid v1
  and 24-char hex); omitted → Prisma `@default(cuid(2))`. Note `createShoppingList`
  (like `createHome` & co.) answers a duplicate replay with its row and `converged: true`, and adds
  only the lines its first send missed that carry their own id or key.
- **NOT id-capable by design:** `createNotification` (system/cross-user generated).
- **Every canonical mutation is safe to re-send** (§ 5): creates by id, updates by version, deletes
  converge, deltas by `idempotencyKey`. A create that lands on a held row reports `outcome: MERGED`
  and returns the surviving row; later writes naming the minted id are refused.
- **What the server does not give the client** (sous-chef-api, read 2026-10-30): no signal of which of
  this device's writes an answer includes; no version on a list or pantry that moves when its rows are
  added, removed or reordered (only row versions move); events delivered at most once, with no sequence
  (`docs/api/subscriptions.md` § delivery); no changes-since read, and no tombstone for the types it
  hard-deletes (meal plans and their items, template items, reviews, notifications). So the client
  orders answers by timing (§12) and resyncs by refetching what is on screen (§1).

## 12. Edge cases handled

- **Lost-response duplicate** — prevented by the PK (same id → find-by-id → update).
- **Ghost temp rows / temp→real remap** — eliminated (no temp ids exist).
- **Add-then-edit/delete offline** — the real id exists immediately; later ops reference it; the queue
  sequences per-entity by that id.
- **Catalog-merge id divergence** (shopping) — the minted row lives only in its layer, which goes when
  the write is answered; `addRows.commit` lists the row the answer names, and
  `reconcileShoppingAddReplay` moves the writes queued behind it (§4, §7).
- **`totalCount` / stats drift** — a layer's counts leave with it, so a refusal needs no inverse, and an
  answer that states a count settles it with nothing adjusted on top.
- **Rejected-create phantom** — a non-success payload resolves under `errorPolicy: 'all'` without
  throwing; `settleMutation` reads it as `failed` and the layer goes, so a server-refused create never
  lingers (§2, §4).
- **First-page refetch dropping an un-replayed offline create** — the row is in its layer, over the
  page, so the merge takes the page as it stands and the row still shows
  (`src/apollo/pendingWrites/__tests__/pendingCreateSurvivesFirstPage.test.ts`).
- **First-page refetch of a multi-page list** — an entry an insert or reorder pushed past the refreshed
  page stays held until a page that covers it is refreshed (`mergeAuthoritativeFirstPage`,
  `src/apollo/cacheFieldPolicies.ts`), so `fetchMore` resumes without skipping it.
- **App-kill at any moment** — the queue holds every write it was handed (§6), and the layers rebuild
  from it over whatever cache was restored, so a restart can show no stale local value.
- **Collaborator-connection staleness window (accepted)** — the shopping-list subscriptions
  (`useShoppingListSubscriptions.ts`) live-maintain `collaboratorsConnection` membership for the **active
  list only**. Other lists' collaborator/membership connections are not patched from subscription events;
  they self-correct via `cache-and-network` on the next visit. With the persisted MMKV cache this means a
  non-active list can show a briefly stale collaborator set until it is reopened — an expected, accepted
  window, not a bug (it mirrors the `pantryEvents` active-container-only maintenance).
- **A read already in flight when a local-first write is sent** — it would answer with the state from
  before the write, and Apollo shows its watcher nothing newer until it does. `localWritePrecedenceLink`
  (`src/apollo/links/`) answers each such read whose data the write changed from the cache as the write
  passes, so the change shows at once, and its late answer lands under the write's layer, where the fence
  holds the commit until it has (§2). A read the cache can't answer completely is held and re-sent
  instead. A read whose data the write left as it was goes on untouched, so a caller that acts on the
  server's answer (`useVerifyEmail`, an event's read-back) still gets it. A `fetchMore` page
  (`context: { page: true }`, sent only by `src/hooks/utils/fetchPage.ts`)
  passes untouched: the cache could only answer it with the list already shown. Verified:
  `#apollo-a-read-in-flight-hides-a-newer-write-then-overwrites-it`.
- **An answer older than the row the device holds** — answers can arrive out of order, so a read that
  left before another member's change (or before the person's own confirmed change) can land after it.
  `answerOrderingLink` keeps the device's copy of any row whose answer carries a lower `version` than the
  server last gave the device, and lets the rest of the answer land. Every network read selects
  `version`, so every row it judges carries one. A pending write is in its layer, out of the link's
  reach: it judges only the server's rows. Verified:
  `#apollo-a-type-merge-never-sees-a-normalized-rows-fields`.

## 13. Divergences from the original plan (for the record)

- **No `useLocalFirstMutation` primitive** (planned §3.1). Replaced by `pendingWrites.send` over one
  `LocalWrite` per operation (§2), the shared row writers (§4) and `settleMutation`.
- **Identity is client-generated cuid2** (planned §8), not temp-id + reconciliation. This removed the
  largest planned subsystem — the `idMapping` / `resolveIds` / temp-id machinery has been fully deleted
  (no references remain in the codebase).
- **Offline-UX shipped** (planned Phase 4): the offline indicator (`OfflineStatusPill` + `OfflineTransitionAnnouncer`) covers device-offline, API-down, and
  offline mode, with a live pending-changes count (§9).
- **Replay through `Sync*` twins retired** (2026-09): every queued write replays as its canonical
  mutation (§ 5), after the API made each safe to re-send and deprecated the twins.

## 14. Key files

| Area                                               | File                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client id generator                                | `src/utils/generateEntityId.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Queue intercept                                    | `src/apollo/offlineQueue/queueLink.ts`; a write's subject and parents: `queuedSubject.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Queue store (MMKV)                                 | `src/apollo/offlineQueue/queueStore.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Replay                                             | `src/apollo/offlineQueue/queueManager.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Replay preparation + registry                      | `src/apollo/offlineQueue/prepareReplay.ts`, `replayPreparation.ts`, `preparationRegistry.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Feature replay preparers                           | `src/features/pantry/offline/replayPreparers.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Replay payload classification + retry error policy | `src/apollo/offlineQueue/queueErrorPolicy.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Pending-changes count (banner)                     | `src/hooks/offline/usePendingMutationCount.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Queue triggers                                     | `src/hooks/app/useOnlineQueueSync.ts`, `src/hooks/app/useAppStateLifecycle.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Permanent failure (refuse + toast)                 | `src/apollo/offlineQueue/queueFailureHandler.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Pending layers                                     | `src/apollo/pendingWrites/pendingWrites.ts`, `readFence.ts`, `localWriteRegistry.ts`; each feature's `offline/localWrites.ts`; coverage: `__tests__/apollo/localWriteCoverage.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Cache persistence (debounce + `flushPending`)      | `src/apollo/offline/ApolloCachePersistence.ts`, `src/apollo/client.ts` (`flushCachePersistence`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Background flush trigger                           | `src/hooks/app/useAppStateLifecycle.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Shared shopping writers                            | `src/features/shoppingList/cache/items.ts` (`createLocalShoppingListItem`, `addLocalShoppingListItem`), `createShoppingListRow.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Replay reconcilers                                 | `src/apollo/offlineQueue/replayRegistry.ts` (`REPLAY_RECONCILERS`), `queueReplayReconcilers.ts`, each feature's `offline/replayReconcilers.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Resync after foreground / reconnect                | `src/apollo/refetchEvents.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Local row writers (`writeLocalEntity`)             | `src/apollo/utils/writeLocalEntity.ts`; `writeLocalPantryItem`, `writeLocalPantry` (`src/features/pantry/cache/`), `writeLocalHome` (`src/features/home/cache/optimisticHome.ts`), `writeLocalStorageLocation` (`src/features/catalog/hooks/useCreateStorageLocation.ts`), `writeLocalShoppingList` and `addLocalShoppingListItem` (`src/features/shoppingList/cache/`), `writeLocalRecipe` (`src/features/recipes/utils/recipeCacheWriters.ts`), `writeLocalFavorite` (`src/features/recipes/cache/favorites.ts`), `writeLocalMealPlan` (`src/features/mealPlan/cache/`), `writeLocalMealTemplate` and `addTemplateItemToCache` (`src/features/mealPlan/cache/`) |
| Field-edit write                                   | `src/apollo/pendingWrites/entityFields.ts`, `sendFields.ts`; `src/apollo/utils/localFirstFields.ts` (`writeEntityFields`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Write-outcome settling and classification          | `src/apollo/utils/settleMutation.ts` (`settleMutation`, `settledStatus`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Optimistic-entity completeness guard               | `__tests__/apollo/optimisticEntityCompleteness.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Offline indicator                                  | `src/components/molecules/OfflineStatusPill.tsx` (in each screen header), `src/components/atoms/OfflineTransitionAnnouncer.tsx` (mounted in `App.tsx`), both reading `src/hooks/ui/useOfflineStatus.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Query short-circuit when offline                   | `src/apollo/links/offlineModeLink.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| API-reachability circuit breaker                   | `src/apollo/links/apiReachabilityBreaker.ts`, `networkStatusLink.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Unified `isApiUnavailable` predicate               | `src/store/slices/networkSlice.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Primary add hooks                                  | `src/features/shoppingList/hooks/mutations/useAddShoppingItem.ts`, `src/features/pantry/hooks/mutations/useAddToPantry.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
