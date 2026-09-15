# `sous-chef/no-imperative-sheet`

Drive a bottom sheet with its visible prop, not present()/dismiss().

## Reports

- Drive a sheet with the `visible` prop through `Sheet` / `useStandardBottomSheet`, not `present()` / `dismiss()`. Calling `dismiss()` on a modal that was never presented wedges it closed for the rest of the session — the hook guards that, a raw ref does not.

## Use instead

`Sheet` / `useStandardBottomSheet` with a `visible` boolean and `onDismiss`.

## Why

gorhom's `dismiss()` on a modal that was never presented wedges it closed for the rest of the session. The hook guards that; a raw ref does not. `Keyboard.dismiss()` is not matched.

## Exempt

The sheet machinery: `useStandardBottomSheet.tsx`, `useBottomSheetBackHandler.ts`, `useBottomSheetBackdropClaim.ts`, `ActionTray.tsx`, and `FolderPicker.tsx` (hands off between two stacked sheets). Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-imperative-sheet.js`](../../eslint/plugin/rules/no-imperative-sheet.js) · spec: [`__tests__/lint/rules/no-imperative-sheet.test.ts`](../../__tests__/lint/rules/no-imperative-sheet.test.ts)
