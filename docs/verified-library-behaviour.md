# Verified library behaviour

The probe record behind CLAUDE.md's one-line verification stamps. Each entry
pins a rule to what the INSTALLED package actually does: the claim, the
version it was verified against, the mechanism in the library's own source,
and a command that re-derives it. **If a rule changes, re-run its probe and
update the entry — a rule without a live check is a hypothesis.** All entries
last verified 2026-08-23.

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
