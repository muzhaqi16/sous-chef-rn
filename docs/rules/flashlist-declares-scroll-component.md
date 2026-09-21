# `sous-chef/flashlist-declares-scroll-component`

Every FlashList declares which scroll component it renders through.

## Reports

- A `<FlashList>` with no `renderScrollComponent` prop.
- One whose `renderScrollComponent` names anything but the two hosts below — `renderScrollComponent={ScrollView}` loses the gesture exactly as an absent prop does.

## Why

RNGH answers a native view grabbing the touch stream with `cancelAllLegacyHandlers()`, which — per its own docblock — cancels handlers created with API v1 and v2. `ReanimatedSwipeable` and RNGH's `Pressable` are on the v3 detectors, so over a plain RN `ScrollView` **their handlers survive the takeover**: a row's pan keeps accumulating horizontal travel until it opens mid-scroll, and a press fires on a finger that only stopped a fling (RNGH #4432 / #4441). Confirmed by A/B on device — removing the prop from one list reproduced it immediately.

The failure is silent: the prop is simply absent and nothing throws. That is exactly how the repo lost `dragOffsetFromLeftEdge` when RNGH renamed it in 3.x.

## Use instead

- `SwipeAwareScrollComponent` — RNGH's ScrollView, for screen-level lists.
- `BottomSheetScrollable` — gorhom's, for lists inside a bottom sheet, which own the slot and must keep it.

## What it does not catch

- An exempted list later gaining a gesture-bearing row. The row→list relation runs through context providers and `renderItem` factories, so no static check follows it; CLAUDE.md covers that by convention.
- A FlashList imported under another name, or rendered through a member expression — the selector matches the literal `FlashList` element.
- A `renderScrollComponent` passed through a `{...props}` spread, which reads as absent.

## Exempt

Lists whose rows carry no RNGH gesture, named with their reason in `eslint/project.js`: `MyRecipes.tsx` and `SavedRecipes.tsx` (RN `Pressable` only), and `PaginatedHistoryScreen.tsx` (inert rows through `AppPressable`).

Source: [`eslint/plugin/rules/flashlist-declares-scroll-component.js`](../../eslint/plugin/rules/flashlist-declares-scroll-component.js) · spec: [`__tests__/lint/rules/flashlist-declares-scroll-component.test.ts`](../../__tests__/lint/rules/flashlist-declares-scroll-component.test.ts)
