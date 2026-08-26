# Regression triage — 2026-08-26

Seven reported defects: scroll-time tab-bar lag, biometric login never offered
after sign-out, a mis-themed unit picker, a hanging pull-to-refresh, a Create
button stuck looking disabled, the camera permission dialog overlapping the
Add-to-Pantry sheet, and excess whitespace in Home Details.

They are **not one regression**. Four are deterministic defects readable in the
tree, two are races/threading whose share of the symptom still has to be
measured, and one is pre-existing layout. Two of them are in code the last
batch of commits never touched.

**What this pass did and did not do.** Everything below comes from reading the
tree at `66c3f75`. `node_modules` is not installed in this session, so
`npm run typecheck`, `npm run lint`, `npm test`,
`node scripts/check-compiler-bailouts.mjs` and both `scripts/probe-*.mjs` could
not be run, and nothing here was measured on a device. Per
`CLAUDE.md` § Performance measurement, a mechanism is not a cause: where a
claim needs a number or a probe, it says so and names the probe.

---

## A. Deterministic — readable in the code, no measurement needed

### A1. Sign-out deletes the biometric credentials

`src/services/authService.ts:854` — `logout()` ends with:

```ts
if (currentUserEmail) {
  await removeCredentials(currentUserEmail);
}
```

`removeCredentials` → `clearCredentials` resets **both** keychain slots: the
biometry-gated credential service and the unprotected "credentials exist"
indicator (`src/storage/keychain.ts:266-279`). Three consequences, all matching
the report exactly:

- The login screen computes
  `shouldShow = biometric.isAvailable && hasCredentials && !!email`
  (`src/screens/auth/LoginScreen.tsx:61`). `hasCredentials` is now false, so the
  fingerprint button never renders.
- `shouldShowPostLoginBiometricPrompt` checks `hasCredentials(accountEmail)`
  (`src/services/authService.ts:665`) and, finding none, returns
  `{ shouldShow: true }` — so every fresh login asks you to enrol again.
- `autoLogin()` can never succeed after a manual sign-out.

`saveLastBiometricEmail` writes to a different service that logout never
touches, so the *email* survives; only the credentials and the indicator go.
That is why the flow gets far enough to offer registration and no further.

**Fix.** Sign-out is not the event that should forget a device. Clear
credentials on: an explicit "turn off biometric login" in settings, account
deletion, and a server refusal that `isDeadCredentialCode` classifies as dead
(already handled inside `autoLogin`). If a "sign out and forget this device"
affordance is wanted, put it behind an explicit
`logout({ forgetDevice: true })` — never the default.

**Guard.** `src/store/__tests__/sessionEndLeavesNoData.test.ts` makes every
surviving *persisted store key* be classified on purpose. The keychain is not
in its inventory, which is why deleting credentials read as correct cleanup.
Add the keychain to that inventory: assert the slots survive
`authService.logout()` and are removed by the disable path.

### A2. Pull-to-refresh hangs when the refresh rejects

`src/components/organisms/ItemList.tsx:226-229`:

```ts
setRefreshing(true);
await onRefresh();
setRefreshing(false);
```

No `finally`. If `onRefresh()` rejects, the third line never runs and the
spinner spins until the screen unmounts. Apollo's `refetch()` rejects on a
network error, so this fires on exactly the flaky-network pulls the report
describes as "sometimes". Identical shape at
`src/features/pantry/screens/FilteredPantryItems.tsx:404-406`.

The repo already has the right primitive — `executeRefreshWithFinally`
(`src/utils/finallyHelpers.ts:18`), written for this, used correctly by
`HomeDetailScreen:77` and `MealPlanMain:67`. The reason the un-finalized shape
keeps reappearing is written down in that same file: an inline `finally` bails
the React Compiler out of the whole function, so people write the version
without one instead of reaching for the helper.

The pantry **main** list is not affected — it derives `refreshing` from
`networkStatus === NetworkStatus.refetch` (`usePantryQuery.ts:159`), which
resets itself. The hang is on the `ItemList`-backed screens and
`FilteredPantryItems`.

Two neighbours in the same family, worth fixing in the same pass:

- `executeRefreshWithFinally` has no `catch`, so it clears the flag and then
  re-rejects into an unhandled rejection. `usePantryScreen.handleRefresh:299`
  awaits a bare `refetch()` with no catch at all.
- `useRecipeScreen.handleRefresh:791` calls `discovery.refresh()` **without
  awaiting**, so the recipes spinner clears before the data lands — the
  opposite failure, same cause.

**Guard.** One test per refresh entry point: reject the refresh function,
assert `refreshing` returns to false. Plus a check script (or a
`no-restricted-syntax` rule) that flags a `setRefreshing(true)` not routed
through the helper — `check-compiler-bailouts.mjs` polices the compiler side of
this trade-off and nothing polices the other side.

### A3. Native pickers and dialogs follow the OS theme, not the app theme

`AppSettingsScreen.tsx:171-192` renders `@react-native-picker/picker`. On
Android that is a native `Spinner`, and its dropdown is an **Android dialog**
themed from the Activity theme. `android/app/src/main/res/values/styles.xml`
declares a single `AppTheme` on `Theme.EdgeToEdge` (a DayNight parent) with no
`values-night` overrides, so the dialog follows the **OS** `uiMode`.

The app's theme is a user preference — `ThemePreference.LIGHT | DARK | SYSTEM`
driven through `UnistylesRuntime` (`src/hooks/useTheme.ts`,
`src/theme/applyAppearance.ts`). The two are completely disjoint. In-app light
theme + OS dark mode is the dark popup in the screenshot, and no RN-side
styling can reach it.

A second, smaller defect at the same call site: `AppSettingsScreen.tsx:16`
wraps `Picker.Item` in `withUnistyles`. `Picker.Item` is a config element — the
parent Picker reads `child.props.{label,value,color}` rather than rendering the
child — so a mapping applied at the wrapper's own render never reaches the
parent's read. Needs a probe against the installed 2.11.4 to confirm, but
either way the wrapper can only ever affect item text, never the dialog chrome.

**Fix.** Replace the native picker with the app's own `ModalPicker`
(`src/components/molecules/ModalPicker.tsx`) — already themed, already an
`ActionTray`, already used by `HomeDetailScreen` for role selection. Three unit
options is precisely its case. Same treatment for
`CookingPreferencesSheet.tsx:7` and `atoms/Picker.tsx`.

Same root cause, same list, not yet reported: the three
`@react-native-community/datetimepicker` call sites and every `Alert.alert`
through `alertService`. The only way to align a *native* dialog with the in-app
preference is to drive the Activity's night mode from it
(`AppCompatDelegate.setDefaultNightMode` via a small native module), which
re-creates the activity on every theme switch. Prefer the in-app picker.

**Guard.** A `no-restricted-imports` entry for `@react-native-picker/picker`
pointing at `ModalPicker`, with any remaining call site carrying a written
exception — the pattern `.eslintrc.js` already uses for banned generated
fragment names.

### A4. Home Details whitespace — dead margins and doubled padding

`HomeMemberCard` composes `commonStyles.card` (`padding: md`,
`marginBottom: sm`) with `styles.memberCard` (`padding: md` **again**,
`marginVertical: sm`). RN margins do not collapse, so adjacent member cards sit
`sm + sm` apart.

Inside the card, `memberInfo` carries `marginBottom: sm` and `memberHeader`
`marginBottom: xs`. Both are only meaningful when the block *below* them
renders. For a member viewing their own home — `canManageMember === false`, the
state in the screenshot — neither the actions row nor the email line renders,
so both margins are dead space under a single line of text. `DetailSection`'s
`paddingVertical: md` and `DetailTemplate`'s `scrollContent` padding sit on top
of that.

**Fix.** Keep one `padding`, not two. Replace the trailing `marginBottom`s with
a `gap` on the card so spacing exists only between siblings that actually
render. Pick one of `commonStyles.card`'s `marginBottom` or `memberCard`'s
`marginVertical`. This predates the current batch, as reported.

---

## B. Mechanism confirmed, share of the symptom not yet measured

### B1. The tab bar's hide-on-scroll is driven from the JS thread

`PantryContent.tsx:437` passes `onScroll={scrollHandler}` with
`scrollEventThrottle={16}`, and `scrollHandler` is a plain JS function —
`useCollapsibleScroll.ts:64`, typed
`(event: NativeSyntheticEvent<NativeScrollEvent>)`, not a worklet. Same wiring
on `ShoppingListMainContent.tsx:380` and `RecipeMain.tsx:504`.

Everything *downstream* of it is already on the UI thread:

```
onScroll (JS)  →  isScrolledDown (SharedValue)
               →  useAnimatedReaction        PantryMain.tsx:116
               →  scrollTabBarHidden
               →  useAnimatedReaction        FloatingTabBar.tsx:126
               →  withSpring → useAnimatedStyle
```

So the single JS-thread link in the chain is its **input**. Every scroll event
has to reach the JS thread — behind FlashList's recycling renders, Apollo
broadcasts, and the instrumentation in B2 — before the bar can learn which way
you are scrolling. That is the lag.

**Fix.** Move `scrollHandler` / `onScrollBeginDrag` / `onScrollEndDrag` /
`onMomentumScrollEnd` to `useAnimatedScrollHandler` so the direction logic runs
on the UI thread and the bar never touches JS. Two constraints:

1. `scrollEventThrottle` stops mattering — a worklet handler gets every frame.
2. The lists render RNGH's `ScrollView` via
   `renderScrollComponent={SwipeAwareScrollComponent}`, which is not an Animated
   component. It has to become `Animated.createAnimatedComponent(ScrollView)` at
   **module scope** for the worklet handler to attach — without disturbing the
   RNGH pairing or the explicit `ThemedRefreshControl` rule that
   `__tests__/gestures/flashListScrollComponents.test.ts` guards.

**Measure.** Release build on the SM-S908U1 (never the emulator — same screen
reads 40 ms there and 301–934 ms on hardware). Perfetto janked-frame count over
~11 s of continuous scroll, per the protocol in
`docs/audits/perf-offline-baseline-2026-08-24.md`, plus the
`Long Frames (>32ms gap)` and `Peak Frame Gap` lines from the dev report.

### B2. The instrumentation added in the last 25 commits runs in production, on the scroll path

This is the honest answer to "what did these changes introduce".

`55b712f..66c3f75` did not touch the scroll pipeline, the row components, the
cache policies, or the tab bar. What they added was *measurement* — and three
pieces of it are unsampled and live in release builds:

- **`evaluateBlankState` is not `__DEV__`-gated**
  (`useFlashListPerformance.ts:240-317`). It runs on every viewability change
  and on a coalesced rAF after every commit that mounts, moves or unmounts a
  cell — continuously, during a scroll. Each run calls FlashList's
  `computeVisibleIndices()`, allocates a `Set` and walks the whole cell map
  (`mountedCellRenderer.tsx:83`), and may push a `Telemetry.increment` plus, every
  2 s, a histogram.
- **Every cell is wrapped in `MountedCellRenderer`**, which adds a
  `useLayoutEffect` per cell (`mountedCellRenderer.tsx:112`) writing to the
  registry on mount, on every index change (i.e. every recycle), and on unmount
  — each scheduling the rAF flush above.
- **`useCommitTracking` has no dependency array on either effect**, so on every
  commit of `PantryContent` / `SortableList` / `RecipeMain`, in release, it does
  `Date.now()`, `Math.random()`, two `Telemetry` buffer writes, and an immer
  `set` over a `Map` in `performanceStore`
  (`store/slices/performanceSlice.ts:95`) — at
  `sampleRate: 1.0` (`services/performance/types.ts:175`, *"100% — first
  release, small user base, capture everything"*).

This is the instrument charging itself to the number it reports — the same
failure `docs/audits/perf-ios-baseline-2026-08-25.md` already records for the
startup marks.

**What to do, in this order.** Run the control **first**, before changing
anything: disable the instrumentation and re-measure the same scroll. Per
CLAUDE.md's own rule, vary something you do not believe in. If jank drops, the
attribution is proven and the fix is sampling — gate `evaluateBlankState`'s
telemetry and the cell registry behind a runtime flag that is off for most
sessions, and take `useCommitTracking` well below `sampleRate: 1.0` in release
or make it dev-only. If jank does not drop, B1 is the whole story and the
control just saved a refactor.

### B3. The Create button's `disabled` style is frozen at mount

`Button` sets `styles.useVariants({ variant, size, fullWidth, disabled: disabled || loading })`
(`atoms/Button.tsx:57`) and then renders through `PressableScale`, which is
`Animated.createAnimatedComponent(Pressable)` (`PressableScale.tsx:20`).
Reanimated's HOC owns the `style` prop of the element it creates; the Unistyles
babel plugin binds `styles.x` to the ShadowTree at the JSX site where the
reference appears, and here that site hands the value to a custom component,
which forwards it as an opaque variable into an arbitrary
`createAnimatedComponent` wrapper.

`AppPressable`'s own docblock already states the rule for the sibling case:
*"do NOT wrap this (or its inner `Pressable`) … either drops
`StyleSheet.create` proxy values and **freezes variants** (unistyles#1109)"*.
`PressableScale`'s docblock rules out `withUnistyles` and RNGH — not
`createAnimatedComponent`.

Two facts make this the leading explanation rather than a guess:

1. Exactly two components in the tree combine `useVariants` with
   `PressableScale` — `atoms/Button.tsx` and
   `navigation/FloatingTabBar/AddButton.tsx` — and `Button`'s `disabled` is the
   one variant in the app that flips while mounted with no other style-prop
   change. (`variant`, `size`, `fullWidth` are fixed per call site.)
2. `FilterTabsItem` flips an active/filtered variant live through the **bare**
   `Pressable` from `themedComponents` and demonstrably works — the highlighted
   tab in the pantry screenshot.

It predicts the reported behaviour precisely: `CreateHomeForm` mounts with
`homeName === ''` → `disabled: true` → the opacity variant is captured; typing
updates the prop, so `onPress` fires ("it works"), while the frozen style keeps
it looking disabled. It also predicts `AddButton` will not follow an App-Color
change — worth checking in the same pass.

**Probe (decisive, ~10 minutes).** Render one `Button` whose `disabled` flips on
a timer through `PressableScale`, and one through the bare `Pressable`. The
bare one changes opacity; the wrapped one does not. If confirmed, either move
the scale transform to a child `Animated.View` inside a plain `Pressable`, or
stop routing variant styles through the wrapper (resolve the disabled opacity
as an explicit prop). Record the result in
`docs/verified-library-behaviour.md` with a `scripts/probe-*.mjs`, per house
style.

Note this is a **different cause** from A3. The one "theme issues" complaint has
two unrelated roots, and a fix for either will look like it should cover both.

### B4. The camera permission dialog races the sheet's dismiss

`AddToPantrySheet.handleScanPress:168` navigates straight to the Barcode stack.
`useStandardBottomSheet` dismisses the sheet on the screen's `blur`
(`useStandardBottomSheet.tsx:190-206`) — correct, but that dismiss is an
*animation*. Meanwhile the pushed `BarcodeScannerScreen` mounts and its first
effect calls `requestPermission()` immediately
(`BarcodeScannerScreen.tsx:76-80`).

So the OS dialog can appear while the sheet is still sliding down over a screen
that has not finished transitioning — sheet mid-dismiss, black camera screen
behind it, permission dialog on top. Exactly the screenshot.

**Fix.** Hold the permission request until the screen has settled: request from
a `useFocusEffect` gated on the navigation `transitionEnd` event (or one
`requestAnimationFrame` after focus) instead of from a mount effect.
Optionally also dismiss the sheet before navigating so the two animations never
overlap.

**Verify on device**, not by reading: log the three timestamps — `blur`, the
sheet's `onChange(-1)`, and the `requestPermission()` call — and confirm they
interleave as described.

---

## C. What we missed

1. **The last 25 commits measured; they did not fix.** The batch is
   instrumentation, telemetry contracts, iOS baselines and Detox harness work.
   The only way it could regress runtime performance is by costing what it
   measures — and it does (B2). "These changes introduced perf issues" is true
   in that narrow sense and false in the broad one: the scroll path itself is
   untouched, and A1/A4 are in code the batch never opened.

2. **Two of the four confirmed defects are one shape: a flag set before an
   `await` and cleared after it, with nothing guaranteeing the clear.** The repo
   has both the primitive (`finallyHelpers`) and the documented reason people
   avoid it (compiler bailouts), but only the compiler side is enforced.

3. **The guards cover the mechanisms we already got burned by, not the ones we
   have not.** `flashListScrollComponents.test.ts` derives its file list from
   the tree so a new list cannot ship the wrong scroll component;
   `sessionEndLeavesNoData.test.ts` forces every persisted store key to be
   classified. Neither has an analogue for what a session end does to the
   **keychain** (A1), whether a variant style survives a component wrapper
   (B3), whether a refresh flag clears on rejection (A2), or whether a native
   dialog can be themed at all (A3). Each is the exact class CLAUDE.md keeps
   warning about — silent, device-only, invisible to typecheck, lint and jest —
   and each shipped because the only thing that would have caught it is a
   device check nobody was required to run.

4. **The in-app theme has no contract with the platform.** Every native surface
   — picker dialogs, date pickers, `Alert.alert`, permission dialogs — follows
   the OS, and nothing in the tree records that as a known limit or forces a
   decision at the call site.

---

## D. Suggested order

| # | Work | Why first / notes |
|---|------|-------------------|
| 1 | A1 — stop deleting credentials on logout | One line, one guard. Highest user impact, zero risk. |
| 2 | A2 — route every refresh through `executeRefreshWithFinally` (+ catch) | Mechanical, testable, closes a whole family. |
| 3 | B2 control run — instrumentation off, re-measure scroll on hardware | Decides whether B1 needs a refactor at all. Do it before touching the scroll path. |
| 4 | B3 probe — `PressableScale` vs bare `Pressable` variant flip | 10 minutes, decisive, and gates a fix that touches every button in the app. |
| 5 | B1 — worklet scroll handler | Only after 3. Must not disturb the RNGH scroll-component / refresh-control pairing. |
| 6 | A3 — swap the native picker for `ModalPicker` | Self-contained; extend to the other native-dialog call sites after. |
| 7 | B4 — defer the permission request past `transitionEnd` | Needs the device timestamp check first. |
| 8 | A4 — Home Details spacing | Pre-existing, cosmetic, no dependencies. |

After each code change: `npm run typecheck && npm run lint && npm test`, then
`node scripts/check-compiler-bailouts.mjs` separately — nothing runs it for you.
