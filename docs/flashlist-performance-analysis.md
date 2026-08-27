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
| Growth on scroll        | None — `sortedItems` goes to FlashList whole. The old client render window was a SECOND virtualization on top of FlashList's own; growing it re-rendered every mounted cell | Server page per `onEndReached`; each append runs cache merge → `useQuery` broadcast → `useConnectionData` → `wrapItems` → FlashList |
| Row objects             | Apollo nodes passed through; structural sharing keeps unchanged rows `===`                      | `wrapItems` caches rows **per node** (and per tab), so unchanged rows stay `===` across an append                                   |
| Data → FlashList        | Direct. Never through `useDeferredValue` — see `flashlist-layout-index-race.md`                 | Same                                                                                                                                |
| `drawDistance`          | **0.5× viewport** (`DRAW_DISTANCE`) — the ONLY bound on mounted cells now                       | 2× viewport                                                                                                                         |
| `maxItemsInRecyclePool` | 15                                                                                              | 15 (`FLASHLIST_DEFAULTS.fullScreen`)                                                                                                |
| `CellRendererComponent` | `useFlashListPerformance().CellRendererComponent` (tracks mounted cells, see below)             | Same                                                                                                                                |
| Row component           | `PantryItemCard`: swipeable + `useFragment`                                                     | `SwipeableListItem`: swipeable + checkbox + image + `useFragment` + slide animation — heavier to mount                              |

FlashList decides whether a cell re-renders by `item` identity (`ViewHolder`'s memo
is `prevProps.item === nextProps.item`) — but it re-renders EVERY mounted cell when
its own `data`, `ListFooterComponent` or `onEndReached` prop changes identity, and it
names them in its re-render reason. That, not row identity, was the pantry's cost:
the client render window changed the data array AND `handleEndReached`'s identity on
every growth. Both are gone; `onEndReached` is now ref-stable.

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
  window on a release build. An unsampled
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
- **`flashlist_initial_load_ms` is device-sensitive; the figures in the sections
  above are from an emulator.** Same screen (`PantryContent`), same release
  variant: **40 ms** on the Pixel_9a emulator, **301-934 ms** on an SM-S908U1.
  Re-measure on hardware before drawing a conclusion from any emulator figure.
  Emulator FRAME stats are worse than useless: its software GPU alone takes
  16-20 ms per frame, which swamps anything the app does.

## Two different symptoms, two different instruments

Scroll complaints split into two problems that need different tools. Getting
this wrong costs a wasted refactor.

**Hitching** — occasional long frames. Caused by something re-rendering the whole
list. Instrument: the React profiler (commit count / duration), or
`flashlist_data_reference_changes`, which already exists and is the cheapest
early warning for this whole class.

**A frame-rate ceiling** — every frame uniformly over budget, no hitches.
Instrument: `adb shell dumpsys gfxinfo <pkg> framestats` on a real device, then
decompose per phase. React commit counts do NOT track this and will mislead you.

Measured on an SM-S908U1 (96 Hz panel → **10.4 ms budget**), localRelease, 92
pantry items, thermal 0, warmed, 119 frames:

| phase | median | p90 |
| --- | --- | --- |
| input + animation + layout (UI thread) | **1.5 ms** | 5.2 |
| ↳ `PerformTraversals` | 0.1 ms | 0.4 |
| sync UI→Render | 3.5 ms | 5.4 |
| RenderThread issue draw | 4.9 ms | 7.8 |
| swap→completed (GPU present) | **6.7 ms** | 8.1 |
| TOTAL | 17.2 ms | 21.5 |

**UI-thread work is 1.5 ms of a 17 ms frame.** Per-row view count and Yoga layout
live there, so cutting views per row cannot move this number — a hypothesis that
looked obvious and measured out false. The frame is spent on the GPU.

The card shadow (`theme.shadows.card`, two layers, 20 px blur) is the largest
single GPU cost, dose-response confirmed: two-layer **17.2 ms** → single-layer
8 px **15.5 ms** → none **14.7 ms**, with the delta landing almost entirely in
`swap→completed`. **Deliberately not changed**: `shadows.card` feeds 8 call sites
(every card surface), and even removing it entirely leaves 14.7 ms — still 41%
over budget. The lever cannot reach 96 Hz, so it does not justify an app-wide
visual change.

Net: the pantry's hitching is fixed; its frame-rate ceiling (~58 fps on a 96 Hz
panel) is GPU-bound and unsolved.

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

## Instrumentation coverage — a scoped decision, not a backlog

`useFlashListPerformance` is on the five list surfaces that matter plus the two
full screens that were previously invisible to every metric:
`PantryContent`, `SortableList`, `ItemList`, `MyRecipes`, `SavedRecipes`,
`FilteredPantryItems`, `PurchaseHistoryScreen`.

The eight bottom-sheet lists (`BottomSheetAutocompleteInput`, `FolderPicker`,
`TagPicker`, `AddMealSheet`, `TemplateBrowserSheet`, `IngredientMatchingSheet`,
`ShoppingListPickerSheet`, `IngredientSelectorSheet`) are deliberately NOT
instrumented. They show a handful of rows for a few seconds, so
`flashlist_initial_load_ms` there is noise — while `CellRendererComponent` wraps
every cell in an `Animated.View` + layout effect, which is real mount cost in
the sampled sessions. Instrumenting them would cost more than it tells you.

## Still open

- **BUG — ROOT-CAUSED: a paginated `itemsConnection` can report completeness
  while holding a subset, and client-side filtering over it silently lies.**
  Probed on device (139-item pantry, one item expiring in 2 days):
  `allItems.length: 101`, `totalCount: 139`, **`hasMore: false`**,
  `withExpiry: 0`. `MAX_WINDOW_EDGES = 100` (`cache.ts`) caps the cached edges,
  but `pageInfo.hasNextPage` reflects the LAST FETCHED PAGE, so the connection
  ends up claiming there is nothing more while 38 items — including the only one
  carrying `expiresAt` — are absent. `FilteredPantryItems` then filters an
  incomplete set and correctly finds nothing, and its "load every page" effect
  cannot recover because it is gated on `hasMore`.

  Broken invariant: **`edges.length < totalCount` while `hasNextPage === false`.**

  **Do NOT "fix" this by deriving `hasMore` from `totalCount`** (e.g.
  `hasNextPage || itemCount < totalCount` in `usePagination`): each fetched page
  is capped straight back to 100 edges, so `hasMore` would never go false and the
  screen would fetch forever.

  **FIXED for the expiry modes:** `FilteredPantryItems` now narrows server-side
  via `ModeConfig.serverFilters` (`{ expiringSoon: true }` for both `expiring`
  and `expired` — the API filter has no lower bound, so it returns the superset
  and the client predicate splits it). A non-null filter also re-keys the cache
  entry, so those screens get their own small connection instead of sharing the
  capped one. Verified against the API: `expiringSoon: true` on a 139-item
  pantry returns `totalCount: 1, hasNextPage: false`.

  **`lowStock` is FIXED too** — sous-chef-api#293 landed, so all three modes now
  narrow server-side. The filter is quantity <= 0 (or <= minQuantity when set):
  exactly what `PantryStats.lowStockCount` counts and `PantryItem.isLowStock`
  reports, so a filtered page and the badge cannot disagree. It is NOT the
  `lowStockAlert` opt-in — that records whether the user wants notifying, and
  the suggestion and shopping-list paths gate on it because they answer a
  different question. `ModeConfig.serverFilters` is non-nullable so a new mode
  cannot ship without declaring narrowing.

  We deliberately do not pass `expirationDays`. It defaults to 7 and
  `PantryStats.expiringCount` is ALWAYS a 7-day window regardless of it, so
  filter and badge line up arithmetically only at the default; widening the
  horizon would list items the badge never counted.

  **The MAIN pantry list is NOT affected** — falsified on device, not assumed.
  `usePantryScreen` flips to SERVER mode when `stats.totalItems > PAGE_SIZE.MAX`
  (`usePantryScreen.ts:133`), sending filter/sort/search to the server so they
  stay correct beyond the window. Verified on a seeded 114-item pantry: search
  finds an item far outside the newest-first window, and a full scroll to the
  bottom and back leaves the head of the list intact despite the merge policy
  evicting oldest edges. The switch is gated on `isOnline`, so offline a >100
  pantry filters over the cached window — a physical limit, not a defect.

  Note the screen's tests mock BOTH `useCurrentPantry` and `usePantryManagement`,
  so they verify the filter against injected data and structurally cannot catch
  this.

- The pantry's frame-rate ceiling: ~4 ms must come out of RenderThread draw +
  GPU present (image decode/upload, rounded-corner clipping, overdraw) to reach
  10.4 ms. Nothing cheap found. Row REACT cost is not the lever —
  `SlideAnimatedWrapper` measures 0.63 ms of render time per recycled row, and
  the swipe action trays are already lazy.
- `HomeEvents` / `MealPlanEvents` `no-cache` (see the rule above) — no symptom
  measured there yet.
- Issues 3 and 4 above: mitigated / low, not re-measured.
