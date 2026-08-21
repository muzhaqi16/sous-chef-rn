# FlashList: "index out of bounds, not enough layouts" on rapid deletes

**Status: resolved — does not occur in this app.** Fixed on the client on 2026-08-20 by
never handing FlashList `data` a value produced by `useDeferredValue`, and validated on
device the same day (see "Validation"). No library patch is carried or needed: the
unguarded accessor inside `@shopify/flash-list@2.3.2` is unreachable from our code once
the list's data updates render synchronously.

Upstream still has the underlying gap — [#2291](https://github.com/Shopify/flash-list/issues/2291)
(P1, open since May 2026; PR #2293 proposes a guard, unmerged) and
[#2440](https://github.com/Shopify/flash-list/issues/2440). That is context for anyone who
meets the stack below after a future change, not an open item for us.

**Was seen on:** Pantry (`PantryContent`), Android, swipe-delete. Reached production as a
fatal before the fix.

## Symptom (historical)

```
Error: index out of bounds, not enough layouts
    at getLayout            (LayoutManager.js:153)
    at getLayout            (RecyclerViewManager.js:94)
    at anonymous            (RecyclerView.js:244)     <- validateItemSize
    at anonymous            (ViewHolder.js:26)        <- onLayout
    at executeDispatch / batchedUpdates$1 / dispatchEvent
```

Reproduced by deleting several rows in quick succession, especially near the end of the
list. It reached `ErrorUtils.reportFatalError` with `isFatal: true`, so
`setupGlobalErrorHandler` (`src/utils/globalErrorHandler.ts`) recorded it as
`app_unhandled_exceptions_total{fatal="true"}` and release builds crashed. An error
boundary could not catch it: the throw happens inside an event handler, not during
render.

If this stack ever reappears, a FlashList `data` prop has been put behind a transition
again — check for `useDeferredValue` / `startTransition` on the data path, or a list
moved under a navigator with `inactiveBehavior: 'pause'`. That is the whole search
space; see "Mechanism".

## Mechanism

> An earlier version of this document blamed `LayoutManager.deleteLayout()` splicing
> "during the delete commit" and concluded nothing app-side was involved. Both claims
> were wrong: `deleteLayout` is never called anywhere in the shipped build, the shrink
> happens during **render**, and the app's `useDeferredValue` is what made that render
> interruptible. Re-derived 2026-08-20 against the installed `dist/`.

Three facts combine:

1. **FlashList shrinks its layout table while rendering.**
   `dist/recyclerview/hooks/useRecyclerViewManager.js:16-17` runs
   `recyclerViewManager.processDataUpdate()` inside a `useMemo` keyed on `data` — a
   side effect in the render phase. It calls `modifyChildrenLayout([], data.length)`
   → `LayoutManager.modifyLayout()` (`LayoutManager.js:112-120`), which does
   `this.layouts.length = totalItemCount`. From that moment, the table has no row for
   the old last index. (`modifyLayout` even filters stale indices out of its _own_
   input — upstream knows stale cells exist; it just did not guard the next site.)

2. **Cells learn their new index only at commit.** `ViewHolderCollection` renders each
   `ViewHolder` with `index` from the render stack, and `ViewHolder.onLayout`
   (`ViewHolder.js:25-27`) calls `onSizeChanged(index, …)` with the index it was
   committed with. `onSizeChanged` is `validateItemSize` (`RecyclerView.js:244`),
   which calls the **throwing** accessor `recyclerViewManager.getLayout(index)`
   rather than the library's own guarded `tryGetLayout(index)`, which it uses 130
   lines earlier for the same lookup.

3. **Only a transition render can be interrupted between (1) and (2).** A normal React
   render and its commit run as one synchronous task; no native event can be
   dispatched in between, so for ordinary state updates the window has zero width.
   The installed renderer time-slices **only transition lanes**:
   `node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:13081-13087`
   sends any lane in `lanes & 127` (sync, input-continuous, default, gesture) to
   `renderRootSync`; only `useDeferredValue` / `startTransition` / Offscreen work goes
   through `renderRootConcurrent` and yields to the scheduler.

`PantryContent` fed FlashList through `useDeferredValue(sortedItems)` (and `ItemList` /
`useShoppingListScreen` did the same). A delete therefore rendered as a transition:
React ran `RecyclerView` (table truncated), yielded, and a native `onLayout` — queued
by the _previous_ delete repositioning the cells below it — was dispatched to a cell
still holding the old last index. That is the `dispatchEvent → batchedUpdates →
executeDispatch` tail in the stack, and why the repro was _rapid_ deletes.

Apollo's `useQuery` updates arrive through `useSyncExternalStore`, which React always
renders synchronously (even inside `startTransition`), so removing the deferral is
sufficient for data that comes from the cache. That is why the client-side change is
the fix rather than a mitigation: with no transition on the data path, the window in
which the library's unguarded lookup can run has zero width.

### Why it looked like a rare library bug

Most FlashList users pass `data` straight from state, which renders synchronously, so
they never open the window. It needs `data` behind a transition **and** an `onLayout`
in flight **and** a shrink — which is why upstream has only three reports and the
earlier investigation here could not find an app-side cause by reading the delete
path alone.

## The fix — FlashList `data` never goes through `useDeferredValue`

- `src/features/pantry/components/PantryContent.tsx` — `sortedItems` is windowed and
  handed to FlashList directly. The `renderLag` skeleton bridge (which only existed to
  cover the deferred value's one-render lag) and its test are gone.
- `src/components/organisms/ItemList.tsx` — `items` passed directly; the data-reference
  tracker label is now `ItemList.items`.
- `src/features/shoppingList/hooks/useShoppingListScreen.ts` — the transform output is
  returned as-is. `isLoadingInitial` keeps its `hasRawData` term (its comment explains
  what it still covers); that is a separate clean-up.
- `DRAW_DISTANCE`'s comment in `pantryDisplay/constants.ts` no longer cites the deferral
  as the reason the 2× buffer is affordable.

Each site carries a comment with the mechanism so the deferral is not re-added for
throughput.

**Rule:** do not hand a FlashList `data` prop a value produced by `useDeferredValue`
or updated inside `startTransition`, and do not move these lists under a navigator
with `inactiveBehavior: 'pause'` — a resumed `Activity` subtree re-renders at the
Offscreen lane, which is also interruptible. They sit under `HomeTabs`
(`inactiveBehavior: 'none'`) today.

This also unblocks the pantry row-reflow animation (rows sliding up to fill a
deleted row's gap), which was attempted twice and reverted because the delete
landed in a deferred second commit that `prepareForLayoutAnimationRender()` had
not armed. With the delete now committing synchronously, that blocker is gone.

## Validation (2026-08-20, Android dev build, DevTools attached)

The deferral had been added for throughput, so its removal was measured with the
existing dev instrumentation. Read those numbers with `flashlist-performance-analysis.md`
§ "Reading the instrumentation" in mind: that day's blank-cell percentages came from the viewability-based
detector (since rewritten to count mounted cells) and are not cited here; frame
gaps and timings are.

- **Crash (pantry, 59 items):** 7 rapid swipe-deletes, 0 throws. The pre-change run on
  the same build threw on 4 of 4.
- **Pantry deletes:** long frames unchanged at 2, peak frame gap 63 ms across a 190 s
  session; per-delete commit intervals 87–476 ms, the same order as before. (The
  `useRenderTime` "exceeded 1000ms cap" lines are wall time between commits and include
  the `DeletePantryItem` + `GetPantry` round-trips.)
- **Pantry local-window appends** (24 → 48 → 59, now rendered synchronously) never
  registered a long frame.
- **Shopping list, cold cache after sign-out (43 items, 25 per page):** the page-2
  `after:` append produced 0 long frames (>32 ms) in the 20 s report containing it.
  That run also carries the per-node row cache described in
  `flashlist-performance-analysis.md`; before it, an append re-rendered every mounted
  cell and cost a 1006 ms frame gap — that was the cost the deferral had been hiding,
  and it was fixed rather than re-hidden.

## Related symptom, same root shape

`SortableItem.tsx:57-62` documents the shopping list's version of the same stale-index
window: `renderItem` transiently receiving an `undefined` item after a purchase toggle
or delete. That one is handled defensively in the row component because it surfaces
during render rather than in a native event handler.
