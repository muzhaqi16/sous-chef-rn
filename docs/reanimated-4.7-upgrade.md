# Reanimated 4.7 upgrade — assessment

**Status: deferred until 4.7.1.** Assessed 2026-09-22 against
`react-native-reanimated@4.7.0` (released 2026-09-18) and `react-native-worklets@0.13.0`
(released 2026-09-21). The app stays on **Reanimated 4.6.0 + Worklets 0.12.1** on RN 0.86.3.

The upgrade needs no source changes. Its cost is device QA: 4.7 swaps the engine under
every layout animation in the app, and nothing in it unblocks work we have. Revisit when
4.7.1 ships; the [cherry-pick thread](https://github.com/software-mansion/react-native-reanimated/issues/10656)
was already open on the day of this assessment.

Upstream notes: [Reanimated 4.7.0](https://github.com/software-mansion/react-native-reanimated/releases/tag/4.7.0)
· [Worklets 0.13.0](https://github.com/software-mansion/react-native-reanimated/releases/tag/worklets-0.13.0)

## Why it was deferred

1. **The new layout-animation engine became the default in 4.7.0.** The same release fixes
   crash-class bugs in it: a view flattened while a child is removed, and exiting
   animations while a surface is torn down. It had been the default for four days when this
   was assessed. Our exposure is 54 `entering`/`exiting`/`layout` props in 18 files (see
   [Device QA](#device-qa)), including exit crossfades that sit on the FlashList first-layout
   gate.
2. **Nothing in 4.7 is needed yet** (see [What 4.7 brings](#what-47-brings)). RN 0.88 is the
   only forcing function, and 4.6 already supports RN 0.83–0.87. RN 0.87.1 was the current
   stable release when this was assessed.
3. **The ecosystem hasn't caught up.** `@gorhom/bottom-sheet@5.2.14` (already the latest,
   from May 2026) has no 4.7 testing. `react-native-keyboard-controller@1.22.5` still calls
   an animated ref as a function on the UI thread in `KeyboardChatScrollView`, which 4.7
   breaks. We don't use that component, but it shows the library hasn't adapted to 4.7 yet.

## What 4.7 brings

| Change | Relevant to us |
| --- | --- |
| New layout-animation engine is the default | **Yes — the risk.** Fallback: [`USE_LEGACY_LAYOUT_ANIMATIONS_PROXY`](#fallback-flag) |
| Shared element transition fixes (still experimental) | No. `ENABLE_SHARED_ELEMENT_TRANSITIONS` is off, so the `sharedTransitionTag`s on recipe images do nothing |
| `backgroundImage` gradients in `useAnimatedStyle` | No. `EdgeFade` is a static SVG gradient |
| More CSS transitions run on Android's platform path (behind a flag) | No. We use no CSS transitions (the `animationDuration` hits are navigator options) |
| RN 0.86–0.88 support; RN 0.83–0.85 dropped | Only for a future RN 0.88 bump |
| "Dependencies should only be used on web" warning shown once per call site ([#10562](https://github.com/software-mansion/react-native-reanimated/pull/10562)) | **Yes — the one concrete gain.** gorhom passes deps to about 30 Reanimated hooks and has no fixed release ([gorhom#2758](https://github.com/gorhom/react-native-bottom-sheet/issues/2758)), so 4.6 logs the warning on every sheet render |
| Worklets 0.13: WorkletsModule starts on a background thread, Hermes microtask queue, runtime teardown under the runtime lock | Plausible startup gain, unmeasured. Measure a release build on device before claiming it |
| Worklets 0.13: networking on worklet runtimes, OXC Babel plugin | No. Both apply to Bundle Mode only, which we don't use |

## Breaking changes checked against this codebase

| Breaking change | Our exposure |
| --- | --- |
| Mutables always use Synchronizable; the `USE_SYNCHRONIZABLE_FOR_MUTABLES` flag is removed | None. The flag already defaulted to `true` in 4.6.0, so `makeMutable` in `OverlayBackdropProvider` behaves the same |
| `AnimatedRefOnUI` is a Shareable read with `.value`, not called; `AnimatedRefOnJS` is renamed `AnimatedRefOnRN`; `measure` on an unmounted ref returns `null` | None. Our only animated-ref use is `scrollTo(animatedRef, …)` in `src/hooks/ui/useCenterActiveItem.ts`, and neither type name is referenced |
| Worklets 0.13 stores worklet closures as arrays instead of objects | None. Nothing in `src/`, `scripts/` or test setup reads `__closure`. Skia reads it with `Object.values(mod.__closure ?? {})`, which works on arrays; gesture-handler only types it |
| Worklets 0.13 removes `SerializableInitializer` / `createSerializableInitializer` | None. We use only `scheduleOnRN` from Worklets (12 files) |
| New layout-animation engine | See [Device QA](#device-qa) |

Dependencies were checked too:
- `react-native-gesture-handler@3.3.0` deep-imports
  `react-native-reanimated/src/createAnimatedComponent/NativeEventsManager`. That file is
  byte-identical in 4.7.0.
- `@shopify/react-native-skia@2.11.2` deep-imports
  `react-native-reanimated/lib/typescript/commonTypes`, which still exists.
- The Worklets Babel plugin option we set in `babel.config.js` (`strictGlobal`) still
  exists in 0.13.

**Type check:** `src/` compiled with 0 errors against the 4.7.0 and 0.13.0 type
definitions. This used a scratch tsconfig whose `paths` pointed the two packages at
unpacked tarballs, without changing the repo. It covers types only, not native or runtime
behaviour.

**Reduce motion:** the claim in
[Reanimated applies reduce motion itself](verified-library-behaviour.md#reanimated-applies-reduce-motion-itself)
still holds in the 4.7.0 source, checked by reading the source. `getReduceMotionFromConfig`
still reads `isReduceMotionOnUI.value`, `timing`/`spring`/`repeat` still pass their config
through `getReduceMotionForAnimation`, and `BaseAnimationBuilder` still initialises
`reduceMotionV = ReduceMotion.System`. The probe still has to be re-run after the upgrade
(see [Procedure](#procedure)).

**UIScene crash queued for 4.7.1** ([#10587](https://github.com/software-mansion/react-native-reanimated/pull/10587),
`useAnimatedKeyboard` on an app delegate without `window`): doesn't apply to us.
`ios/SousChef/AppDelegate.swift` still declares `window` after the 2026-09-21 UIScene
migration, and `src/` doesn't call `useAnimatedKeyboard`.

## When 4.7.1 ships

Re-check before starting:

```bash
gh release view 4.7.1 -R software-mansion/react-native-reanimated     # layout-animation fixes?
npm view react-native-reanimated@4.7.1 peerDependencies               # still worklets 0.13.x, RN 0.86+?
gh issue list -R software-mansion/react-native-reanimated --state open \
  --search "layout animation in:title created:>=2026-09-18"           # regressions in the new engine
gh issue list -R gorhom/react-native-bottom-sheet --search "reanimated 4.7"
gh issue list -R kirillzyusko/react-native-keyboard-controller --search "reanimated 4.7"
```

Proceed if the new engine's open issues don't match anything in [Device QA](#device-qa).

## Procedure

1. **Bump both packages in one command.** Reanimated 4.7 requires `react-native-worklets`
   `0.13.x` exactly, and our current `^0.12.1` range can't satisfy it:
   ```bash
   npm install react-native-reanimated@^4.7.1 react-native-worklets@^0.13.0
   cd ios && bundle exec pod install
   ```
   Both packages are native: rebuild iOS and Android, since a Metro reload isn't enough.
2. **Source changes:** none expected. If `npm run typecheck` disagrees, the break is new in
   4.7.1.
3. **Gates:** `npm run typecheck && npm run lint`, then `npm run check:compiler-bailouts &&
   npm run check:unistyles-variants`. The last two matter because the Worklets Babel
   plugin's output changed, and the plugin order Unistyles → scope crawl → React Compiler
   is load-bearing. Then run scoped jest over the animated components. The Reanimated jest
   mock (`__tests__/setup/mocks/react-native-reanimated.js`) replaces the library
   wholesale, so a green suite says nothing about the new engine.
4. **Re-verify reduce motion:** run `node scripts/probe-reanimated-reduce-motion.mjs` and
   update the "Verified … against" line in
   [verified-library-behaviour.md](verified-library-behaviour.md#reanimated-applies-reduce-motion-itself).
5. **Device QA:** run the list below on iOS and Android, on a release build for anything
   that looks janky.

### Device QA

Ordered by risk. Exit animations come first because the new engine rewrote how exiting
views are held.

**Exit crossfades over mounting content.** These hand off to the FlashList first-layout
gate. Watch for a skeleton that never leaves, a flash of empty list, or a crash when you
switch tabs mid-fade.
- `src/features/shoppingList/components/ShoppingListTabs/ShoppingTab.tsx` and
  `PurchasedTab.tsx`: the skeleton overlay's `exiting={FadeOut}`
- `src/features/pantry/components/PantryListSkeletonOverlay.tsx`
- `src/components/performance/DeferredScreen.tsx`: the placeholder crossfade on the Pantry,
  Meal plan, Recipes and Shopping list tabs

**Layout transitions driven by state or the keyboard:**
- `src/features/auth/components/AuthFormTemplate.tsx`: `LinearTransition` timed to the
  keyboard. Open and dismiss the keyboard, and drag-dismiss it, on login and register.
- `src/features/home/screens/HomeManagement.tsx`: the create/join form (`FadeInDown` /
  `FadeOutUp` / `LinearTransition`) and the staggered home rows
- `src/features/profile/screens/DietaryProfileScreen.tsx`: staggered `FadeIn` sections
  with `LinearTransition`
- `src/components/organisms/AnimatedItemSelector/`: `SelectorContent.tsx` and
  `ActionButtons.tsx`

**Inside bottom sheets.** The new engine now runs inside gorhom's portal.
- `src/components/molecules/AnimatedChip.tsx`: reached through `MultiSelectChipSheet`,
  `CuisineSelector` and onboarding's `SelectPantryItems`. Toggle chips quickly.
- `src/features/shoppingList/components/SheetTutorialHint.tsx`

**Small enter/exit toggles:**
- `BaseInput` error message: submit an invalid form, then fix it
- `CollapsibleChipPicker`, `UnitPicker`, `StorageLocationAdvancedSection`,
  `ShareCodeSection`, `EmptyState`, `HomeStats`

### Fallback flag

If the new engine regresses something that 4.7.1 doesn't fix, switch back to the old
engine in `package.json` and rebuild natively. The flag is read at pod install and Gradle
configuration time:

```json
"reanimated": {
  "staticFeatureFlags": { "USE_LEGACY_LAYOUT_ANIMATIONS_PROXY": true }
}
```

It can't be combined with `ENABLE_SHARED_ELEMENT_TRANSITIONS`. Report the regression
upstream: the legacy engine is a stopgap.

## Until then: installing packages that depend on Reanimated

`"react-native-reanimated": "^4.6.0"` lets npm float to 4.7.0 whenever it re-resolves a
dependency on Reanimated. Adding a package such as `react-native-keyboard-controller`
then fails with `ERESOLVE … peer react-native-worklets@"0.13.x" from
react-native-reanimated@4.7.0`. To avoid that, pin both packages to their locked versions
in the same command:

```bash
npm install <package>@<version> react-native-reanimated@4.6.0 react-native-worklets@0.12.1
```

This is how `react-native-keyboard-controller` went to 1.22.5 on 2026-09-22. That release
([their #1621](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1621))
stops passing our `useGenericKeyboardHandler(…, [])` deps into Reanimated's `useHandler`,
which is the source of the "dependencies should only be used in web implementation"
warning at `AuthFormTemplate.tsx`. Keep that `[]` in place: keyboard-controller also uses it
as the deps of its own `useLayoutEffect`, so removing it re-registers the keyboard handler
on every render.

In that session, npm 11.7.0 updated `package.json`, the lockfile and
`node_modules/.package-lock.json`, but left the old package files on disk. Check the version
installed on disk (`node -p "require('<package>/package.json').version"`). If it's stale,
delete `node_modules/.package-lock.json` and run `npm install`.

## Adjacent finding

`src/components/atoms/CachedImage.tsx` renders an `Animated` image wrapper whenever
`sharedTransitionTag` is set. The tag is set in `RecipeHeroImage` and `PantryItemDetail`.
With `ENABLE_SHARED_ELEMENT_TRANSITIONS` off, those images pay for the wrapper and get no
transition. Either enable the flag, which is still experimental in 4.7, or drop the tags.
The decision isn't tied to this upgrade.
