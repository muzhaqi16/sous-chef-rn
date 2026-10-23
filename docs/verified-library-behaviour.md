# Verified library behaviour

The probe record behind CLAUDE.md's one-line verification stamps. Each entry
pins a rule to what the INSTALLED package actually does: the claim, the
version it was verified against, what in the repo depends on it, and a command
that re-derives it. **If a rule changes, re-run its probe and update the entry
— a rule without a live check is a hypothesis.** Entries are last verified
2026-08-23 unless the entry names a later date. An entry stays only while a
rule, a doc or code in the repo points at it; the investigation behind it is
in git history.

### gorhom BottomSheetView cannot bound a scrollable

**Claim:** a scrollable (`FlashList` via `useBottomSheetScrollableCreator`,
`BottomSheetScrollView`, `BottomSheetFlatList`) inside `BottomSheetView` is
never height-bounded — it grows to every row and cannot scroll.

**Verified against `@gorhom/bottom-sheet@5.2.14`.** The container style is
`position: 'absolute', left: 0, top: 0, right: 0` with no `bottom` or height,
so `flex: 1` on it does nothing. Guarded by
`src/features/catalog/components/__tests__/BottomSheetAutocompleteInput.test.tsx`.

Re-check:

```
cat node_modules/@gorhom/bottom-sheet/src/components/bottomSheetView/styles.ts
```

### gorhom keyboard handling requires BottomSheetTextInput

**Claim:** a plain RN `TextInput` inside a sheet leaves the sheet blind to the
keyboard — `keyboardBehavior` never fires and the sheet sits still while the
keyboard covers the field.

**Verified against `@gorhom/bottom-sheet@5.2.14`.**
`BottomSheetTextInput.handleOnFocus` sets `animatedKeyboardState.target`, and
`useAnimatedKeyboard.ts` caches a keyboard-shown event until a
`BottomSheetTextInput` focus sets that target. The input reads the sheet's
internal context and **throws outside a sheet**, which is why shared inputs
pick their implementation from `useIsBottomSheetInput()`.

Re-check:

```
grep -n "target" node_modules/@gorhom/bottom-sheet/src/components/bottomSheetTextInput/BottomSheetTextInput.tsx
grep -n -A3 "temporaryCachedState" node_modules/@gorhom/bottom-sheet/src/hooks/useAnimatedKeyboard.ts
```

### keyboard-controller bottomOffset measures input bottom

**Claim:** `KeyboardAwareScrollView`'s `bottomOffset` is measured from the
focused input's **bottom edge**, not the caret its docstring mentions; the
library default is `0`.

**Verified 2026-09-29 against `react-native-keyboard-controller@1.22.5`.** It
computes `point = absoluteY + inputHeight` and scrolls when
`visibleRect - point <= bottomOffset`. The app default is the density-scaled
`theme.spacing.md`, applied in
`src/components/atoms/BottomSheetKeyboardAwareScrollView.tsx` (sheets) and by
`ThemedKeyboardAwareScrollView` in `src/components/atoms/themedComponents.tsx`
(full-screen forms), never at call sites.

Re-check:

```
grep -n "absoluteY + inputHeight\|bottomOffset = " node_modules/react-native-keyboard-controller/src/components/KeyboardAwareScrollView/index.tsx
```

### A keyboard-aware scrollable cannot size a sheet

**Claim:** `KeyboardAwareScrollView` inside an `enableDynamicSizing` sheet grows
the sheet by the keyboard's height. Focusing a field then opens a band of blank
sheet and scrolls the header off the top.

**Verified 2026-09-29 against `react-native-keyboard-controller@1.22.5` +
`@gorhom/bottom-sheet@5.2.14`.** The scrollable pads its own content to clear
the keyboard, gorhom's dynamic sizing measures that padding as content, and
gorhom's `keyboardBehavior: 'interactive'` has already lifted the sheet. A
content-sized sheet uses `BottomSheetView` (or gorhom's `BottomSheetScrollView`);
`BottomSheetFormScrollView` belongs in a sheet with FIXED snap points.
`PurchaseAmountSheet` and `QuantityEditSheet` are the worked pair.

Re-check:

```
grep -n "bottomPadding\|paddingBottom" node_modules/react-native-keyboard-controller/src/components/ScrollViewWithBottomPadding/index.tsx
grep -n "mode = \"insets\"" node_modules/react-native-keyboard-controller/src/components/KeyboardAwareScrollView/index.tsx
```

### A native scroll takeover cancels a pending RNGH v3 gesture

**Claim:** when a native scrollable takes the touch stream on Android, RNGH
cancels every v3 detector gesture that has not activated. A
`ReanimatedSwipeable` row stays shut through a drifting scroll, and a tap that
only stops a fling presses nothing — over React Native's `ScrollView` as well
as RNGH's.

**Verified against `react-native-gesture-handler@3.4.0`** (2026-10-16), in
source and by an on-device A/B on the pantry list (emulator, synthetic input)
with 3.3.0 as the control:

| Pantry list                        | 3.3.0                    | 3.4.0              |
| ---------------------------------- | ------------------------ | ------------------ |
| Drifting scroll, RN `ScrollView`   | the row opens mid-scroll | stays shut (2 / 2) |
| Drifting scroll, RNGH `ScrollView` | stays shut               | stays shut         |
| Tap to stop a fling, RNGH host     | presses the row (3 / 3)  | no press (0 / 3)   |
| Tap to stop a fling, RN host       | not run                  | no press (0 / 2)   |

`cancelHandlersOnNativeTouchGrab` in `GestureHandlerOrchestrator.kt` cancels a
non-active handler whose action type is a native or virtual detector, and
`cancelHandlersOnNativeTouchCancel` catches a takeover the root never hears
about by the `ACTION_CANCEL` it sends down. `cancelAllLegacyHandlers` still
matches v1/v2 alone, so before 3.4.0 an RNGH host was the only arbitration —
and even that pressed a row on a fling-stopping tap.

**Every swipeable list still takes `SwipeAwareScrollComponent`:** RNGH's
refresh control needs an RNGH host (next entry), and the A/B covers one list —
the shopping list's sits inside a pager. Dropping the host is a separate,
measured change.

Never pass `minDistance` beside `activeOffsetX` (`validatePanConfig` throws),
and `dragOffsetFromRight` throws in `__DEV__` unless non-positive.

Re-check:

```
node scripts/probe-rngh-nested-scroll.mjs
grep -n "fun cancelHandlersOnNativeTouchGrab" -A 8 node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/GestureHandlerOrchestrator.kt
```

### RNGH's scroll gesture reaches only RNGH's RefreshControl

**Claim:** a list that renders RNGH's `ScrollView` but supplies React Native's
`RefreshControl` gets no scroll↔refresh arbitration. RNGH hands the control a
`block` prop that only its own `RefreshControl` consumes; RN's control receives
it as an unknown prop. Nothing throws, warns, or type-errors.

**Verified against `react-native-gesture-handler@3.4.0` +
`react-native-unistyles@3.5.3` + `@shopify/flash-list@2.3.3`** (2026-10-16).

- **RN's control arrives unnamed.** A list that passes only
  `onRefresh`/`refreshing` gets the control FlashList builds, which is React
  Native's (`useSecondaryProps.tsx`).
- **The opposite pairing crashes.** RNGH's control in a plain RN `ScrollView`
  throws (its `VirtualDetector` requires an intercepting detector above it);
  those hosts take `PlainScrollRefreshControl`.
- An RNGH host is a FlashList rendering RNGH's scroll component OR RNGH's
  `ScrollView` used directly.
- `withUnistyles` passes `block` through by reference.

Guarded by `sous-chef/rngh-refresh-control-matches-host`.

Re-check:

```
node scripts/probe-withunistyles-prop-passthrough.mjs
grep -n "cloneElement" -A 8 node_modules/react-native-gesture-handler/src/v3/components/GestureComponents.tsx
grep -n -A 14 "const refreshControl = useMemo" node_modules/@shopify/flash-list/src/recyclerview/hooks/useSecondaryProps.tsx
```

### RNGH ends the nested scroll its ScrollView opens

**Claim:** RNGH ends the nested scroll its `ScrollView` opens, which is the
retraction path androidx's `SwipeRefreshLayout` needs. This is the upstream fix
for the parked Android refresh spinner — but the app still forces
`nestedScrollEnabled={false}`, because nothing here has measured the removal.

**Verified against `react-native-gesture-handler@3.4.0` +
`react-native@0.86.3`** (2026-10-16). Under a `refreshControl` on Android, RN
defaults `nestedScrollEnabled` to `true`, and an explicit `false` survives.
`NativeViewGestureHandler.kt`'s `ScrollViewHook` overrides
`shouldStopNestedScroll() = true`, so the handler calls
`view.stopNestedScroll()` when the gesture ends and the indicator retracts; the
orchestrator does the same for a view it cancels when the root starts
intercepting.

**Why the override stays.** A controlled A/B on the meal plan, 3.2.1 vs 3.3.0,
both with the override removed, could not reproduce the park on EITHER build
with synthetic input. This class of gesture bug needs a real finger; until a
real-finger A/B says otherwise, the override in `SwipeAwareScrollComponent`
stays.

Re-check:

```
node scripts/probe-rngh-nested-scroll.mjs
grep -n -A 4 "private class ScrollViewHook" node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/NativeViewGestureHandler.kt
grep -n "nestedScrollEnabled" node_modules/react-native/Libraries/Components/ScrollView/ScrollView.js
```

### unistyles withUnistyles drops function styles

**Claim:** wrapping `Pressable`/`TouchableX` with `withUnistyles(...)`
silently discards a function-style `style={({ pressed }) => [...]}` callback —
the child receives `{}`.

**Verified against `react-native-unistyles@3.6.0` (2026-10-21).**
`withUnistyles.native.tsx` builds the forwarded style with
`Object.assign(acc, secret.uni__getStyles())`. For a function-valued `style`
that is the function itself, and an arrow function has no own enumerable
properties. RN's `Pressable` needs no wrapper: the Unistyles babel plugin
auto-binds it.

Re-check:

```
node -e "console.log(Object.assign({}, ({pressed}) => [{padding:12}]))"   # -> {}
```

### A React commit reverts Unistyles' theme values at and under a Reanimated view

**Claim:** after a theme change, Unistyles commits the new values outside
React, and the next React commit can put the old values back on a view that a
Reanimated animated style has registered, and on everything under it.
Reanimated re-applies only the props it owns.

**Verified against `react-native-unistyles@3.5.3` +
`react-native-reanimated@4.7.1` + `react-native@0.86.3` (2026-10-13, Android
emulator; first measured on 3.5.0 on an iOS simulator),** by running
`UnistylesShadowRegistry.verify()` after every commit. Right after the
Unistyles theme commit there were 0 mismatches; the next React commit put
`CollapsingHeroDetail`'s hero back on the old theme. With a
`ThemeEpochSentinel` in both of the template's Reanimated containers: 0 (on
Android 0 of 564 views, against 1 of 563 without the hero's sentinel).

The mechanism: `ReanimatedCommitHook` clones each registered view and its
ancestors without a runtime shadow node reference, so React's own instance of
those views is never mounted. Unistyles' `refreshReactNodes` skips any node
never mounted, and React re-attaches the pre-theme subtree on its next commit.

The fixes: themed values on the animated view itself go in a theme-only
`useAnimatedStyle` over `useAnimatedTheme()` (enforced by
`sous-chef/animated-node-takes-no-themed-style`). A Reanimated container whose
descendants carry themed styles renders a `ThemeEpochSentinel`, a child
re-keyed on each theme commit. Upstream:
[reanimated#7728](https://github.com/software-mansion/react-native-reanimated/issues/7728),
[unistyles#1170](https://github.com/jpudysz/react-native-unistyles/issues/1170),
[unistyles#1007](https://github.com/jpudysz/react-native-unistyles/issues/1007).

Re-check: remove the sentinel from `CollapsingHeroDetail`'s hero, then open a
fresh `PantryItemDetail`, `setTheme('DARK')`, and navigate away and back.
`UnistylesShadowRegistry.verify()` (module
`react-native-unistyles/src/specs/ShadowRegistry`) through `debugger-evaluate`
then reports `dot` / `heroInner` mismatches.

### A Unistyles reader inside a ScopedTheme ignores theme events

**Claim:** a `withUnistyles` or `useUnistyles` reader mounted inside a
`ScopedTheme` never follows a theme event: not a switch to another theme, and
not `UnistylesRuntime.updateTheme` giving the scoped theme itself new values.
A view styled by `StyleSheet.create` is updated natively and does follow.

**Verified against `react-native-unistyles@3.6.0` (2026-10-21, in source; on
an Android emulator on 3.5.2).** `useProxifiedUnistyles` builds its listener
with `updateTheme: () => { if (scopedTheme) return; … }`, and inside a scope
`scopedTheme` is the scope's name.

The fix: `CurrentThemeScope` keys its `ScopedTheme` on the theme name and the
theme epoch, so every theme commit remounts the children. Guarded by
`src/components/atoms/__tests__/CurrentThemeScope.test.tsx`.

Re-check:

```
grep -n -A 6 "updateTheme: () =>" node_modules/react-native-unistyles/src/core/useProxifiedUnistyles/useProxifiedUnistyles.ts
```

### Unistyles' useAnimatedTheme misses a theme change made while its screen is paused

**Claim:** `useAnimatedTheme` drops its listener while a screen paused by
`inactiveBehavior: 'pause'` is hidden, and re-subscribes on reveal without
reading the theme again. A `useAnimatedStyle` over it keeps the old theme's
values. `useUnistyles` and `withUnistyles` catch up on their own.

**Verified against `react-native-unistyles@3.5.3` +
`react-native-reanimated@4.7.1` + `react-native@0.86.3` (2026-10-13, Android
emulator); the hook's source is unchanged in 3.6.0 (2026-10-21).** With Profile two levels down the stack, the theme went from dark to
light. Back on Profile the page, text and icons were light, and `ProfileHero`'s
avatar fill, which a `useAnimatedStyle` reads from the animated theme, was still
the dark surface `rgb(54, 51, 44)`. `UnistylesShadowRegistry.verify()` reports
no mismatch there, because the value is Reanimated's. With
`#hooks/ui/useAnimatedTheme` the same run gave the light surface
`rgb(255, 255, 255)`, and a paused `CollapsingHeroDetail` came back with its
pinned bar in the new theme.

The mechanism: the hook subscribes through `StyleSheet.addChangeListener` in a
`useEffect`. A hidden `Activity` runs the cleanup and the reveal runs the effect
again, and nothing reads `UnistylesRuntime.getTheme()` in between.
`useProxifiedUnistyles` does that read after a cleanup
([unistyles#1300](https://github.com/jpudysz/react-native-unistyles/pull/1300));
`useAnimatedTheme` does not.

The fix: `#hooks/ui/useAnimatedTheme` wraps the library hook. When its effect
runs again after a cleanup, it sets the shared value if the theme object changed
in between. `no-restricted-imports` bans the library hook everywhere else.
Guarded by `src/hooks/ui/__tests__/useAnimatedTheme.test.tsx`. Only a screen two
or more levels below the top is paused, so a repro needs a three-deep stack.

Re-check:

```
sed -n '/useEffect(() => {/,/}, \[scopedTheme\])/p' node_modules/react-native-unistyles/src/reanimated/useAnimatedTheme.native.ts
```

The effect reads `getTheme()` only inside the listener. On a device: point
`ProfileHero` at the library hook, open Profile, push two more screens,
`setTheme` to the other theme, and go back twice.

### react-compiler try shapes

**Claim:** inside hook/component bodies, exactly two `try` shapes make the
React Compiler bail out on the whole function: (1) any finalizer (`finally`,
with or without `catch`; also a catch-less `try`), and (2) a value block —
`?.`, `??`, `&&`, `||`, or a ternary — inside the `try` body. A `try/catch`
whose body is plain statements only compiles fine, so move the conditional out:

```ts
// BAILS — `?? null` is a value block inside the try
let data = null;
try { data = (await client.query(…)).data ?? null; } catch {}

// COMPILES — plain assignment in the try; the value block moved out
let result;
try { result = await client.query(…); } catch {}
const data = result?.data ?? null;
```

For a `finally`, use the helpers in `src/utils/finallyHelpers.ts`.

**Verified against `babel-plugin-react-compiler@1.0.0`** (re-run 2026-09-14,
all eleven fixtures as claimed). Lint sees only half of this: `react-hooks/todo`
(`eslint-plugin-react-hooks@7.1.1`) reports the finalizer shapes and NOTHING for
a value block inside a `try/catch`, so `node scripts/check-compiler-bailouts.mjs`
is the only detector of that shape.

Re-check (compiles one fixture per shape and prints the diagnostic):

```
node scripts/probe-compiler-try-forms.mjs
```

### i18next plural category fallback

**Claim:** for a missing plural category, i18next does NOT fall back to that
locale's `_other` — it falls through to `fallbackLng`. An Italian user at a
count of 1,000,000 (Italian needs `many`) would read `1000000 items` in
English if `_many` keys were missing.

**Verified 2026-09-29 against `i18next@26.4.2`.** `Translator.resolve()` tries
the plural key, then the bare key, and never `key_other` within the locale
before advancing to the next language. `completePluralCategories` in
`src/i18n/config.ts` closes the gap by filling every CLDR category a locale
needs from `_other` before `init`.

Re-check: `npx jest __tests__/i18n/pluralCategories.test.ts`.

### InteractionManager is a no-op stub

**Claim:** `InteractionManager` must never be used — in the installed RN it is
a no-op stub. `runAfterInteractions` is just `setImmediate`;
`createInteractionHandle()` returns `-1`; the other methods do nothing. Use
`requestIdleCallback` for deferring non-urgent work.

**Verified against `react-native@0.86.3`.** Re-check:

```
grep -n "InteractionManagerStub\|setImmediate(\|return -1" node_modules/react-native/Libraries/Interaction/InteractionManager.js
```

### RN's Modal calls onDismiss only on iOS, after UIKit's dismissal

**Claim:**
- **iOS:** when a `<Modal>`'s `visible` turns false, it stays rendered until UIKit's `dismissViewControllerAnimated:completion:` completes, and only then calls `onDismiss`. Unmounting it instead still dismisses it natively, but `onDismiss` never fires.
- **Android:** `visible` is ignored natively. `visible={false}` renders nothing, which dismisses the Dialog at once, and `onDismiss` never fires.

So a native screen that must not be presented from the Modal's view controller waits for `onDismiss` on iOS, and for the next frame on Android.

**Verified against `react-native@0.86.3`** by reading the source. Task 2.7 of `pr293-review-fixes-oct22` confirms it on the simulator. `AlertProvider` relies on it for buttons with `afterClose`. Re-check:

```
grep -n "isRendered\|onDismiss" node_modules/react-native/Libraries/Modal/Modal.js
grep -n "dismissViewController\|onDismiss" node_modules/react-native/React/Fabric/Mounting/ComponentViews/Modal/RCTModalHostViewComponentView.mm
grep -n "iOS only" node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/modal/ReactModalHostManager.kt
```

### simctl screenshot sampling resolves ~176 ms, no finer

**Claim:** the `xcrun simctl io <device> screenshot` loop in
`scripts/ios-frame-sample.mjs` samples at roughly 176 ms, so it can resolve the
~2 s scale of a cold start and cannot resolve anything under ~200 ms. iOS has
no OS-side fully-drawn marker, so this loop is the only second method for
cross-checking `app_fully_drawn_ms` on the platform.

**Verified 2026-08-25 on Xcode 26.6 / iOS 26.5, iPhone 17 simulator**, n=20 over
a static screen: median 176 ms per screenshot, min 159, max 351.

Re-check: run `node scripts/ios-frame-sample.mjs`; it reports the achieved
median/min/max interval for that run rather than trusting this number.

### FlashList v2 first-layout opacity gate

**Claim:** FlashList v2 renders its initial cells progressively across several
commits and holds the ENTIRE cell container — sticky-header sentinel rows
included — at `opacity: 0` until `commitLayout()` runs, while
`ListHeaderComponent` paints on the first commit. `onLoad` and
`isFirstLayoutComplete` latch ONCE per mount, so a sentinel-only skeleton
layout consumes them before real data arrives. The public
`onCommitLayoutEffect` prop is the signal that re-fires: at the end of EVERY
settled layout pass, including the first one after a data change.

**Verified against `@shopify/flash-list@2.3.2`** (re-checks re-run 2026-10-02
against 2.3.3), and on-device (SM-S908U1, `localRelease`, 67 items): the gate
is a 300–342 ms header-only blank frame between skeleton dismissal and rows,
eliminated by releasing skeletons on the first `onCommitLayoutEffect` that
lands with real content. Consumed by `useFlashListPerformance`'s
`hasContentLayout` latch.

Re-check:

```
grep -n "opacity: renderId" node_modules/@shopify/flash-list/src/recyclerview/ViewHolderCollection.tsx
grep -n "isFirstLayoutComplete = true\|initialDrawBatchSize" node_modules/@shopify/flash-list/src/recyclerview/RecyclerViewManager.ts
grep -n "onCommitLayoutEffect" node_modules/@shopify/flash-list/src/recyclerview/RecyclerView.tsx
```

### cache.modify cannot add a field

**Verified 2026-08-29 vs `@apollo/client@4.2.12`.** Re-check:
`node scripts/probe-cache-modify-field-addition.mjs`.

**Claim:** `cache.modify` runs a modifier only for a field the store object
ALREADY holds. Name a field the cached entity has never carried and the
modifier is never called, nothing is written, and there is no error or warning.
Which fields an entity carries is decided by whichever query loaded it, not by
the schema. `cache.modify` also stores exactly what it is handed: a nested
`{ __typename, id, name }` is written inline as a private copy, which goes
stale when that entity changes.

`writeEntityFields` (`src/apollo/utils/localFirstFields.ts`) therefore builds a
fragment from the update keys and goes through `cache.writeFragment`, which adds
absent fields and normalizes a nested `__typename` + `id` into a reference.
Guarded by `src/apollo/utils/__tests__/localFirstFields.test.ts`.

`cache.modify` remains the right tool where the field is known to exist and the
write must NOT normalize — connection edges and counts. It is not the tool for
`purchaseInfo`: `writePurchaseInfo` goes through `cache.writeFragment` with
`extensions: { local: true }`, which the type policy reads to merge a local flip
field-wise instead of clearing it.

### Apollo storeFieldName has two serialized forms

Verified 2026-08-29 vs `@apollo/client@4.2.12` — re-check:
`node scripts/probe-apollo-cache-shapes.mjs`.

A `cache.modify` modifier receives the field's store key, and Apollo writes it
two different ways depending on how the field is keyed:

```
storageLocations:{"homeId":"A"}        keyArgs: ['homeId']   COLON form
things({"filters":{"category":"x"}})   no keyArgs            PAREN form
```

A guard that locates the arguments by searching for `(` sees nothing on an
array-`keyArgs` field. `skipUnmatchedArgVariants` and
`skipUnmatchedFilterVariants` share `parseStoreFieldArgs`, which reads both
forms, and `cacheUpdaters.test.ts` captures the real store key off
`makeCache()` so a fixture cannot drift from Apollo's form.

Parse by whichever delimiter comes FIRST: the paren form also contains a `:`
inside its JSON. Apollo 4.2.12 exports no parser for this
(`fieldNameFromStoreName`, `argumentsObjectFromField`, `storeKeyNameFromField`);
if a later version does, prefer it over the hand-rolled split.

### Apollo reports `loading: true` on every mount, warm cache or not

Verified 2026-08-30 vs `@apollo/client@4.2.12` — re-check:
`node scripts/probe-apollo-loading-on-mount.mjs`.

**Claim:** under the app-wide `cache-and-network` -> `cache-first` pair
(`src/apollo/defaultOptions.ts`), `loading` is `true` on a screen's first render
even when the cache answers the query completely, and it is `true` again on
every remount. A screen gating its whole render on `loading` therefore blanks
itself for the length of the network leg on EVERY visit.

Two mechanisms:

- `ObservableQuery.getInitialResult` hard-codes `loading: true` for
  `cache-and-network`, so the cache never enters into it.
- `nextFetchPolicy` rewrites `options.fetchPolicy` on the ObservableQuery
  instance that settled, and `useQuery` calls `client.watchQuery` per mount, so
  a remount starts at `cache-and-network` again.

With `returnPartialData: false` an incomplete cache read yields
`data === undefined` rather than a partial object, so `loading && !data` is
precisely _"the read was incomplete"_, and one missing field of the selection
is enough to trigger it. That is why every writer of an entity must write the
full shape the reading query selects; see
[cache.modify cannot add a field](#cachemodify-cannot-add-a-field) and
`__tests__/apollo/userProfileCompleteness.test.ts`.

### Reanimated applies reduce motion itself

**Claim:** `withTiming`, `withSpring`, `withRepeat` and the entering/exiting
builders already honour the OS "reduce motion" setting with no config and no
call-site branch. A branch is needed only for motion a zero duration cannot
stop — a loop's resting state, an ambient illustration, a shimmer.

**Verified 2026-09-03 against `react-native-reanimated@4.6.0`; probe re-run
2026-10-02 against 4.7.1.** An animation that passes no `reduceMotion` resolves
to the device setting (`getReduceMotionFromConfig` in `animation/utilCommon.js`).
This is why `src/theme/motion.ts` holds one set of tokens rather
than a reduced twin of each, and `src/hooks/animations/useMotionEnabled.ts` is
the single `useReducedMotion` read, for the loop cases and CSS transitions
(below).

Re-check:

```
node scripts/probe-reanimated-reduce-motion.mjs
```

### Reanimated CSS transitions need a baseline commit

**Claim:** a CSS transition (`transitionProperty` / `transitionDuration` in a
Reanimated component's style) animates a property only when the view ALREADY
had a transition attached in its previous commit. Attached in the same commit
as the change, it animates nothing. Once attached, it animates every change to
that property, whatever caused it — including FlashList moving a recycled cell
to a new `top`. FlashList's `prepareForLayoutAnimationRender()` animates
nothing itself: it disables recycling and offset correction for the next
commit only.

**Verified 2026-09-28 against `react-native-reanimated@4.6.0` and
`@shopify/flash-list@2.3.2`; source re-checks re-run 2026-10-02 against 4.7.1 and
2.3.3.** On the iOS simulator, attaching one commit earlier spread a delete's
reflow over 8 frames (250 ms); with a transition held on, a flick sent recycled
rows sliding across the viewport, and detaching on `onScrollBeginDrag` removed
them. Consumed by `useRowReflow`.

Re-check:

```
grep -n "hasTransition ||\|this.propsBuilder.build" node_modules/react-native-reanimated/src/css/native/managers/CSSManager.ts
grep -n "this.prevProps = nextStyle\|if (!prevProps || !transitionConfig)" node_modules/react-native-reanimated/src/css/native/managers/CSSTransitionsManager.ts
grep -n -A6 "prepareForLayoutAnimationRender: () =>" node_modules/@shopify/flash-list/src/recyclerview/hooks/useRecyclerViewController.tsx
```

### Reanimated CSS transitions ignore reduce motion

**Claim:** unlike `withTiming` and the layout-animation builders (above),
Reanimated's CSS transitions and animations have no reduce-motion handling: a
transition runs at its full duration under the OS setting. Motion driven by one
reads `useMotionEnabled()` and skips attaching it.

**Verified 2026-09-28 against `react-native-reanimated@4.6.0`, re-checked
2026-10-02 against 4.7.1,** by source only. Not probed on a device.

Re-check (expect no output):

```
grep -rli "reducedmotion\|reduce_motion\|reducemotion" node_modules/react-native-reanimated/src/css node_modules/react-native-reanimated/Common/cpp/reanimated/CSS
```

### The image picker hands back a cache `file://`, and its head is sliceable

**Claim:** reading an image's leading bytes with `fetch(uri)` → `blob.slice(0, n)`
→ `FileReader.readAsDataURL` works for every URI this app's picker produces, and
`content://` never arises: the library copies the selection into the app's own
cache. The upload confirm step verifies the object's magic bytes, so the presign
must ask for the type the BYTES are, not the type the picker reports.

**Verified on device 2026-09-04, SM-S908U1 (Android 16, API 36), against
`react-native-image-picker@8.2.1` + RN 0.86.3 (Hermes).** `fetch` fails with
the same `Network request failed` on a `data:` URI, on a `file://` outside the
app's sandbox, and on a MediaStore `content://` without media permission, so the
sniffer degrades to the reported type rather than refusing. `global.atob` threw
`Property 'global' doesn't exist` on this device while bare `atob` resolved, so
`bytesFromDataUrl` uses the bare form.

Guarded by `src/utils/__tests__/imageValidation.test.ts` (`sniffImageMimeType`).

### fraction.js's float constructor costs a quarter-second on device

**Claim:** `new Fraction(<float>)` runs a continued-fraction search whose cost
depends on how near the value is to a rational it cannot represent exactly.
Seeding from an integer numerator/denominator pair
(`new Fraction(Math.round(v * 1e6), 1e6)`) is exact rational arithmetic instead,
and produces identical output.

**Verified 2026-09-07 against `fraction.js@5.3.4`, in the app's own Hermes
runtime on an SM-S908U1**, debug bundle. Microseconds per
`.simplify(0.02)` call, float against integer pair: `0.33333334` 273,534 vs 36;
`4.6` 17,843 vs 53; `1.1` 9,051 vs 17. `0.33333334` is the float32 echo of `1/3`
the API returns, and the path is per-row (`QuantityBadge`, `QuantityDisplay`,
`PantryItemCard`). `src/utils/__tests__/formatQuantity.test.ts` pins the output.

Re-check: time both forms in the app's Hermes runtime through
`debugger-evaluate` (`argent-metro-debugger`).

### Apollo gc needs no result-cache reset to drop evicted entities

Verified 2026-09-29 vs `@apollo/client@4.2.12` — re-check:
`node scripts/probe-apollo-gc-result-cache.mjs`.

**Claim:** after `cache.evict` + `cache.gc()`, a watched query and a fresh
read see exactly the same result with or without `resetResultCache: true`: a
read depends on each entity's `__exists`, which `evict` dirties, so no stale
memoized result survives. The reset only discards memoized results, so the next
broadcast re-reads every watcher cold. In the app (2026-09-30, simulator, 519
entities, 23 cache watches) that was a median 33.83 ms against 0.50 ms.

**What depends on it:** the `cache.gc` wrapper in `src/apollo/client.ts` no
longer forces the reset, and `safeEvict` / `safeEvictMany` in
`src/apollo/utils/cacheUpdaters.ts` call a plain `cache.gc()`.
`logoutCleanup.ts` keeps the reset, where the aim is freeing memory on a
session end.

### Apollo masked results keep identity when only masked fields change

Verified 2026-09-29 vs `@apollo/client@4.2.12` — re-check:
`node scripts/probe-apollo-masked-result-identity.mjs`.

**Claim:** with `dataMasking: true`, a query does not re-emit when the only
field that changed sits behind a fragment spread, and its `data` keeps the
same object identity. A value derived from that `data` by a render-time
`cache.readFragment` is recomputed only when its inputs change — the React
Compiler memoizes it on them — so it stays stale until something else changes
the query's result. `useFragment` (`watchFragment`), with a single or an ARRAY
`from`, sees the edit.

The mechanism is in `core/ObservableQuery.js`: with `dataMasking` on, the emit
filter compares against the query with named spreads marked `@nonreactive`, and
a masked result deeply equal to the previous one is swapped for the previous
object. Selecting the field inline as well makes the query re-emit, which is
why "reactivity signal" selections worked, and why removing one as a cleanup
froze the value it fed.

**What depends on it:** every render-time read of cached data in a feature hook
goes through `useFragment`, or `useFragmentList` (`src/hooks/apollo/`) for a
list; `no-restricted-syntax` `renderTimeReadFragment` holds feature hooks to it
(`docs/rules/restricted-syntax.md`).

### Apollo lazy re-execute answers from the cache after the first result

Verified 2026-09-29 vs `@apollo/client@4.2.12` — re-check:
`npx jest src/apollo/__tests__/lazyReexecuteFetchPolicy.test.tsx`.

**Claim:** a `useLazyQuery` executed a second time with the same variables is
answered from the cache, even when the hook asked for `network-only`. `execute`
calls `observable.reobserve` with the observable's CURRENT `fetchPolicy`, and
the client-wide `nextFetchPolicy: 'cache-first'` (`src/apollo/defaultOptions.ts`)
rewrote it after the first result. `execute` accepts only `variables` and
`context` in 4.2, so the policy cannot be overridden per call.

**What depends on it:** a lazy query that re-issues to refresh sets
`nextFetchPolicy: 'network-only'` on the hook (`useRecipeIngredientMatching`,
`useHomeInvitations`, `useConvertAvailableQuantity`); a warmer or time-to-live
refresh uses `client.query({ fetchPolicy: 'network-only' })` through
`fromServer`. See `apollo-client-patterns.md` § Resync.

### Apollo `skipToken` keeps serving the last run's data

Verified 2026-09-29 vs `@apollo/client@4.2.12` — re-check:
`npx jest src/features/shoppingList/hooks/__tests__/useShoppingListItemsQuery.test.ts`
("serves nothing of the old list once no list is selected").

**Claim:** `useQuery(Doc, skipToken)` passes no variables, so the hook keeps the
previous run's `variables` and `data`. `skip: true` with new variables returned
`data: undefined`; `skipToken` returns the LAST subject's data. A hook whose
subject changes while its query is skipped (a list deselected, a pantry
switched mid-load) must check the result's `variables` against the current
subject before using `data`:

```ts
const result = useQuery(
  Doc,
  listId ? { variables: { id: listId } } : skipToken,
);
const data = result.variables?.id === listId ? result.data : undefined;
```

A query skipped from mount has no variables, so `refetch()` on it sends none;
a hook that exposes `refetch` guards it. `useSubscription` has no `skipToken`
overload in 4.2.12, so the subscription hooks stay on `skip`.

### Apollo tears down a paused screen's query; resubscribing reads the current fetch policy

Verified 2026-10-02 vs `@apollo/client@4.2.12` — re-check:
`npx jest src/apollo/__tests__/refetchEvents.test.ts -t "paused at the switch"`.

**Claim:** native-stack's `inactiveBehavior: 'pause'` hides a screen in a React
`Activity`, whose effects are cleaned up, so the screen's `useQuery` loses its
last observer. An `ObservableQuery` with no observer is torn down and removed
from the client's set. Neither `refetchQueries({ include: 'active' })` nor
`include: 'all'` reaches it. On resume the first subscriber calls `reobserve()`
with no options, which runs the current `fetchPolicy`: `cache-first` once the
global `nextFetchPolicy` has applied, so the screen serves what the cache holds
and sends nothing.

**What depends on it:** the language catch-up in `src/apollo/refetchEvents.ts`.
After a switch, every navigation refetches only the active queries not answered
since it, because a refetch at the switch cannot reach a paused screen.

### Google ML Kit's iOS pods have no arm64-simulator slice

Verified 2026-09-30 against `MLKitTextRecognition` 7.0.0 (the pod behind
`GoogleMLKit/TextRecognition` 8.0.0).

**Claim:** ML Kit's iOS frameworks ship an arm64 slice built for devices and an
x86_64 slice built for the simulator, and nothing else. On Apple silicon with
an arm64-only iOS 26+ simulator runtime, any ML Kit pod fails to link. That's
why `react-native.config.js` keeps the barcode scanner's pod off iOS, and why
receipt text recognition uses Apple Vision on iOS (`TextRecognitionModule.swift`).

Re-check (the pod's source URL is in its podspec on the CocoaPods CDN):

```
curl -sL -o t.tgz https://dl.google.com/dl/cpdc/d19e9c059f422b0c/MLKitTextRecognition-7.0.0.tar.gz
tar xzf t.tgz && F=Frameworks/MLKitTextRecognition.framework/MLKitTextRecognition
lipo -info $F                               # x86_64 arm64
for a in arm64 x86_64; do lipo -thin $a $F -output /tmp/s && otool -l /tmp/s | grep -m1 ' platform '; done
# arm64 → platform 2 (iOS device); x86_64 → platform 7 (iOS simulator)
```

### Apple Vision reads a two-column receipt as separate columns

Verified 2026-09-30 on the iPhone 18 Pro simulator (iOS 27, arm64) through
`TextRecognitionModule.recognizeAndDelete` (`VNRecognizeTextRequest`,
`.accurate`, language correction off).

**Claim:** Vision returns a receipt's left column top to bottom, and then its
price column as separate observations. A row's name and price are never one
observation, so `receipts/utils/assembleReceiptRows.ts` rebuilds rows by
vertical overlap before redaction and parsing. On a rendered 18-row receipt:
the 16 left-column rows first, then 8 prices, each price's `y` within 0.005 of
its row's. The same call deletes the pages it read, plus any
`DOCUMENT_SCAN_*.jpg` that `react-native-document-scanner-plugin` 2.0.4 left in
Documents, which iCloud backs up.

The document scanner itself needs a device: on the simulator, `scanDocument`
rejects with `Document scanning is not supported on this device`.

Re-check: put a JPEG in the app's Documents directory, connect the debugger
(`argent-metro-debugger`), then evaluate:

```js
globalThis.nativeModuleProxy.TextRecognitionModule.recognizeAndDelete([
  'file://<Documents>/probe.jpg',
]).then(pages => (globalThis.__probe = pages));
```

### Apple Foundation Models labels receipt lines, but can't be trusted with their figures

Verified 2026-09-30 on macOS 27.0.1 (host `swift` probes) and on the iPhone 18 Pro simulator (iOS 27), through `ReceiptStructuringModule`.

**Claim:** with guided generation (`@Generable`) and greedy sampling, the on-device model labels numbered receipt lines reliably, but produces wrong figures when asked for the whole receipt: it invented purchase dates, negated item prices and shifted line indices. On a longer, skewed receipt it numbers lines itself, skipping lines with no words.

So `receipts/utils/structureReceipt.ts` reads every figure from the printed text, places each label by the words it copied, and lets the printed words overrule a label. A model reading is kept only when the receipt rules' check accepts it (`checkOnPhone`). Labelling took a median 0.55 s per labelled line on the simulator (2026-10-02, 32-receipt corpus), and 5 receipts of 48–79 lines ran past the 20 s timeout.

Re-check: connect the debugger (`argent-metro-debugger`) and evaluate
`globalThis.nativeModuleProxy.ReceiptStructuringModule.labelLines([...lines]).then(r => (globalThis.__labels = r))`.
The deployment target is iOS 15.1, so the app weak-links `FoundationModels.framework` and gates every use on `#available(iOS 26, *)`.

### Apple Foundation Models can refuse a whole receipt over its footer

Verified 2026-09-30 on macOS 27.0.1 (26A434), with `scripts/receipt-corpus/label.swift`, which uses `ReceiptStructuringModule`'s schema, prompt and greedy sampling.

**Claim:** the model's guardrail can refuse a whole labelling request because of a receipt's promotional footer. It throws `GenerationError.guardrailViolation` ("May contain unsafe content"), and which text trips it can't be predicted. An ALDI US receipt whose footer has a sweepstakes line and an age line ("Must be 18 years old to enter.") was refused; removing either one let it through.

So `parseReceiptOnDevice` sends only `linesThroughTotal`: no item follows the printed total, so the footer is never needed. A refusal still resolves to no parse, and the draft's text stands.

Re-check, with `entry.json` holding `{ "id": "…", "pages": ["<a made-up receipt with that footer>"] }`:

```
swiftc -O -parse-as-library scripts/receipt-corpus/label.swift -o /tmp/label
/tmp/label /tmp entry.json   # prints FAILED May contain unsafe content
```

### ML Kit GenAI Prompt API needs Kotlin 2.2 and a minSdk override

Verified 2026-09-30 against `com.google.mlkit:genai-prompt:1.0.0-beta4` (with `genai-common` beta4), Gemini Nano's on-device Prompt API. The dependency fails twice without help:

1. `processDebugMainManifest`: the library's minSdk is 26, against the app's 24. `tools:overrideLibrary` clears it.
2. `compileDebugKotlin`: the library's Kotlin metadata is 2.3.0, which Kotlin 2.1.20 cannot read. The failure hits `MainApplication.kt`, so the whole app stops compiling.

Resolved with `kotlinVersion = "2.2.0"` AND the Kotlin Gradle plugin's classpath entry versioned by it: unversioned, RN 0.86's Gradle plugin supplies 2.1.20 and the ext property changes nothing. Gemini Nano runs only on AICore devices; the emulator has none, so its labelling is still unverified on a device.

Re-check: `genai-prompt` is already a dependency in `android/app/build.gradle`; to see the failure again, set `kotlinVersion` back to `"2.1.20"` in `android/build.gradle` and run `./gradlew :app:compileDebugKotlin`.

### ML Kit text recognition kills the app on the arm64 Android emulator

Verified 2026-09-30 on `Medium_Phone_API_36.1` (Android 16, arm64, Apple-silicon host) with `play-services-mlkit-text-recognition` 19.0.1.

**Claim:** the first `TextRecognizer.process` loads Play services' TensorFlow Lite module into the app process, which dies there with `signal 4 (SIGILL)`. It is a native crash, so neither Kotlin nor JS can catch it. `TextRecognitionModule` therefore rejects with `text_recognition_unsupported` when `Build.HARDWARE == "ranchu"` on arm64, and the screen shows its failure state instead of the app vanishing. The document scanner works on the same emulator; it writes pages to `cache/mlkit_docscan_ui_client/<id>.jpg`, which recognition empties on every call.

Re-check: `adb logcat | grep -E "SIGILL|TfliteDynamite"` while scanning on the emulator with the guard removed.

### Android breaks a TextView's lines by glyph bounds, and React Native measures by advances

**Claim:** on Android 15+ an app that targets API 35 or later gets bounds-based
line breaking in every `TextView` (`TextView#USE_BOUNDS_FOR_WIDTH`). React
Native measures `<Text>` with a `StaticLayout` that breaks on glyph advances.
A line that fits when measured can wrap when the view lays its text out again,
and the extra line falls outside the measured height.

**Verified against `react-native@0.86.3` (2026-10-12, API 36 emulator at
420 dpi, `targetSdkVersion` 36).** Profile's email, a shrink-wrapped `<Text>`
with 0.03 px to spare, drew as `test@souschef` after any theme change.
`TextLayoutManager.kt` declares a `setUseBoundsForWidth` handle and never calls
it, and `ReactTextView.java` does not mention it.

The fix: `AppTheme` sets `android:useBoundsForWidth` to `false`, which every
`TextView` takes from its theme in place of the platform default.
[react-native#58280](https://github.com/react/react-native/pull/58280) makes
the same choice inside `ReactTextView`; it is on `main` and in no release
through 0.87.1.

Re-check (a hit means React Native opts out itself and the theme item can go):

```
grep -c "UseBoundsForWidth" node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/ReactTextView.java   # 0
```

Guarded by `__tests__/androidTextLineBreaking.test.ts`.
