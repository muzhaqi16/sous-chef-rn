# Reanimated

What applies to Reanimated in this app beyond the CLAUDE.md rules and the
[verified library behaviour](verified-library-behaviour.md) entries.

## CSS for state and loops, shared values for the rest

Reanimated 4's docs put it plainly: "Reach for CSS transitions whenever an animation is
driven by _state_", and CSS animations for "self-contained, declarative motion: loading
spinners, pulsing badges, looping attention-grabbers". Shared values are for
"gesture-driven or scroll-driven interactions, screen transitions, or several animations
orchestrated together".

- **A state change that moves one node is a CSS transition** (`ExpandChevron`,
  `ProgressBar`, `HomeCard`'s highlight, `Reveal`). It is attached from the node's first
  commit, so the first value shows at once (see the baseline-commit entry in
  [verified library behaviour](verified-library-behaviour.md)).
- **A loop that runs by itself is a CSS animation** (`SkeletonBase`'s shimmer, the barcode
  scan line, `GestureDemo`), with `css.keyframes` and the period as a literal.
- **Both are gated by `useMotionEnabled()`.** CSS motion ignores reduce motion, so a
  transition is left off and a loop is not mounted or stands still.
- **Shared values stay where CSS cannot do the job:**
  - gestures and scroll;
  - Skia and other live values;
  - a slide that must follow the selection but not a relayout (`ModeTabs`,
    `SegmentedControl`);
  - motion orchestrated across nodes, springs or a completion callback (the add menu,
    `AlertProvider`, `AnimatedChip`, `CompletionHero`).
- Themed values stay off a CSS-animated node as they do off any Reanimated node: a
  theme-only `useAnimatedStyle` over `useAnimatedTheme()`, or a child.
- Curves come from `motion.cssEasing`, which mirrors `motion.easing` (Reanimated's
  `Easing.ease` is CSS `ease-in`).
- A worklet callback passed to a Reanimated hook, an animation's callback or an RNGH
  gesture hook carries no `'worklet'` directive: the Worklets plugin adds it. A helper
  called from a worklet still needs one.

## Layout animations run on the new engine

Reanimated's new layout-animation engine is the default, and the app runs on it. The app
has 54 `entering`/`exiting`/`layout` props in 18 files. The ones that break visibly when the
engine regresses are listed under [Device checks](#device-checks).

### Fallback flag

If the engine regresses something, switch back to the legacy engine in `package.json` and
rebuild natively. The flags are read at pod install and Gradle configuration time. The
legacy engine can't run shared element transitions, which are on by default, so the
fallback turns them off too:

```json
"reanimated": {
  "staticFeatureFlags": {
    "USE_LEGACY_LAYOUT_ANIMATIONS_PROXY": true,
    "ENABLE_SHARED_ELEMENT_TRANSITIONS": false
  }
}
```

Report the regression upstream: the legacy engine is a stopgap. The flag is also the maintainers' workaround for
[#10734](https://github.com/software-mansion/react-native-reanimated/issues/10734), an
Android SIGSEGV in `MountingCoordinator::pullTransaction` that is still open.

## Upgrading Reanimated

- **Bump Reanimated and Worklets in one command.** Each Reanimated minor pins one Worklets
  minor (`react-native-worklets@0.14.x` for 4.8), and each pins a range of React Native
  minors that `pod install` and Gradle enforce (`compatibility.json` in the package). Both
  are native: run `pod install`, then rebuild iOS and Android.
- **Run the Babel gate:** `npm run check:compiler-bailouts`. It compiles through the Worklets
  Babel plugin, which has to stay last.
- **Run the library test:** `npx jest src/theme/__tests__/reanimatedReduceMotion.library.test.ts`,
  plus the re-checks under the Reanimated entries in
  [verified library behaviour](verified-library-behaviour.md).
- **Check the deep imports into Reanimated.** `react-native-gesture-handler` imports
  `react-native-reanimated/src/createAnimatedComponent/NativeEventsManager`, and
  `@shopify/react-native-skia` imports `react-native-reanimated/lib/typescript/commonTypes`.
- **Jest is no signal.** `__tests__/setup/mocks/react-native-reanimated.js` replaces the
  library wholesale, so a green suite says nothing about the engine.
- **Run the [device checks](#device-checks)**, on a release build for anything that looks
  janky. Don't run them while a native build is going: under that load the shopping list's
  pager can stall mid-transition, which looks like a regression and isn't.

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
  `CuisineSelector` and onboarding's `StaplesPicker`. Toggle chips quickly.
- The Add a meal sheet's dim must hold after the sheet settles and release on close.

**Shared element transition:** open a pantry item with recipe suggestions, tap a recipe
card, and watch its image fly into the hero; go back and watch it return. Try it with the
item screen scrolled, and with a back swipe cancelled halfway.

**Small enter/exit toggles:**

- `BaseInput` error message: submit an invalid form, then fix it
- `CollapsibleChipPicker`, `UnitPicker`, `StorageLocationAdvancedSection`,
  `ShareCodeSection`, `EmptyState`, `HomeStats`

## The keyboard handler's `[]` stays

`AuthFormTemplate.tsx` passes `[]` as the deps of `useGenericKeyboardHandler`. Keep it:
keyboard-controller uses it as the deps of its own `useLayoutEffect`, so removing it
re-registers the keyboard handler on every render.

## Shared element transitions

A `CachedImage` given a `sharedTransitionTag` flies to the image with the same tag on the
next screen: a recipe card on `PantryItemDetail` into the `RecipeDetail` hero, and back.

- **Every leaf screen sits in a `SharedTransitionBoundary`** that is active while the
  screen is focused (`ScreenBoundary`). The screen layouts in
  `src/navigation/layouts/TopInsetLayout.tsx` add it, so a screen gets it from its
  navigator. A screen that is itself a navigator takes `navigatorScreenLayout`, which adds
  none: a boundary around a navigator pairs its screens' tags with the wrong screen.
- **Both ends use the same native component and the same style.** `CachedImage` renders
  the animated `TurboImage` and sets its one `SharedTransition` (`motion.timing.SLOW`, the
  standard curve) whenever it has a tag, and a transition runs the style of the view it
  starts from, so both directions match. The builder stays out of `motion`: worklets
  capture that object whole, and a builder can't be copied to the UI runtime.
- **The target mounts with the screen.** A tagged view that mounts later, after its data
  loads, doesn't move. `RecipeDetail` draws its hero from the opening hint's image before
  the recipe arrives, the same URL the card shows.
- **A tag is used once per screen.** Build it from the item's key, as
  `recipe-image-${providerRecipeId}` does.
- Reduce Motion skips the transition, and both views show in their own places.
