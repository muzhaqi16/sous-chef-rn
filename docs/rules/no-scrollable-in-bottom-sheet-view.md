# `sous-chef/no-scrollable-in-bottom-sheet-view`

A scrollable is never nested inside a `BottomSheetView`.

## Reports

A `FlashList`, `BottomSheetScrollView`, `BottomSheetFlatList`, `BottomSheetFormScrollView` or `BottomSheetScrollable` anywhere below a `<BottomSheetView>` — including through a conditional branch.

## Why

`BottomSheetView`'s own style is absolute with `left`, `top` and `right` but no bottom and no height, and gorhom composes it **after** the caller's, so a caller's `flex: 1` loses. A list inside it is never height-bounded and cannot scroll. `handleSettingScrollable` also registers `SCROLLABLE_TYPE.VIEW` after the list registers itself, so the sheet loses scrollable arbitration too.

The repo has already paid for this once — `BottomSheetAutocompleteInput` records the observed failure — and a later PR moved a third instance across the tree without anyone noticing.

## Use instead

Put the list in a plain `View` carrying `flex: 1`.

## Exempt

`FolderPicker.tsx`: its list carries an explicit `maxHeight`, so it is bounded without the container — the variant CLAUDE.md records as getting away with it.

Source: [`eslint/plugin/rules/no-scrollable-in-bottom-sheet-view.js`](../../eslint/plugin/rules/no-scrollable-in-bottom-sheet-view.js) · spec: [`__tests__/lint/rules/no-scrollable-in-bottom-sheet-view.test.ts`](../../__tests__/lint/rules/no-scrollable-in-bottom-sheet-view.test.ts)
