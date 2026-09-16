# `sous-chef/rngh-refresh-control-matches-host`

A pull-to-refresh control matches its scrollable host: RNGH's or React Native's.

## Reports

- **`bareOnRefresh`** — an RNGH-hosted FlashList offering `onRefresh` with no explicit `refreshControl`.
- **`wrongControl`** — an RNGH-hosted FlashList whose `refreshControl` is not `ThemedRefreshControl`.
- **`rnImportWithRnghHost`** — React Native's `RefreshControl` imported into a file that has an RNGH host.
- **`themedControlWithoutRnghHost`** — `<ThemedRefreshControl>` in a file with no RNGH scrollable above it.
- **`handRolledRnghScroller`** — RNGH's `ScrollView` imported directly and given a `refreshControl`, rather than going through `SwipeAwareScrollComponent`.

An RNGH host is a FlashList rendering `SwipeAwareScrollComponent`, an import of RNGH's `ScrollView`, or a rendered `<SwipeAwareScrollComponent>`.

## Why

RNGH's ScrollView hands its scroll gesture to the refresh control as `cloneElement(refreshControl, { block: scrollGesture })`, and `block` is in `NativeWrapperProps` — so only a control built by RNGH's `createNativeWrapper` routes it into `useNativeGesture`. Handed RN's plain control the prop is inert: no error, no warning, no arbitration on the pull.

**You can get RN's control without ever naming it.** Given a bare `onRefresh`/`refreshing` pair and no `refreshControl`, FlashList builds one itself (`useSecondaryProps.tsx`, `else if (onRefresh)`), and the one it builds is React Native's. That is how the shopping list shipped with an indicator that hung mid-list and would not retract until pushed back up by hand.

The reverse pairing is a **crash**, not a quality issue. `ThemedRefreshControl` wraps RNGH's control, which renders a `VirtualDetector` whose first statement is `useRequiredInterceptingDetectorContext()` — it throws when no RNGH scrollable is above it. `PlainScrollRefreshControl` exists for those hosts.

A hand-rolled RNGH scroller parks its spinner on Android: RN turns `nestedScrollEnabled` on for any ScrollView carrying a `refreshControl`, which lets `SwipeRefreshLayoutHook` fail the handler mid-pull, and androidx's `SwipeRefreshLayout` ignores the resulting ACTION_CANCEL. The `nestedScrollEnabled={false}` override lives in `SwipeAwareScrollComponent`.

## Exempt

`src/components/atoms/themedComponents.tsx` — it IS where the RNGH-vs-RN choice is made. That module's own contract is held by `__tests__/gestures/themedRefreshControlIsRngh.test.ts`.

Source: [`eslint/plugin/rules/rngh-refresh-control-matches-host.js`](../../eslint/plugin/rules/rngh-refresh-control-matches-host.js) · spec: [`__tests__/lint/rules/rngh-refresh-control-matches-host.test.ts`](../../__tests__/lint/rules/rngh-refresh-control-matches-host.test.ts)
