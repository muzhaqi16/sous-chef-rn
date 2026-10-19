# `sous-chef/flashlist-declares-scroll-component`

Every FlashList declares which scroll component it renders through.

## Reports

- A `<FlashList>` with no `renderScrollComponent` prop.
- One whose `renderScrollComponent` names anything but the two hosts below — `renderScrollComponent={ScrollView}` loses the gesture exactly as an absent prop does.

## Why

A list inside a bottom sheet needs gorhom's scrollable, which coordinates its scroll with the sheet's own pan; no other gate makes a new sheet list choose it.

A list whose rows carry RNGH gestures needs an RNGH scroll host:

- **Pull-to-refresh.** `ThemedRefreshControl` is RNGH's control, which throws outside an RNGH host, and RN's control inside one silently loses the scroll↔refresh arbitration (`sous-chef/rngh-refresh-control-matches-host`).
- **`nestedScrollEnabled={false}`.** `SwipeAwareScrollComponent` is the one place the parked-spinner override lives.
- **Arbitration.** Inside an RNGH host the orchestrator decides between the scroll and a row's swipe or press. Over React Native's `ScrollView` only RNGH's takeover cancellation does — which keeps the pantry's rows shut on 3.4.0, but is measured on that one list ([A native scroll takeover cancels a pending RNGH v3 gesture](../verified-library-behaviour.md#a-native-scroll-takeover-cancels-a-pending-rngh-v3-gesture)).

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
