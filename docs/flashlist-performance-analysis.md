# FlashList performance — current state

How the two FlashList-heavy screens (pantry, shopping list) are fed today, what a
page append costs, where the per-delete round-trips came from, why a hidden tab
re-ran recipe discovery on every pantry write, how to read the dev
instrumentation, and what is still open. Last measured 2026-08-20 (Android
dev build, DevTools attached).

An earlier version of this file was a one-off investigation into "shopping list
gets slow after paginating, then the pantry gets slow too". Its eight issues are
dispositioned at the end; the paths and numbers in it no longer matched the code.

## How the lists are fed

|                         | Pantry (`PantryContent`)                                                                        | Shopping list (`SortableList`)                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Query                   | `GetPantry`, one page, `itemsFirst: 100`                                                        | `GetShoppingListItemsFiltered` × 2 (unpurchased / purchased), `first: 25` (`PAGINATION.ITEMS_PAGE_SIZE`), cursor `fetchMore`        |
| Growth on scroll        | Client-side window: `INITIAL_RENDER_WINDOW` 24, `RENDER_WINDOW_STEP` 24 — a `slice`, no network | Server page per `onEndReached`; each append runs cache merge → `useQuery` broadcast → `useConnectionData` → `wrapItems` → FlashList |
| Row objects             | Apollo nodes passed through; structural sharing keeps unchanged rows `===`                      | `wrapItems` caches rows **per node** (and per tab), so unchanged rows stay `===` across an append                                   |
| Data → FlashList        | Direct. Never through `useDeferredValue` — see `flashlist-layout-index-race.md`                 | Same                                                                                                                                |
| `drawDistance`          | 2× viewport (`DRAW_DISTANCE`)                                                                   | 2× viewport                                                                                                                         |
| `maxItemsInRecyclePool` | 15                                                                                              | 15 (`FLASHLIST_DEFAULTS.fullScreen`)                                                                                                |
| `CellRendererComponent` | `useFlashListPerformance().CellRendererComponent` (tracks mounted cells, see below)             | Same                                                                                                                                |
| Row component           | `PantryItemCard`: swipeable + `useFragment`                                                     | `SwipeableListItem`: swipeable + checkbox + image + `useFragment` + slide animation — heavier to mount                              |

FlashList decides whether a cell re-renders by `item` identity (`ViewHolder`'s memo
is `prevProps.item === nextProps.item`). Both lists now satisfy that, so an append
renders only the cells it adds.

## Cache merge and the persisted connection

`ShoppingList.itemsConnection` (and the pantry's) use `itemsConnectionFieldPolicy()`
with `keyArgs: ['filters']` — `first` is not a key arg. The merge is "authoritative
first page": a response with `hasNextPage: false` replaces the whole connection; one
with `hasNextPage: true` replaces the first page's worth of edges and keeps edges
loaded by later `fetchMore` calls (minus any id the fresh page now carries). An
empty or partial response cannot wipe a populated list unless `totalCount === 0`.
The policy's `read()` drops edges whose node has been evicted, which is what lets a
delete leave the list query complete without touching the edges array.

The cache is persisted to MMKV as-is, so on a cold start the list paints the
**entire** stored connection, and a page-1 refetch does not shrink it. Two
consequences:

- A relaunch does not exercise pagination. To measure a real `after:` fetch, sign
  out and back in (`performLogoutCleanup` runs `client.clearStore()` and clears the
  persisted cache), or use a list never scrolled past page 1 on that device.
- A cold start with a long stored connection pushes every stored node through the
  pipeline at once; a cold cache paints 25 rows and fetches the rest on demand
  (362 ms vs 650–750 ms initial load in the runs below).

## What an append costs (measured)

| Run (2026-08-20)                                               | Result                                                                                                                                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 95 items, page size 20, rows cached per array (before the fix) | Every `fetchMore` rebuilt all row objects → every mounted cell re-rendered. Peak frame gap **1006 ms**; all 4 appends produced long frames.                                                           |
| 43 items, page size 25, rows cached per node, cold cache       | Page-2 `after:` fetch 271 ms on the wire; **0 long frames (>32 ms)** across the 20 s report that contains it; new rows visible within ~7 frames.                                                      |
| 95 → 43 items by deleting 52 rows in 110 s                     | 132 data-reference changes, 27 long frames, 777 ms peak. That is the per-write cost: optimistic write + response + subscription event + **a full page refetch of the list query per delete** (below). |

The pantry's local-window appends never registered a long frame in any run.

## Refetch after every write — root cause and fix

Every pantry delete was followed by a `GetPantry` round-trip (`itemsFirst: 100`),
and shopping-list writes by both `GetShoppingListItemsFiltered` variants. No code
asked for those refetches; Apollo issued them to repair an incomplete cache result,
and the thing that made the result incomplete was the **event subscription
envelope**:

1. `removeItem` evicts the row before the mutation fires (so the removal survives
   an offline queue) and leaves the connection edge in place; the `read()` policy
   hides it while the reference dangles.
2. The server pushes `PantryEvents` / `MyShoppingListsEvents` for the delete
   before the mutation resolves. The envelope selects `node { __typename id }`.
3. A cacheable subscription result is normalised: the evicted entity is re-created
   as a bare `{ id }`. The edge stops dangling, the node now lacks every other
   field the list query selects, and the watched result is incomplete. Apollo's
   `scheduleNotify` → `reobserveCacheFirst` finds the cache cannot satisfy the
   query and fetches it — one full page per delete.
4. The pantry handler saw `isPendingDelete` and returned early without re-evicting,
   so nothing healed the cache first. The shopping-list handler re-evicts its own
   deletes synchronously inside `onData`, and only avoided the refetch because
   Apollo defers the notify by a tick — a timing dependency, not a guarantee.

**Fix:** `fetchPolicy: 'no-cache'` on both `useSubscription` calls
(`usePantrySubscriptions.ts`, `useShoppingListSubscriptions.ts`). Every handler
already reads entities back with a query (`PantryItemForEvent`, the shopping-list
read-backs), so nothing needed the envelope in the cache.
`__tests__/apollo/subscriptionEnvelopeWrite.test.ts` performs the write against the
real cache and asserts the incompleteness; the hook suites assert the envelope no
longer reaches the cache.

**Validated on device (2026-08-20, Android dev build):** three pantry deletes and
three shopping-list deletes produced zero list-query refetches — every
`DeletePantryItem` / `RemoveItemFromShoppingList` now stands alone in the
`consoleLink` log, where each used to be followed by `GetPantry` or both
`GetShoppingListItemsFiltered` variants. `Data Ref Changes` per pantry delete fell
from 3 to 2; no new long frames were recorded during the deletes; the subscription
events still arrive (they log, they are just not written to the cache).

**Rule:** an event subscription whose `node` is an envelope + id must run with
`fetchPolicy: 'no-cache'`. `HomeEvents` and `MealPlanEvents` have the same shape
and `CacheStrategy.NONE`, and are the obvious next candidates if their domains show
a refetch per write; `UserEvents` selects real fields on `User` and must be checked
before changing. `NotificationEvents` selects the node's fields deliberately.

## Hidden Recipes tab re-ran discovery on every pantry write — root cause and fix

Visible in the delete logs as `RecipeMain` re-rendering and `ItemList.items`
changing after every `DeletePantryItem` while the **Pantry** tab was focused.
`HomeTabs` runs `inactiveBehavior: 'none'`, so the Recipes tab stays mounted, and
`useRecipeDiscovery` held a live `GetPantry` watcher through
`usePantryManagement`. Each pantry write therefore:

1. re-rendered the hidden `RecipeMain`;
2. changed the discovery fetch key (`fetch|${pantryItems.length}`), re-running the
   discovery effect; and
3. because the discovery cache is keyed by the ingredient list, which the delete
   had just changed, **called the recipe API again** (`searchRecipesByIngredients`)
   from a hidden tab — the `ItemList.items` change was that response landing.

**Fix:** `usePantryQuery` / `usePantryManagement` take a `PantryQueryOptions`
argument (`skip`, `fetchPolicy`). `useRecipeDiscovery` tracks focus with
`useFocusEffect` (the repo's preference over `useIsFocused`) and passes
`{ skip: !isFocused, fetchPolicy: 'cache-first' }`: while blurred there is no
watcher, and `usePreservedConnection` holds the last result so nothing downstream
moves; on focus it resumes from the cache the Pantry tab keeps current — no
round-trip, because Apollo resets a re-enabled query to its initial policy and
`cache-first` makes that a cache read — and discovery refreshes once if the pantry
changed meanwhile. Starts focused because tabs are lazy (the screen mounts on its
first focus); a blurred first render would fire a throwaway random-mode fetch.

**Rule:** a screen that reads another tab's query as a secondary consumer must
stand its watcher down while blurred. `inactiveBehavior: 'none'` keeps the tree
mounted; it does not make every watcher in it free.

Tests: `useRecipeDiscovery.test.ts` ("focus gate on the pantry watch") asserts the
skip flag follows focus and that a blur/focus cycle costs no request;
`usePantryQuery.test.ts` ("consumer options") covers `skip` and lifting it.

## Reading the instrumentation

- **`useCommitTracking`** (formerly `useRenderTime`) (`render discarded: exceeded
1000ms cap`) measures wall time **between commits**. It includes network
  round-trips and idle time; it is not render cost. The "discarded" lines are noise.
- **Blank cells are counted from mounted cells** (since 2026-08-20).
  `useFlashListPerformance` returns a `CellRendererComponent`; FlashList wraps every
  cell in it and passes `index`, so the hook knows exactly which indices have a
  committed cell. A row is blank when its index is inside
  `computeVisibleIndices()` and no cell is mounted for it. The check runs after
  every commit that mounts, moves or unmounts a cell and on every viewability
  change. Logs print `mounted=N/M`; `flashlist_blank_cells_total` counts blank
  _episodes_ (a transition into blank), not evaluations.
  **Since 2026-08-26 the per-cell renderer and blank check are per-SESSION
  sampled** (`flashListInstrumentationSampleRate`: dev 1.0, release 0.05) —
  the cell wrapper is a Reanimated `Animated.View` + layout effect around
  every cell, measured at ~30–60 ms of the SM-S908U1's ~320 ms first-layout
  window (`docs/audits/perf-blank-window-2026-08-26.md`). An unsampled
  session's `CellRendererComponent` is `undefined` (FlashList's plain View)
  and emits no blank/coverage series; `flashlist_initial_load_ms`, session
  duration and the `hasContentLayout` latch are never sampled out.
- **The initial-mount blank window is a separate mechanism from scroll
  blanks, and it is fixed at the presentation layer** — FlashList v2 holds
  every cell at `opacity: 0` until its progressive first layout commits, so
  skeletons must release on the hook's `hasContentLayout` latch
  (`onCommitLayoutEffect`), never on data-loading flags. Mechanism, on-device
  numbers (300–342 ms header-only frame, eliminated), and the starvation trap
  for covers gated on measured state:
  `docs/audits/perf-blank-window-2026-08-26.md` +
  `docs/verified-library-behaviour.md#flashlist-v2-first-layout-opacity-gate`.
  **Reports from before that change are not comparable.** The old detector compared
  the visible range against `onViewableItemsChanged`, and FlashList's viewability is
  geometric and gated by a 250 ms `minimumViewTime` (`ViewabilityHelper.js:43`), so
  "blank" meant "entered the viewport in the last 250 ms" — a scroll-velocity meter.
  That is why every older session report shows 80–96% "transient" blanks, and why
  the `DRAW_DISTANCE` tuning note ("1.5× → 12.2% sustained blanks") should be
  re-measured before anyone acts on it.
- **Always trustworthy:** `Long Frames (>32ms gap)`, `Peak Frame Gap`,
  `Data Ref Changes` (and whether they correlate with blanks), and the `consoleLink`
  query/mutation timings. Reports print every 10 s while a list is active; the
  window that contains an append should add at most one long frame, and its size is
  the append's cost.
- **`flashlist_initial_load_ms` is device-sensitive, and every number in this doc
  is from an emulator.** Same screen (`PantryContent`), same release variant:
  **40 ms** on the Pixel_9a emulator, **301-934 ms** on an SM-S908U1 (2026-08-25).
  The reading that "the list is not the bottleneck" holds for the emulator and
  does not transfer. Re-measure on hardware before drawing a conclusion from any
  figure below.

## Disposition of the earlier investigation's issues

| #   | Then                                                                        | Now                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Append-only merge never prunes; cache grows; cross-screen slowdown          | Merge is authoritative-first-page with a resilience guard (above). The surviving tail is the offline-first cold-start data, by design; deletes remove edges via `cache.modify`. **Closed (by design).** |
| 2   | `extractItems` rebuilt arrays every render; cascade through the pipeline    | `useConnectionData` → `usePreservedConnection` → `extractNodes` inside compiled hooks; the `SortableList.items` tracker shows one reference change per page. **Closed.**                                |
| 3   | Cache persistence serialises the whole cache on screen transition           | Pause/resume lives in `useTabScreenLifecycle`; the save now compares top-level keys by identity before any `JSON.stringify`. **Mitigated; not re-measured.**                                            |
| 4   | `resortEdges` sorts every `itemsConnection` variant on sort-changing events | Still runs once per `storeFieldName` variant (`useShoppingListSubscriptions.ts`). Not implicated in any measurement this round. **Open, low.**                                                          |
| 5   | No `maxItemsInRecyclePool` on either list                                   | Both lists use `FLASHLIST_DEFAULTS.fullScreen.maxItemsInRecyclePool` (15). **Closed.**                                                                                                                  |
| 6   | `useDeferredValue` always on for the shopping list                          | Removed from all three lists — it opened the `not enough layouts` crash (`flashlist-layout-index-race.md`); the throughput it hid was issue 2 + per-array rows, fixed instead. **Closed.**              |
| 7   | Apollo watchers keep running on hidden tabs (`freezeOnBlur`)                | `HomeTabs` deliberately uses `inactiveBehavior: 'none'` — the background work is the accepted price of avoiding multi-second resumes (CLAUDE.md). **Closed (by design).**                               |
| 8   | Dead `ShoppingList.items` merge policy                                      | Removed. **Closed.**                                                                                                                                                                                    |

## Still open

- `SwipeableListItem` mount cost, if a release-build profile ever shows appends heavy
  again — the rows are the structural difference from the pantry.
- `HomeEvents` / `MealPlanEvents` `no-cache` (see the rule above) — no symptom
  measured there yet.
- Issues 3 and 4 above: mitigated / low, not re-measured.
