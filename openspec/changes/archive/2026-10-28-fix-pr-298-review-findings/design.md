# Design

## Context

See proposal.md for the findings and why each blocks the merge to `main`. The
fixes are client-only and land on `dev` ahead of PR 298. Constraints that shape
them:

- The API repo is read-only, so every fix stands on a behaviour the API already
  implements. Each decision below names it.
- No new refs and no timers in app code. State lives in `useState` or the
  store, and work runs from events.
- Render-time cache reads go through `useFragment` / `useFragmentList`, never
  `readFragment` (CLAUDE.md, `renderTimeReadFragment`).
- A switch over a generated enum lists every member and keeps a `default` for
  values the build predates (`docs/architecture.md` § Type-level gates).
- `useProductOrigin.ts` was edited by a parallel session during verification.
  Re-read every file before editing it.

## Goals / Non-Goals

**Goals:**

- Fix each confirmed finding where its cause lives: the helper that returns the
  wrong id, the reader that picks from the wrong set, the switch with no
  default. Never at one call site.
- Give each fix a test that fails on `dev` today.

**Non-Goals:**

- Finding 10 (repeated countries): the API already dedupes by country.
- Client-side detection of half-open sockets in the foreground. That needs a
  pong timeout, which is a timer. Finding 1 only closes the gap this PR opened.
- Asking the API for an ingredient id on `SkippedRecipeIngredient`. Pairing by
  stack name and units is exact enough for the toast. An API change can come
  later.

## Decisions

### D1 · Foreground resync: skip only inside the server's liveness window (finding 1)

`appForeground` emits unless the channel reads open AND the absence is shorter
than `SERVER_LIVENESS_WINDOW_MS = 2 × 30_000`. That mirrors
`WS_PING_INTERVAL_MS` (default 30 s) in `sous-chef-api`
`packages/core/src/context/ws.ts`: the server terminates a socket after one
unanswered ping and the next tick. Inside the window it still holds the
subscriptions, so events sent while the device was away wait in the socket and
arrive on resume. Past the window it may have dropped them, so the device
resyncs. `LONG_ABSENCE_MS` (15 min, for answers that move with the clock) is
removed: a 60 s window covers it.

- *Always resync on return:* simplest, but it loses the PR's saving on quick
  app switches.
- *Client pong timeout:* closes the foreground gap too, but it is a timer.
  Rejected.

### D2 · The create returns the row the line landed on (finding 2)

`createShoppingListRow` returns as `id` the row its line landed on: the
server's `results[0].item.id` when applied, else the minted id (queued, or no
item in the answer). The API documents the merge ("an entry for an item the
list already has lands on that line"), and the reconcile already evicts the
minted row. Only the barcode scan reads `id` today (checked across all six
callers), so the change is safe at the source. `ShoppingRowCreated.id`'s doc
comment changes with it.

- *Re-match the line in `SearchResults` after the add:* rejected. It patches
  one caller and leaves a helper that returns a dead id.

### D3 · Store mode claims the purchase rather than flipping it (finding 3)

`useToggleShoppingItem` gains `claimPurchased(lineId, bought)`. It writes
`isPurchased: true` and moves the line to the purchased connection only when the
cache shows it open. It always sends `purchaseTracking: { isPurchased: true }`.
The API converges a bare claim of the state a line already holds with no write
(`ShoppingListItemCRUDService.update`: "a replayed tick converges"). Its revert
and refetch on refusal match `toggleItem`'s. `useStoreModeCart.tick` calls
`claimPurchased` when there is no price. With a price it keeps
`recordPurchase`, which already sends `true`.

`ActionButtons.alternateAction` gains `disabled`, and `SearchResults` passes
`disabled: isLoading`. With amounts, a claim on an already-purchased line goes
through the API's versioned edit path, so two priced or mixed adds must never
race. The disabled action prevents that.

- *A `to` argument on `toggleItem`:* changes every list-screen call site for a
  store-mode need. Rejected.
- *Check the snapshot in `useStoreModeCart` before toggling:* still a read and
  then a flip, so a race can still win. Rejected.

### D4 · Brand-list matches are filtered by the lists the user holds (finding 4)

`useProductBrandListings` takes `lists: readonly BrandListView[] | null`, which
is null until `useBrandLists().loaded`. With lists loaded, a `listMatches`
entry is kept only when its list is in `lists`, switched on, and still holds the
match's `entry.id`. The existing second loop still adds matches made on this
device before the server re-reads. Before the lists load, `listMatches` shows
as returned. `deleteList` and `removeBrand` stay as they are: the card is
derived from the one source those writes already update.

- *Have the writes rewrite `Item.listMatches` across cached items:* a
  `cache.modify` over every cached `Item` keeps a second copy of the truth.
  Rejected.

### D5 · An answer shown beside an error is `stale` (finding 5)

`householdCheckOf` returns `stale` when `answered && (offline || failed)`, and
both hooks get it for free. A network failure never reaches it: Apollo 4.2.12
answers one with `data: undefined` (`QueryManager`'s `catchError`). The product
hook's cache-first read never asks the network over a cached answer, since
`Query.item` reads by id. What does reach it is an answer whose response
carries GraphQL errors beside its data, which `errorPolicy: 'all'` keeps. The
alerts are then shown under the existing `dietaryAlerts.stale` caption, never
hidden and never passed off as a clean check. The doc comment on
`HouseholdCheck` is reworded to match.

### D6 · Each skip claims one cook entry (finding 6)

Each entry carries `stackUnitId` beside `stackName`. Each skip claims the first
entry not yet claimed whose `stackName`, `actualUnitId` (the skip's
`fromUnitId`) and `stackUnitId` (its `toUnitId`) all match. Failing that, it
claims the first unclaimed entry with that `stackName`. Failing that, it counts
under its own name. `notDeducted` counts the distinct `recipeIngredientId`s
claimed, plus the unclaimed skips, so a substitute's parts still count once.
`SkippedRecipeIngredient` carries no ingredient id, and the API fills `itemName`
from the stack (`PantryDeductionService`, `skipped.push`), so this is the
closest pairing the contract allows.

### D7 · Starting lines are written guarded and withdrawn on refusal (finding 7)

`lines.write(id)` gets its own `try`/`catch` that reports and continues, like
the list write beside it. The create still sends its lines, and the reconcile
writes the server's rows. On refusal, `onFailed` calls
`withdrawShoppingListItems(cache, id, items.map(line => line.id))` before
`revertOptimisticShoppingList`. That covers the unsent lines too, since
`lines.write` caches all of them.

### D8 · A refused recount undoes only its own write, and only if it is still there (finding 8)

The hook keeps the snapshot only when it writes ahead. On refusal it restores
only then, and only while the cached stack still reads the `quantity`,
`version` and `updatedAt` of its own write. Otherwise newer server data has
arrived and stays. The snapshot's fragment covers every field `writeHeldStock`
writes (`heldQuantity`, `displayAmount`), so restoring it is the whole undo.

- *Refetch on refusal:* costs a round trip and still races a subscription
  read-back. Rejected.

### D9 · A refused sharing toggle re-reads the membership (finding 9)

`onFailed` calls the `DietarySharingHomes` query's `refetch()` in place of
`writeShared(membershipId, !shared)`. A refusal is a server answer, so the
server is reachable and holds the truth. `useToggleShoppingItem` already handles
a refused tick this way.

- *Track the latest toggle per membership:* needs module or ref state the user
  has ruled out, and still guesses. Rejected.

### D10 · A live held-stack hook with one chooser (findings 11 and 14)

New `src/features/pantry/hooks/useHeldStacks.ts` (top-level hooks are the
pantry's public API). It returns, live:

1. **Candidates.** `useFragment` reads the hook's own `useHeldStacks_pantry`
   fragment over the pantry's unfiltered `itemsConnection` (client mode, all four
   arguments undefined, the key `GetPantry` writes) and keeps the nodes of
   `itemId`. If that read is incomplete (server mode, which `usePantryScreen`
   enters only online, or a pantry not cached), the colocated query
   `HeldStacks($pantryId, $itemId, $stacksFirst)` runs `cache-first` over
   `Pantry.itemsConnection(filters: { itemId })`, with `$stacksFirst` set to 20.
   Its answer is used only when its variables name this pantry and item, since
   `skipToken` keeps the last run's data.
2. **Stacks.** `useFragmentList` over the candidate ids with the hook's own
   `useHeldStacks_pantryItem` fragment, which carries `createdAt` and the held
   amount `formatHeldAmount` reads. Incomplete entries, and rows of another item
   listed under the filtered connection, are dropped for both choosers.
3. **Two choices from the same stacks.** `seedUnit` picks a counted stack
   first, else the first (the `readHeldStackUnit` rule). It seeds the amount
   form. `joinedIn(unitId)` picks as the API joins a forced add: the oldest
   stack in `unitId`, else the oldest held, by `createdAt`. `SearchResults`
   passes it the form's current unit (`useWatch` on `unitId`), so the
   joined-stack summary follows a unit the user changes.
4. **Unread stacks count as none.** While neither source has answered, the card
   says the add creates a stack and offers its consume unit, as it did before.
   The API ignores a consume unit on a joined stack ("not applied to a held
   stack a forced add joins"), so offering it costs nothing, while hiding it
   would drop a real new stack's setting.

`SearchResults` drops both `useState(() => …Of(item.id))` reads and calls the
hook. The amount form keeps its own state, and the existing effect fills an
empty unit field once `seedUnit` appears. A unit the user typed is never
overwritten. `usePantryIntake` drops `heldStackOf` and `useAddScannedItem`
drops `heldUnitOf`/`heldStackOf` (hook members must be read). `readHeldStack`
and its `readHeldStack_pantryItem` fragment are gone. `readHeldStackUnit` stays
for `useReceiptReview.addChosen`, a handler read.

- *Lookup carries the stacks:* every local-first pantry writer would have to
  keep that filtered connection complete. Not chosen.
- *Read once, compliantly:* keeps the staleness. Not chosen.

### D11 · Cache-first reads on the scan card (finding 12)

`useBrandLists` takes an optional `{ fetchPolicy }`, which the scan card passes
as `cache-first`. The profile screens keep the default. `useStorePriceMemory`'s
`StorePriceComparison` read sets `cache-first`, as its other two reads already
do. The resync paths still refresh both while they are active.

### D12 · A `default` for values the build predates (finding 13)

`perBasis` gets `default: return price` (the bare price). `sourceName` gets
`default: return null`. Every member stays listed, so
`switch-exhaustiveness-check` still flags a newly generated member, as it just
did for `ALDI`/`GIANT_EAGLE`.

### D13 · Comment cleanup (finding 15)

Delete the price-tracking comment from `useListSettings.ts`.

## Risks / Trade-offs

- [The 60 s window mirrors an API env default; a deployment that raises
  `WS_PING_INTERVAL_MS` makes the client skip some resyncs it needs.] → No
  deployment overrides it today: none of `.env.production`, `.env.staging`,
  `.env` or the `docker-stack*.yml` files sets it, so the
  `optionalNumber(30000)` default in `config/sections/publicApi.ts` applies. The
  constant's comment names that source.
- [`HeldStacks` adds a request per scan in server mode.] → Server mode is online
  only, and the query is `cache-first` per product. Client mode, the common
  case, sends nothing.
- [Returning the landed row's id changes `createShoppingListRow` for every
  caller.] → Only the scan reads `id` (checked). A test pins the merged and the
  queued outcomes.
- [A refetch after a refused sharing toggle can itself fail.] → The refusal
  toast has already shown, and the next resync corrects the switch.
- [Pairing skips by name and units can still pick the wrong entry between two
  entries with the same stack name and units.] → The counts stay right, since
  each skip claims one entry. Only which ingredient is blamed can differ, and
  the toast never names one.

## Migration Plan

Client-only, with no schema change and no persisted-data change. One commit per
finding (or per decision for D10) on `dev`, then the full gate list from
CLAUDE.md before pushing PR 298's update. D10 adds a `.graphql` document, so
it runs `npm run codegen` and then diffs `src/graphql/generated/schema.graphql`
(expected: no change). Rollback is a revert of the individual commit.
