# Migration Plan — react-native-gesture-handler 2.x → 3.x

_Status: **planned, not started**. No code or dependency changes in PR #166. Owner: TBD._

## Trigger

The app is on `react-native-gesture-handler@^2.30.0` and
`@react-navigation/*@8.0.0-alpha.*`. When React Navigation v8 progresses from
alpha to **beta**, it is expected to require RNGH **3.x**. We should land the
RNGH 3.x bump on our own schedule — before the nav v8 beta forces a rushed,
coupled upgrade.

**Target milestone: before adopting React Navigation v8 _beta_** (we are on v8
_alpha_ today).

## Current state (well-positioned)

An audit of the 14 files importing `react-native-gesture-handler` shows the app
is already on the RNGH APIs that survive into 3.x:

| Symbol in use | Files | 3.x status |
|---|---|---|
| `Gesture` / `GestureDetector` | 5 / 3 | ✅ Modern declarative API — the 3.x direction |
| `ScrollView` (RNGH) | 7 | ✅ Retained |
| `Pressable` (RNGH) | 3 | ✅ Retained |
| `GestureHandlerRootView` | 2 | ✅ Retained |
| `ReanimatedSwipeable` (via `SwipeableItem` wrapper) | 1 | ✅ Already the non-legacy Swipeable |

Key points:
- **No legacy imperative handlers.** Zero usages of `PanGestureHandler`,
  `TapGestureHandler`, `LongPressGestureHandler`, `FlingGestureHandler`, the
  `State` enum, or `useAnimatedGestureHandler` — the APIs most disrupted by 3.x.
  The app already uses the `Gesture.*` builder + `GestureDetector`.
- **Swipeable is already `ReanimatedSwipeable`.** All swipe UI funnels through the
  single `src/components/molecules/SwipeableItem/` wrapper, which imports from
  `react-native-gesture-handler/ReanimatedSwipeable`. The legacy `Swipeable`
  (removed in 3.x) is not used, and there is exactly **one** wrapper to touch if
  the `ReanimatedSwipeable` import path or ref API shifts.

## Steps

1. Read the RNGH 3.0 release notes / migration guide when 3.0 stabilizes; confirm
   the peer-dependency matrix against our `react-native@0.83.9`, Reanimated, and
   the target `@react-navigation` v8 beta.
2. Bump `react-native-gesture-handler` to 3.x; run `npm install` and a native
   rebuild (iOS pods + Android).
3. Reconcile the single `SwipeableItem` wrapper against any `ReanimatedSwipeable`
   API/import changes (the one concentrated risk point).
4. Typecheck + lint; then exercise gestures on device: swipe-to-action rows
   (pantry, meal plan, shopping list), any `GestureDetector` tap/pan chains, and
   scroll containers that embed RNGH components.
5. Bump React Navigation v8 to beta in the **same** PR (or immediately after) so
   the RNGH + nav versions move together and are validated in one device pass.

## Blast radius

- 14 files import RNGH, but behavior is concentrated: 1 Swipeable wrapper, a
  handful of `GestureDetector` sites, and RNGH `ScrollView`/`Pressable` swaps that
  are API-stable.
- Native rebuild required (new native module version) → needs both iOS and
  Android device smoke.

## Risks / trade-offs

- **[Peer-dep coupling with nav v8 + Reanimated]** → Do the RNGH 3.x and nav v8
  beta bumps together to avoid a half-migrated state where the two libraries
  disagree on the required RNGH version. Verify the Reanimated version is
  compatible with RNGH 3.x before starting.
- **[`ReanimatedSwipeable` API drift]** → The single wrapper localizes this; if
  the ref/method surface (`SwipeableMethods`, `SwipeableRef`) changes, only
  `SwipeableItem/` and its `types.ts` need updating, not every call site.
- **[Native rebuild regressions]** → Requires a real-device pass on both
  platforms; can't be fully validated in Jest.
- **[Timing]** → Not urgent while we remain on nav v8 alpha. The cost of waiting
  is only that it eventually couples to the nav beta bump — which this plan
  already recommends doing together.
