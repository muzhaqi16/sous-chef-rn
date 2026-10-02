# Reanimated

What applies to Reanimated in this app beyond the CLAUDE.md rules and the
[verified library behaviour](verified-library-behaviour.md) entries.

## Layout animations run on the new engine

Reanimated's new layout-animation engine is the default, and the app runs on it. The app
has 54 `entering`/`exiting`/`layout` props in 18 files. The ones that break visibly when the
engine regresses are listed under [Device checks](#device-checks).

### Fallback flag

If the engine regresses something, switch back to the legacy engine in `package.json` and
rebuild natively. The flag is read at pod install and Gradle configuration time:

```json
"reanimated": {
  "staticFeatureFlags": { "USE_LEGACY_LAYOUT_ANIMATIONS_PROXY": true }
}
```

It can't be combined with `ENABLE_SHARED_ELEMENT_TRANSITIONS`. Report the regression
upstream: the legacy engine is a stopgap. The flag is also the maintainers' workaround for
[#10734](https://github.com/software-mansion/react-native-reanimated/issues/10734), an
Android SIGSEGV in `MountingCoordinator::pullTransaction` that is still open.

## Upgrading Reanimated

- **Bump Reanimated and Worklets in one command.** Each Reanimated minor pins one Worklets
  minor (`react-native-worklets@0.13.x` for 4.7). Both are native: run `pod install`, then
  rebuild iOS and Android.
- **Run the Babel gates:** `npm run check:compiler-bailouts` and
  `npm run check:unistyles-variants`. Both compile through the Worklets Babel plugin, which
  sits at the end of the load-bearing plugin order.
- **Re-run the probes:** `node scripts/probe-reanimated-reduce-motion.mjs`, plus the
  re-checks under the Reanimated entries in
  [verified library behaviour](verified-library-behaviour.md).
- **Check the deep imports into Reanimated.** `react-native-gesture-handler` imports
  `react-native-reanimated/src/createAnimatedComponent/NativeEventsManager`, and
  `@shopify/react-native-skia` imports `react-native-reanimated/lib/typescript/commonTypes`.
- **Jest is no signal.** `__tests__/setup/mocks/react-native-reanimated.js` replaces the
  library wholesale, so a green suite says nothing about the engine.
- **Run the [device checks](#device-checks)**, on a release build for anything that looks
  janky. Don't run them while a native build is going: under that load the shopping list's
  `UIPageViewController` can stall mid-transition, which looks like a regression and isn't.

## Device checks

Ordered by risk. Exit animations come first, because they hand off to other machinery.

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

**Row reflow (CSS transitions).** Delete a row on the pantry and the shopping list, and
watch the rows below slide up (`useRowReflow`).

**Inside bottom sheets**, where the engine runs inside gorhom's portal:

- `src/components/molecules/AnimatedChip.tsx`: reached through `MultiSelectChipSheet`,
  `CuisineSelector` and onboarding's `SelectPantryItems`. Toggle chips quickly.
- `src/features/shoppingList/components/SheetTutorialHint.tsx`
- The Add a meal sheet's dim must hold after the sheet settles and release on close.

**Small enter/exit toggles:**

- `BaseInput` error message: submit an invalid form, then fix it
- `CollapsibleChipPicker`, `UnitPicker`, `StorageLocationAdvancedSection`,
  `ShareCodeSection`, `EmptyState`, `HomeStats`

## The keyboard handler's `[]` stays

`AuthFormTemplate.tsx` passes `[]` as the deps of `useGenericKeyboardHandler`. Keep it:
keyboard-controller uses it as the deps of its own `useLayoutEffect`, so removing it
re-registers the keyboard handler on every render.

## Shared-element tags do nothing

`src/components/atoms/CachedImage.tsx` renders an `Animated` image wrapper whenever
`sharedTransitionTag` is set, and `RecipeHeroImage` and `PantryItemDetail` set it. With
`ENABLE_SHARED_ELEMENT_TRANSITIONS` off, those images pay for the wrapper and get no
transition. Either enable the flag, which is still experimental, or drop the tags.
