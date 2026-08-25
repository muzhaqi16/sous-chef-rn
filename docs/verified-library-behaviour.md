# Verified library behaviour

The probe record behind CLAUDE.md's one-line verification stamps. Each entry
pins a rule to what the INSTALLED package actually does: the claim, the
version it was verified against, the mechanism in the library's own source,
and a command that re-derives it. **If a rule changes, re-run its probe and
update the entry — a rule without a live check is a hypothesis.** Entries are
last verified 2026-08-23 unless the entry names a later date.

### gorhom BottomSheetView cannot bound a scrollable

**Claim:** a scrollable (`FlashList` via `useBottomSheetScrollableCreator`,
`BottomSheetScrollView`, `BottomSheetFlatList`) inside `BottomSheetView` is
never height-bounded — it grows to every row and cannot scroll.

**Verified against `@gorhom/bottom-sheet@5.2.14`.** The component's container
style is `position: 'absolute', left: 0, top: 0, right: 0` with no `bottom`
or height, so `flex: 1` on it does nothing; the sheet's content region gets an
explicit animated height from `BottomSheetContent.tsx`, which is what bounds a
plain flex child. `BottomSheetView` also re-registers the sheet's scrollable
as a plain view after a child list registers itself (parent effects run last).

Re-check:

```
cat node_modules/@gorhom/bottom-sheet/src/components/bottomSheetView/styles.ts
```

Guarded by `src/components/molecules/__tests__/BottomSheetAutocompleteInput.test.tsx`
("keeps the list out of gorhom BottomSheetView").

### gorhom keyboard handling requires BottomSheetTextInput

**Claim:** a plain RN `TextInput` inside a sheet leaves the sheet blind to the
keyboard — `keyboardBehavior` never fires and the sheet sits still while the
keyboard covers the field.

**Verified against `@gorhom/bottom-sheet@5.2.14`.**
`BottomSheetTextInput.handleOnFocus` sets `animatedKeyboardState.target`, and
`useAnimatedKeyboard.ts` caches a keyboard-shown event while that target is
unset — replaying it only once a `BottomSheetTextInput` focus sets the target.
The library's own
[keyboard-handling docs](https://gorhom.dev/react-native-bottom-sheet/keyboard-handling)
say the input is "pre-integrated" and the only sanctioned alternative is to
"copy the `handleOnFocus` and `handleOnBlur`" logic into your own component.

Re-check:

```
grep -n "target" node_modules/@gorhom/bottom-sheet/src/components/bottomSheetTextInput/BottomSheetTextInput.tsx
grep -n -A3 "temporaryCachedState" node_modules/@gorhom/bottom-sheet/src/hooks/useAnimatedKeyboard.ts
```

`BottomSheetTextInput` reads the sheet's internal context and **throws outside
a sheet** (`useBottomSheetInternal`), which is why shared inputs pick their
implementation from `useIsBottomSheetInput()` context rather than hardcoding.

### keyboard-controller bottomOffset measures input bottom

**Claim:** `KeyboardAwareScrollView`'s `bottomOffset` is measured from the
focused input's **bottom edge**, not the caret its docstring mentions; the
library default is `0`.

**Verified against `react-native-keyboard-controller@1.22.4`.**
`KeyboardAwareScrollView/index.tsx` computes
`point = absoluteY + inputHeight` and scrolls when
`visibleRect - point <= bottomOffset`; the prop defaults to `0` in the same
file. The app-level default is the density-scaled `theme.spacing.md`, applied
as a `withUnistyles` mapping in
`src/components/atoms/BottomSheetKeyboardAwareScrollView.tsx` (sheets) and by
`ThemedKeyboardAwareScrollView` in
`src/components/atoms/themedComponents.tsx` (full-screen forms) — not in the
library, and never hardcoded at call sites.

Re-check:

```
grep -n "absoluteY + inputHeight\|bottomOffset = " node_modules/react-native-keyboard-controller/src/components/KeyboardAwareScrollView/index.tsx
```

### RNGH v3 handlers survive a native scroll takeover

**Claim:** a `ReanimatedSwipeable` row inside a plain RN `ScrollView` opens while
the user is only scrolling, and no activation distance prevents it. RNGH does not
cancel v3 gesture handlers when a native scrollable takes the touch stream, so the
row's pan keeps accumulating horizontal travel for the whole drag and crosses any
threshold eventually.

**Verified against `react-native-gesture-handler@3.2.1`.** The chain:

1. `ReanimatedSwipeable.tsx:27` imports `GestureDetector` from `'../../v3/detectors'`,
   so its pan registers as `ACTION_TYPE_NATIVE_DETECTOR` / `ACTION_TYPE_VIRTUAL_DETECTOR`
   (5 / 6 in `GestureHandler.kt:1034-1035`, assigned in
   `RNGestureHandlerDetectorView.kt:106,189,227`).
2. A native view grabbing the touch calls
   `RNGestureHandlerRootHelper.requestDisallowInterceptTouchEvent()` (`:117`), whose
   only cancellation is `orchestrator.cancelAllLegacyHandlers()`.
3. `GestureHandlerOrchestrator.kt:371` — docblock: _"Cancels all handlers created
   using API v1 and v2"_ — matches only action types 1–4. **Types 5 and 6 are not in
   the list**, so the swipe pan is never cancelled.

Distance cannot compensate: `activeOffsetX` is measured from touch-down with no time
limit and no cancellation, so a long scroll crosses 10, 16, 24 — and the 40 that
failed for the reporter of upstream
[#2380](https://github.com/software-mansion/react-native-gesture-handler/issues/2380).
`ReanimatedSwipeable` also exposes no `failOffsetY` in 2.30.0, 3.1.0, 3.2.1 **or
`3.3.0-nightly-20260824`**, and the legacy non-Reanimated `Swipeable` is gone in 3.x.

**The fix is to make the scrollable an RNGH handler.**
`GestureHandlerOrchestrator.makeActive()` (`:234-247`) cancels every handler for which
`shouldHandlerBeCancelledBy` holds, so once the scroll is a real
`NativeViewGestureHandler` its activation cancels the row's pan through the
orchestrator — the arbitration `cancelAllLegacyHandlers` fails to provide. FlashList
takes it via `renderScrollComponent` (`FlashListProps.d.ts:101`); RNGH's root
`ScrollView` is the v3 wrapper (`src/index.ts:153` re-exports `./v3`), built with
`createNativeWrapper(..., { disallowInterruption: true }, GestureDetectorType.Intercepting)`.
It forwards `ref={props.ref}` and re-clones `refreshControl` with `block: scrollGesture`
(`GestureComponents.tsx:56-115`), so FlashList's scroll ref and pull-to-refresh
survive the swap. `src/components/atoms/SwipeAwareScrollComponent.tsx` is the single
place this is wired; `__tests__/gestures/flashListScrollComponents.test.ts` guards it.

**Confirmed on device by controlled A/B (2026-08-24), not just by reading source.**
With the fix in place the bug was gone; removing `renderScrollComponent` from
`PantryContent` alone — same freshly-restarted process, same bundle, same
`dragOffset`, every other list left on RNGH's ScrollView as a control — brought it
straight back. Restoring the prop cleared it again. That rules out the alternative
explanation (that a long-lived dev process accumulating stale native registrations
was the real cause, and the process restart was doing the work), because the failure
reproduced minutes into a clean process.

Note the direction of the `dragOffset` change in the fixing commit: **24 → 16**, i.e.
easier to trigger. If activation distance were the lever, lowering it would have made
misfires worse.

**When it started:** RNGH 2.30.0 → 3.0.2 (2026-07-13, `4a280dae`) moved Swipeable onto
the v3 detectors. The component's gesture config is identical across 2.30.0 and 3.2.1
— diffing the component alone clears it wrongly; the engine underneath is what changed.
Corroboration: `DayMealList.tsx` already used RNGH's `ScrollView` and was the one
swipeable surface never reported as broken.

**Upstream:** [#4432](https://github.com/software-mansion/react-native-gesture-handler/issues/4432)
("a regression introduced with the v3 `Pressable`") and open PR
[#4441](https://github.com/software-mansion/react-native-gesture-handler/pull/4441)
("when a native `ScrollView` takes the gesture over, nothing stops the handler") are
the same gap for buttons. That PR's new `cancelHandlersOnNativeTouchGrab` is gated on
`it is NativeViewGestureHandler`, so it would not cover a detector pan.

**Two near-misses that do NOT close the gap** (checked so nobody re-litigates them):

- `RNGestureHandlerDetectorView.kt:49-63` overrides
  `requestDisallowInterceptTouchEvent` and cancels its attached handlers — but
  `requestDisallowInterceptTouchEvent` propagates **upward** from the view that
  grabs the touch, and a swipeable row's detector sits **below** the ScrollView,
  so the call never reaches it. It only protects the inverse topology (a native
  scrollable inside a detector).
- `ReanimatedSwipeable` renders its detectors with `touchAction="pan-y"`
  (`ReanimatedSwipeable.tsx:583,590`), which reads as exactly this fix — but
  `touchAction` is implemented only in `HostGestureDetector.web.tsx`; the
  Android sources never consume it. Web-only.

**No `minDist` interference.** Android's `PanGestureHandler` inits
`minDist = defaultMinDist = vc.scaledTouchSlop`, which alone would activate the pan at
8dp in _any_ direction. Setting any custom criterion (`activeOffsetX` here) makes
`updateConfig` set `minDist = Float.MAX_VALUE` unless `minDistance` was passed
explicitly, so the radial fallback is off. On iOS every criterion defaults to `NAN`.
Never pass `minDistance` alongside these — `validatePanConfig` throws.

`SwipeableItem`'s `dragOffset` (default 16dp, Android's `PAGING_TOUCH_SLOP`) remains as
defence in depth only. Note `dragOffsetFromRight` **throws** in `__DEV__` unless
non-positive, which is why the component takes one positive number and applies the sign.

Re-check:

```
grep -n "cancelAllLegacyHandlers" -A 12 node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/GestureHandlerOrchestrator.kt
grep -rn "renderScrollComponent" src --include=*.tsx
grep -n -A 12 "requestDisallowInterceptTouchEvent" node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerDetectorView.kt
grep -rn "touchAction" node_modules/react-native-gesture-handler/android/src/main/java   # no hits = still web-only
```

### RNGH's scroll gesture reaches only RNGH's RefreshControl

**Claim:** a list that renders RNGH's `ScrollView` but supplies React Native's
`RefreshControl` gets no scroll↔refresh arbitration. The prop RNGH uses to wire
them together is accepted and discarded, silently.

**Verified against `react-native-gesture-handler@3.2.1` +
`react-native-unistyles@3.3.0`.** The chain:

1. `v3/components/GestureComponents.tsx:97-105` — RNGH's `ScrollView` renders
   `refreshControl` as
   `React.cloneElement(refreshControl, scrollGesture ? { block: scrollGesture } : {})`,
   with the comment _"block exists (on our RefreshControl)"_.
2. `block` is a member of `ExternalRelationsConfig`
   (`v3/hooks/utils/propsWhiteList.ts:30-34`), which is folded into
   `NativeWrapperProps` (`:116-124`).
3. `v3/createNativeWrapper.tsx:26-46` splits incoming props on that Set:
   anything in it goes to `useNativeGesture(gestureHandlerProps)`, everything
   else to the wrapped child. Only a control built by `createNativeWrapper` —
   i.e. RNGH's own `RefreshControl`, exported from `v3/components/index.ts` —
   has that split. RN's control receives `block` as an ordinary unknown prop.

Nothing throws, warns, or type-errors: the failure is entirely absent
behaviour, which is why it is guarded by a test rather than left to review.

**The mis-pairing is a CRASH in the other direction.** RNGH's control renders a
`VirtualDetector`, whose first statement is
`useRequiredInterceptingDetectorContext()` — it throws
`"VirtualGestureDetector must be a descendant of an InterceptingGestureDetector"`
when nothing above it supplies that context
(`src/v3/detectors/VirtualDetector/VirtualDetector.tsx:17-27,38`). So RNGH's
control in a plain RN `ScrollView` takes the screen down rather than merely
losing arbitration; `PlainScrollRefreshControl` is what those hosts take. An
RNGH host is either a FlashList rendering RNGH's scroll component OR RNGH's
`ScrollView` used directly — a check written only against
`renderScrollComponent` reports the second as a false positive.

**The trap is that RN's control arrives unnamed.** A list that passes only
`onRefresh`/`refreshing` and no `refreshControl` never mentions a control at
all — but FlashList builds one, and the one it builds is React Native's:

```
node_modules/@shopify/flash-list/src/recyclerview/hooks/useSecondaryProps.tsx:53-66
  const refreshControl = useMemo(() => {
    if (customRefreshControl) { return customRefreshControl }
    else if (onRefresh) { return <RefreshControl … /> }   // RN's
  }, …)
```

Observed on device 2026-08-24: the shopping list (the only RNGH-hosted list on
the bare-prop path) showed a refresh indicator hanging in the MIDDLE of the list
that would not retract until pushed back up by hand. Every list passing an
explicit `refreshControl` was unaffected — which is what localises the cause to
the control's type rather than to the RNGH scrollable itself.

The `withUnistyles` wrapper between them is transparent. It builds
`deepMergeObjects(mappingsProps, unistyleProps, props)` and spreads the result
onto the wrapped component; `deepMergeObjects` (`src/utils.ts:3-24`) recurses
only when BOTH sides of a key are objects, and no mapping declares `block`, so
the `NativeGesture` is assigned by reference and arrives intact.

Re-check:

```
node scripts/probe-withunistyles-prop-passthrough.mjs
grep -n "cloneElement" -A 8 node_modules/react-native-gesture-handler/src/v3/components/GestureComponents.tsx
grep -n -A 14 "const refreshControl = useMemo" node_modules/@shopify/flash-list/src/recyclerview/hooks/useSecondaryProps.tsx
grep -n -B 4 "'block'" node_modules/react-native-gesture-handler/src/v3/hooks/utils/propsWhiteList.ts
npx jest __tests__/gestures/flashListScrollComponents.test.ts
```

### unistyles withUnistyles drops function styles

**Claim:** wrapping `Pressable`/`TouchableX` with `withUnistyles(...)`
silently discards a function-style `style={({ pressed }) => [...]}` callback —
the child receives `{}`.

**Verified against `react-native-unistyles@3.3.0`.**
`node_modules/react-native-unistyles/src/core/withUnistyles/withUnistyles.native.tsx` builds the forwarded style
with `Object.assign({}, uni__getStyles())`, and for a function-valued `style`
prop `uni__getStyles()` returns the function itself. `Object.assign({}, fn)`
copies a function's own enumerable properties — an arrow function has none.

Re-check:

```
node -e "console.log(Object.assign({}, ({pressed}) => [{padding:12}]))"   # -> {}
```

RN's `Pressable` needs no wrapper: the Unistyles babel plugin auto-binds it to
the C++ ShadowTree, so function-style callbacks with `StyleSheet.create`
proxies work natively.

### react-compiler try shapes

**Claim:** inside hook/component bodies, exactly two `try` shapes make the
React Compiler bail out on the whole function: (1) any finalizer (`finally`,
with or without `catch`; also a catch-less `try`), and (2) a value block —
`?.`, `??`, `&&`, `||`, or a ternary — inside the `try` body. A `try/catch`
whose body is plain statements only compiles fine.

**Verified against `babel-plugin-react-compiler@1.0.0`.** The compiler's own
diagnostics: `Handle TryStatement with a finalizer ('finally') clause`,
`Support value blocks (conditional, logical, optional chaining, etc) within a
try/catch statement`, `Unexpected terminal in optional`.

Re-check (compiles one fixture per shape and prints the diagnostic):

```
node scripts/probe-compiler-try-forms.mjs
```

The `react-compiler/react-compiler` ESLint rule has a
[known bug](https://github.com/facebook/react/issues/35644) where it silently
stops reporting ALL diagnostics on unsupported syntax like `finally` — zero
warnings rather than a flagged bailout. `react-hooks/todo` catches these, and
`node scripts/check-compiler-bailouts.mjs` is the backstop that actually
compiles every file.

### i18next plural category fallback

**Claim:** for a missing plural category, i18next does NOT fall back to that
locale's `_other` — it falls through to `fallbackLng`. An Italian user at a
count of 1,000,000 (Italian needs `many`) would read `1000000 items` in
English if `_many` keys were missing.

**Verified against `i18next@26.0.10`.** `Translator.resolve()` builds, per
language, `[key, key + pluralSuffix]` and tries them in reverse — the plural
key, then the bare key — and never tries `key_other` intra-locale; only after
both miss does it advance to the next language in the fallback hierarchy.
`completePluralCategories` in `src/i18n/config.ts` closes the gap by filling
every CLDR category a locale needs from `_other` before `init`.

Re-check: the probe recorded in the docblock of `src/i18n/index.ts`, plus
`__tests__/i18n/pluralCategories.test.ts`, which asks `Intl.PluralRules` which
categories each locale needs rather than hardcoding one/other.

### InteractionManager is a no-op stub

**Claim:** `InteractionManager` must never be used — in the installed RN it is
not merely deprecated, it is a no-op stub. `runAfterInteractions` is just
`setImmediate`; `createInteractionHandle()` returns `-1`;
`clearInteractionHandle`/`addListener`/`setDeadline` do nothing.

**Verified against `react-native@0.86.3`.**
`node_modules/react-native/Libraries/Interaction/InteractionManager.js`
exports `InteractionManagerStub` with `@deprecated` tags on the module doc and
every method. Use `requestIdleCallback` for deferring non-urgent work.

Re-check:

```
grep -n "InteractionManagerStub\|setImmediate(\|return -1" node_modules/react-native/Libraries/Interaction/InteractionManager.js
```

### graphql-ws fatal close codes

**Claim:** graphql-ws rethrows close codes 4400, 4401, 4406, 4409, 4429, 4500
and its own 4004/4005 before consulting `shouldRetry`, erroring every active
subscription's sink; `dispose()` latches a `disposed` flag with no reset, and
`terminate()` is a no-op once a socket has closed.

**Verified against `graphql-ws@6.0.7`** — mechanism and verdicts in
[session-and-transport.md](session-and-transport.md); the canonical record is
`src/apollo/links/wsCloseCodes.ts`, pinned by
`src/apollo/links/__tests__/wsCloseCodes.library.test.ts`, which drives the
real installed library against a fake socket. Re-check: run that suite.

### Hermes' sampling profiler is reachable on iOS with no new dependency

**Claim:** the Hermes startup CPU profiler that
`android/.../StartupMarkModule.kt` drives through the static
`com.facebook.hermes.instrumentation.HermesSamplingProfiler` has a direct iOS
counterpart in the installed pod — a process-global root API — so
`react-native-release-profiler` is not needed on either platform.

**Verified 2026-08-25 against `hermes-engine` as vendored by
`react-native@0.86.3`.** `facebook::hermes::makeHermesRootAPI()` returns a
`jsi::ICast*` with static lifetime that casts to `IHermesRootAPI`, and
`enableSamplingProfiler(double)`, `disableSamplingProfiler()` and
`dumpSampledTraceToFile(const std::string&)` are declared on that interface.
They are `virtual`, so they dispatch through the returned object's vtable and
need no exported symbols of their own — `makeHermesRootAPI()` being exported is
the entire linkage requirement.

Three things were checked rather than assumed, because each is a way the route
could exist in headers and still not work in a shipped build:

- The entry symbol is exported in the prebuilt xcframework, not just declared.
- The profiler is genuinely compiled in rather than stubbed out by
  `HERMESVM_SAMPLING_PROFILER_AVAILABLE` — `SamplingProfiler.cpp.o`,
  `SamplingProfilerPosix.cpp.o` and `SamplingProfilerSampler.cpp.o` are all
  linked into the binary, on the device slice as well as the simulator one.
- The app target can already see the headers and the framework, so no Podfile
  change and no `pod install` is involved.

Re-check:

```
SLICE=ios/Pods/hermes-engine/destroot/Library/Frameworks/universal/hermesvm.xcframework/ios-arm64_x86_64-simulator
nm -gU "$SLICE/hermesvm.framework/hermesvm" | c++filt | grep makeHermesRootAPI
nm -a  "$SLICE/hermesvm.framework/hermesvm" | grep -c SamplingProfiler   # expect ~106, not 0
grep -n "makeHermesRootAPI\|SamplingProfiler" ios/Pods/hermes-engine/destroot/include/hermes/hermes.h
grep -o 'HEADER_SEARCH_PATHS = .*' "ios/Pods/Target Support Files/Pods-SousChef/Pods-SousChef.release.xcconfig" | tr ' ' '\n' | grep hermes-engine
```

Used by `ios/SousChef/StartupMarkModule.mm`. **Dump before disable** —
disabling first discards the samples and leaves a valid-looking empty trace.

### Metro hoists every require above all top-level statements

**Claim:** with `experimentalImportSupport: true`, Metro rewrites ES imports to
`require` calls and hoists ALL of them above every top-level statement in the
file. Relative order among the requires is preserved; order between a require
and a statement is not. A timing origin written as a statement in `index.js`
therefore runs after every module that file imports, however near the top it
appears.

**Verified against `metro@0.83.x`** (the version resolved by
`react-native@0.86.3`), by running `metro-transform-plugins`'
`import-export-plugin` — the plugin `experimentalImportSupport` enables — over
`index.js`'s shape:

```
import 'a';
global.T = Date.now();
import 'b';
import { X } from './x';
```

emits

```
require('a');
require('b');
var X = require('./x').X;
global.T = Date.now();
```

This is why `app_startup_duration_ms` and `app_fully_drawn_ms` silently
excluded `./src/i18n/config`, `./src/apollo/config` and `./src/theme/unistyles`
while being documented as measuring from JS-bundle entry: all five of
`index.js`'s bare side-effect imports evaluated before the timestamp statement.
`inlineRequires` does not change it for those — a side-effect import has no
binding to inline, so it stays a hoisted require.

The fix is structural rather than positional: the origin lives in a module with
NO imports of its own, imported first. Both halves matter — a module's own
imports evaluate before its body, so an import added there moves the origin
later again.

Re-check:

```
node scripts/check-startup-origin.mjs
```

Guarded by that script, which transforms `index.js` with the real plugin and
asserts the clock module is the first emitted `require` AND that it is
dependency-free. Wired into `pre-push` and `npm run check:startup-origin`.
Pinned to a Metro internal path on purpose: if an upgrade moves the plugin the
check fails loudly, because the guarantee is a property of that transform.

### simctl screenshot sampling resolves ~176 ms, no finer

**Claim:** the `xcrun simctl io <device> screenshot` loop in
`scripts/ios-frame-sample.mjs` samples at roughly 176 ms, so it can resolve the
~2 s scale of a cold start and cannot resolve anything under ~200 ms.

**Verified 2026-08-25 on Xcode 26.6 / iOS 26.5, iPhone 17 simulator**, n=20 over
a static screen: median 176 ms per screenshot, min 159, max 351. For scale, the
Android equivalents were 130-160 ms on the emulator and ~450 ms on the phone.
`simctl` writes full-resolution PNGs with no downscale option (~2.9 MB each),
which is most of the cost and why a run's output directory is wiped first.

This matters because iOS has **no OS-side fully-drawn marker** — there is no API
that accepts an app-declared "fully drawn" signal — so this loop is the only
second method available for cross-checking `app_fully_drawn_ms` on the platform,
and the Android two-method agreement result does not carry over.

Re-check: run `node scripts/ios-frame-sample.mjs`; it reports the achieved
median/min/max interval for that run rather than trusting this number.

Two classification traps this instrument has, both found by running it and both
now handled in the script: the pre-launch frame is often the LARGEST of the run
(3.21 MB against a 776 KB settled frame), so min/max-derived bands put real
content in a middle band and call the pre-launch frame "settled"; and relative
bands cannot mark the END of a load at all, because the tallest frame is always
the top band. Anchor to the blankest frame and detect the plateau — a settled
screen holds its byte size flat, here 776,027 bytes for seven seconds.

### jest.isolateModules cannot hold a Platform.OS override past its callback

**Claim:** a test that sets `Platform.OS` inside `jest.isolateModules(...)` and
then calls the code under test *outside* the callback silently gets the real
`Platform.OS` back.

**Verified 2026-08-25 against `react-native@0.86.3`.** RN's index exports
`Platform` through a lazy getter that `require`s the module on every access, and
Babel's ESM interop compiles `import { Platform } from 'react-native'` into that
same live read. So a `Platform.OS` check runs its `require` when the method is
CALLED, not when the module is imported — and once the `isolateModules` callback
returns, that require resolves against the restored OUTER registry and hands
back the untouched `Platform`.

The failure is silent and one-sided, which is what makes it worth writing down:
anything destructured out of `NativeModules` at import time keeps pointing at
the stub, so those assertions still pass and only the `Platform`-gated ones
fail. Use `jest.resetModules()` and keep the mutated registry live instead.

Re-check: `src/native/__tests__/StartupMark.test.ts`, whose `load()` helper
carries the same explanation at its call site.

### RN$LegacyInterop_UIManager_getConstantsForViewManager does not exist on iOS

**Claim:** `src/services/performance/viewManagerProbe.ts` records nothing on
iOS, and structurally cannot — so `viewmanagers.json` is written but always
holds `{"totalMs":0,"count":0,"rows":[]}` there.

**Verified 2026-08-25 against `react-native@0.86.3`**, by running a profiled
release build on an iPhone 17 simulator and reading the file back out of the app
container. The probe wraps
`global.RN$LegacyInterop_UIManager_getConstantsForViewManager`, which on iOS is
installed only when `ReactNativeFeatureFlags::useNativeViewConfigsInBridgelessMode()`
is true (`RCTInstance.mm:457-459`), and that flag defaults to **false**
(`ReactNativeFeatureFlagsDefaults.h:354-356`). The binding is therefore never
installed and the probe's `typeof original !== 'function'` guard returns
immediately. Android installs its equivalent through
`ReactAndroid/.../UIConstantsProviderBinding.cpp` regardless.

This is a platform difference, not a tooling gap, and it matters for how the
Android result is read: the standout finding there was UIManager view-manager
constants running at 3.29x the hardware gap, queried synchronously at
module-import time through exactly this global. **iOS does not take that code
path at all** — view configs come from the static native component registry —
so the cost has no iOS counterpart. Its absence is a different mechanism, not a
faster one.

Re-check:

```
grep -rn "useNativeViewConfigsInBridgelessMode" node_modules/react-native/ReactCommon/react/runtime/platform/ios/ReactCommon/RCTInstance.mm
grep -n -A3 "useNativeViewConfigsInBridgelessMode" node_modules/react-native/ReactCommon/react/featureflags/ReactNativeFeatureFlagsDefaults.h
```

### A profiled run's app_fully_drawn_ms suppression needs timestamp(), not query_range

**Claim:** checking that a `HERMES_PROFILE_STARTUP` run emitted no
`app_fully_drawn_ms` sample with a Prometheus range query gives the wrong
answer — the series looks freshly written when it was not.

**Verified 2026-08-25 against Mimir.** Prometheus carries a series' last value
forward for five minutes, so a `query_range` over a window that includes the
PREVIOUS unprofiled session shows samples at every step right through the
profiled run. `timestamp(app_fully_drawn_ms_count{platform="ios"})` returns the
sample's own write time instead, which is what distinguishes them: 15:33:55 (the
terminated session) against 15:35:42 for `app_content_appeared_ms_count`,
`app_native_launch_ms_count` and `app_starts_total` from the live profiled run.

Same reason the audit says to read these per session and never aggregate: each
cold start is a new process, so the transport's cumulative accumulator restarts
and `_count` is 1 per launch.
