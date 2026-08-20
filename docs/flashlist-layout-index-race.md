# FlashList: "index out of bounds, not enough layouts" on rapid deletes

**Status:** open upstream bug in `@shopify/flash-list`, unpatched here by choice.
**Affects:** `@shopify/flash-list@2.3.2` (latest published as of 2026-08-20 — upgrading does not help).
**Seen on:** Pantry (`PantryContent`), Android. Any FlashList whose `data` shrinks
while cells are mounted can hit it.

## Symptom

```
Error: index out of bounds, not enough layouts
    at getLayout            (LayoutManager.js:153)
    at getLayout            (RecyclerViewManager.js:94)
    at anonymous            (RecyclerView.js:244)     <- validateItemSize
    at anonymous            (ViewHolder.js:26)        <- onLayout
    at executeDispatch / batchedUpdates$1 / dispatchEvent
```

Reproduce by deleting several pantry rows in quick succession, especially rows
near the end of the list.

## Mechanism

A cell's **native** `onLayout` event is queued for the index it had when the frame
was laid out. If the data (and therefore the layout array) shrinks below that index
before the event is dispatched into JS, the handler looks up a layout that no longer
exists and throws. The `dispatchEvent → batchedUpdates → executeDispatch` frames in
the stack are that late event arriving.

The chain, in upstream source terms:

| Step | File (upstream `src/`)                                  | What happens                                                                                        |
| ---- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1    | `recyclerview/ViewHolder.tsx:90-95`                     | `onLayout` calls `onSizeChanged(index, layout)` with the cell's captured `index` — no bounds check. |
| 2    | `recyclerview/RecyclerView.tsx:610`                     | `onSizeChanged` is `validateItemSize`.                                                              |
| 3    | `recyclerview/RecyclerView.tsx:377`                     | `validateItemSize` calls `recyclerViewManager.getLayout(index)` — the **throwing** accessor.        |
| 4    | `recyclerview/RecyclerViewManager.ts:138`               | forwards to the layout manager.                                                                     |
| 5    | `recyclerview/layout-managers/LayoutManager.ts:230-233` | `if (index >= this.layouts.length) throw new Error(ErrorMessages.indexOutOfBounds)`.                |

The shrink itself is `LayoutManager.deleteLayout()`, which splices `layouts`
synchronously during the delete commit.

In the shipped build this is `dist/recyclerview/RecyclerView.js:244`, which is the
frame that appears in the stack above.

## Why it is a library bug

FlashList already ships the guarded accessor for exactly this situation —
`RecyclerViewManager.tryGetLayout(index)` (`recyclerview/RecyclerViewManager.ts:145-154`)
returns `undefined` when the index is out of range, and other call sites use it.
`validateItemSize` simply calls the throwing variant instead. The upstream fix is
one line:

```ts
const validateItemSize = useCallback(
  (index: number, size: RVDimension) => {
    const layout = recyclerViewManager.tryGetLayout(index);
    // A native onLayout event can be dispatched after the data shrank past this
    // index; the cell is already gone, so there is nothing to validate.
    if (!layout) return;
    …
  },
  [recyclerViewContext, recyclerViewManager]
);
```

## Nothing on our side provokes it

- `prepareForLayoutAnimationRender()` in the delete paths (`PantryContent.tsx:225`,
  `SortableList.tsx:123,133`, `ItemList.tsx:228`) is **not** the trigger. In 2.3.2 its
  only effect is skipping one commit's scroll-offset correction
  (`animationOptimizationsEnabled`, read solely at
  `recyclerview/hooks/useRecyclerViewController.tsx:181`); the "disables item
  recycling" wording in its docstring does not match the code. Removing the call
  would not close the race and would re-enable offset correction mid-delete.
- `keyExtractor` (`pantryListKeyExtractor`) is stable and id-based.
- The pantry's delete animation is a manual slide-out that calls `onDelete` **after**
  it finishes (`PantryItemCard.tsx`, `SlideAnimatedWrapper`), so there is no
  Reanimated layout/exiting animation holding cells past their removal.

There is no app-side change that closes the window: the event is already queued in
the native layer before JS decides to shrink the list.

## Severity

Not just a dev red box. The error reaches `ErrorUtils.reportFatalError`
(`@react-native/js-polyfills/error-guard.js`), which calls the global handler with
`isFatal: true`. `setupGlobalErrorHandler` (`src/utils/globalErrorHandler.ts`)
therefore records it as `app_unhandled_exceptions_total{fatal="true"}` and forwards it
to React Native's default handler — a JS-fatal path in release builds.

## Related symptom, same root shape

`SortableItem.tsx:57-62` documents the shopping list's version of the same stale-index
window: `renderItem` transiently receiving an `undefined` item after a purchase toggle
or delete. That one is handled defensively in the row component because it surfaces
during render rather than in a native event handler.

## Decision

Documented, **not patched**. `patch-package` is wired into `postinstall` but the repo
carries no patches, and this crash is upstream's to fix. Re-check `validateItemSize`
on the next `@shopify/flash-list` bump: if it still calls `getLayout` rather than
`tryGetLayout`, the bug is still present.
