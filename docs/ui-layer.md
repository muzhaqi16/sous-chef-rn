# UI layer — mechanisms

The reasoning behind CLAUDE.md § UI layer. CLAUDE.md states each rule and names
what holds it; this page carries the mechanism, the evidence and the traps. Where
a mechanism is pinned against an installed library, the probe lives in
[`verified-library-behaviour.md`](verified-library-behaviour.md) and is linked
rather than repeated.

## One mechanism per concern

Each row of CLAUDE.md's table is a concern the app solves ONCE. An alternative is
not a style difference: it loses what the canonical path already handles — a
theme that follows the colour scheme, a locale that follows the language, a
scroll container that arbitrates gestures, a key the session reset can find. The
"Held by" column is what fails when you reach past the mechanism. A row with no
gate is one nobody has been able to express as a check yet, not one that is
optional:

- **A list row** is composed from views, so nothing tells it from any other row
  of views.
- **A shared actions bag** (`createActionsContext`) is a context holding
  callbacks, indistinguishable by shape from any other context.
- **Where a value lives** is a choice not visible at any one call site.
- **A duration, spring or curve** is convention at or below the 300 ms scale
  ceiling; above it the number is a loop's own period.

## Screen scaffold and sheet shell

- **`Screen`** (`src/components/templates/Screen.tsx`) takes `header`
  (`standard | tab | none`, plus title, actions, back, close and the
  offline pill), `scroll` (`none | scroll | form | list`), `gutter`, `refresh`,
  `state`, `footer`, and — in `scroll` mode — `onScroll` (an animated scroll
  handler) and `scrollTestID`. It never applies the top inset: the navigator
  does, and `__tests__/navigation/screenTopInset.test.tsx` renders the
  composition to prove the inset lands once. A bare `<SafeAreaView>` with no
  `edges` insets all four sides, and is the usual way a second inset happens.
- **One geometry.** A header bar's first and last glyphs sit on the page gutter:
  `commonStyles.barInset` pads by `pageGutter − (touchTarget.md − icon.md) / 2`,
  so a 24pt icon centred in its 44pt target starts where content does. `Header`
  and `CollapsingHeroDetail`'s bar both use it and are both 60pt tall
  (`__tests__/ui/headerGeometry.test.tsx`). Standard titles are always centred.
- **One gutter.** `gutter="page"` (the default) is the only way a screen states
  its horizontal inset; `gutter="none"` is for a `scroll="list"` screen whose
  list owns its content inset. Content below the scaffold carries no edge inset
  of its own (`__tests__/ui/pageGutterHasOneAuthor.test.ts`).
- **Trailing space.** `scroll | form | none` pad by the bottom inset plus
  `layout.pageBottom`; a `footer` takes the inset instead. A `list` child reads
  the same value from `useScreenListInset()`.
- **Back or close.** A pushed screen shows back; one presented from the bottom
  (modal or `slide_from_bottom` card) shows close in the same slot.
- **Presets.** `SubScreen` is a pushed screen whose back returns to the previous
  screen; `FormScreen` a full-screen form (close + save); `DetailTemplate` a
  screen of card sections; `PaginatedHistoryScreen` a `SubScreen` over one
  paginated list; `AuthWrapper` and `OnBoardingWrapper` the auth and onboarding
  shells. A pushed screen whose back is plain `goBack` is `SubScreen`, never
  `Screen` with a hand-built `back`. A form sheet's header is `SheetHeader`
  (close, centred title, primary confirm); only templates render `Header`.
  `__tests__/ui/screenUsesTheScaffold.test.ts` holds all of this.
- **`Sheet`** (`src/components/templates/Sheet.tsx`) takes
  `view | form | action | list`. `form` supplies both the keyboard offset and
  the input context, so inputs inside resolve to gorhom's `BottomSheetTextInput`.
  `list` hands its child to the modal directly. `view` renders
  `BottomSheetView`, which is absolutely positioned with no height, so a
  `flex: 1` list inside it sizes to its own content and never scrolls — a sheet
  holding a scrollable that fills its parent therefore uses `list`
  ([gorhom BottomSheetView cannot bound a scrollable](verified-library-behaviour.md#gorhom-bottomsheetview-cannot-bound-a-scrollable)).
  `__tests__/sheets/bottomSheetShell.test.ts` holds the shell and
  `__tests__/ui/viewSheetScrollableIsBounded.test.ts` holds the `list` rule.
- **`FormScreen`** is a screen with a form's chrome. The name is the only thing
  it shares with a modal.

## The list row

Four shells compose one row — `BaseItemCard` (pantry), `ListItem` (shopping list,
meal plan), `ItemCard` and `RecipeCardView` — so the row lives in one place and
they read it.

- **Geometry** is `commonStyles.rowWrapper` (the row's place in the list),
  `rowSurface` (its card) and `rowContent` (the slot layout inside it), in
  `src/styles/commonStyles.ts`. Their steps are the named `theme.layout.row*`
  tokens (`rowInset`, `rowSlotGap`, `rowTextGap`, `rowGap`), so
  density scales them. Held in four separate copies, the steps drift into three
  paddings, three row gaps and two radii; one definition cannot drift.
- **Text** is `rowType` (`src/theme/foundations/type.ts`): `title` for the row's
  name and its trailing value, `subtitle` for everything supporting them. A shell
  names the role through `rowType`, never as a literal, so no screen can pick its
  own row title size.
- **A thumbnail carries no margin.** `rowContent`'s `gap` spaces every slot; a
  margin on top of it double-spaces the one slot that has it.
- **A skeleton row uses the same three primitives**, so its container adds no
  gap: `rowWrapper` already carries the row gap, and a container that spaces
  double-spaces it.
- **The skeleton owns the gutter exactly when the real list does.** `rowWrapper`
  has no horizontal inset by design, because the list rendering the row owns it,
  so the answer depends on where the skeleton sits:
  - Nested inside the real list's padded `contentContainerStyle` (the pantry
    flap, absolute inside `ListHeaderComponent`), it inherits the inset and adds
    none.
  - A standalone sibling list overlaid on the real one (`SkeletonList` under the
    shopping tabs) is a second list and reproduces the gutter itself, or the
    whole skeleton sits flush against the screen edge.

## Unistyles

- **`StyleSheet.create(theme => …)`** pushes theme changes straight to native
  through the C++ ShadowTree, with no React re-render — as long as theme reads
  happen inside the factory. `styles.useVariants({ … })` carries runtime flags
  instead of conditional theme reads. One element takes one `styles.*` entry,
  merged with a caller style as `style={[styles.x, callerStyle]}`: Unistyles 3
  styles are proxies, and two of them spread through reanimated's
  `StyleSheet.flatten()` lose their native binding
  ([`combinedUnistyles`](rules/restricted-syntax.md)).
- **`withUnistyles(Component)`** wraps a third-party component taking
  theme-derived props, so only the wrapper re-renders on a theme tick. Shared
  wrappers live in `src/components/atoms/themedComponents.tsx`
  (`ThemedBottomSheetTextInput`, `ThemedActivityIndicator`,
  `OnPrimaryActivityIndicator`, …); a new one goes there, not in a feature file.
  Switches use `BaseSwitch` (`src/components/atoms/BaseSwitch.tsx`); themed icon
  colours use `<Icon tone="X" />` (`src/utils/iconUtils.tsx`), and the glyph
  package itself is an import ban.
- **A node reanimated animates takes no themed Unistyles style**
  ([`sous-chef/animated-node-takes-no-themed-style`](rules/animated-node-takes-no-themed-style.md)).
  Reanimated renders its animated prop's React-side value into the host's style
  array. Unistyles links those plain objects to the node, and after a theme
  rebuild its non-React commits write them back over the animation. The view
  then shows a stale value until its next React re-render. The global dim
  (`GlobalBackdrop`) snapped off at the end of every sheet open this way
  ([Unistyles re-applies reanimated's React-side value](verified-library-behaviour.md#unistyles-re-applies-reanimateds-react-side-value-over-an-animation)).
  The node's static key keeps only structure. Themed values go in a
  `useAnimatedStyle` of their own that reads only `useAnimatedTheme()`, which
  re-runs on a theme change and never per frame (`Toast`, `AlertProvider`,
  `FloatingTabBar`). Or they sit on a non-animated parent or child
  (`GlobalBackdrop`, `SkeletonBase`, the list rows' `rowWrapper`).
- **Never wrap `Pressable`/`TouchableX` with `withUnistyles`.** The wrapper
  copies a function-style `style={({ pressed }) => [...]}` into `{}`. RN's
  `Pressable` needs no wrapper, because the Unistyles Babel plugin binds it to
  the ShadowTree itself
  ([withUnistyles drops function styles](verified-library-behaviour.md#unistyles-withunistyles-drops-function-styles)).
- **`useUnistyles()` is for runtime metadata** (`rt.colorScheme`, `rt.themeName`,
  `rt.insets`). Reading `theme.*` through it re-renders the whole component on
  every theme change. The deliberate exceptions are each a cross-library
  hand-off:
  - `useTheme` / `ThemedStatusBar`;
  - `RootNavigator.Navigation`, which builds React Navigation's `Theme`;
  - `TrendLineChart` and `SpotlightCoachMark`, which pass colours into Skia
    draw calls;
  - `BreakdownPieChart`, which hands colours to the chart library as data;
  - `RecipeMain`, `RecipeSearchInput` and `SortableShoppingList`, which put
    theme colours into data structures.
  - `EdgeFade`, which passes colours into SVG gradient stops;
  - `SearchBar`, which offsets a measured rect by `theme.spacing.sm` in JS.
- **Plugin order is Unistyles → `unistyles-scope-crawl` → React Compiler**
  (`babel.config.js`): the documented order with a crawl between. Unistyles'
  `useVariants` rewrite declares a shadowing binding without `scope.crawl()`;
  without the crawl the compiler cannot lower the function and skips it. With
  the compiler FIRST the file compiles, but the variant-resolved style is cached
  on the wrong dependencies and freezes at its first-render value — memoized,
  zero bailouts, and silently wrong. The measured three-way table is in
  [the useVariants scope re-crawl entry](verified-library-behaviour.md#unistyles-usevariants-rewrite-needs-a-scope-re-crawl-before-the-compiler);
  `scripts/check-unistyles-variant-staleness.mjs` is the ongoing cover.
- **A host that mounts its children later than they were created wraps them in
  `CurrentThemeScope`.** A `styles.x` read is a snapshot, and the compiler caches
  an element against its other dependencies, so a parent that outlives a theme
  change can hand a host elements carrying the old theme's colours. Unistyles
  updates MOUNTED views natively, but corrects a snapshot at mount only inside a
  scoped theme (`HybridShadowRegistry::link`), so the stale colours stick until
  the next theme change. The sheet wrapper (`#hooks/useStandardBottomSheet`,
  which `ActionTray` uses too), the `Modal` re-export in `themedComponents`
  (RN's is banned) and `CollapsibleSection` carry it; a new host that gates
  `children` on its own open state adds it. A component rendering its own JSX
  needs nothing: the condition it mounts on is a dependency of that JSX.

## Typography roles

- **The eleven roles** live in `src/theme/foundations/type.ts`: `display`,
  `title`, `subheading`, `heading`, `body`, `bodyStrong`, `caption`, `label`,
  `footnote`, `footnoteStrong`, `error`. Each carries size, weight, leading and
  tracking together, and only those.
- **Colour is `tone`'s job**, so `role="error"` pairs with `tone="error"`. A role
  that carried a colour would decide it where the caller cannot see.
- **Error copy sets at the `error` role, whatever the text around it uses** — a
  field message, a failure line, a "not found" fallback, in the kit as in a
  feature. A red element that is not error copy (a destructive action's label, a
  required asterisk, an expired status, an error state's heading) is
  `tone="danger"` with its own role. `sous-chef/text-needs-role` holds both pairings.
- **An element that cannot take the prop** (a `TextInput`, a shared style module)
  spreads `...theme.type.<role>`.
- **`role` shadows RN's ARIA-style `role`**; this tree spells the accessibility
  role `accessibilityRole`.
- **`size`, `weight` and `lineHeight` are kit-only escape hatches** on `Text` — a
  breakpoint-mapped label, a 13px inset header. Outside `src/components/**` they
  are a second definition of a role that exists.
- **A stylesheet setting type properties itself** is the exception: a responsive
  size map, a 10px badge, a Skia draw call.
- **The font-scale ceiling is global.** The OS text size multiplies on top of the
  app's own 0.9–1.3 preference, which is already baked into the theme's numbers.
  So `theme.maxFontScaleMultiplier` is the remainder of `MAX_FONT_SCALE`, and the
  `Text` atom applies it. A per-element cap bounds only the OS half and leaves
  the product unbounded ([`maxFontSizeMultiplier`](rules/restricted-syntax.md)).

## Elevation & on-fill colour

- **The shadow ramp is per theme.** The geometry is shared and the ink is not: a
  4%-black shadow is invisible on charcoal, so `darkShadows` keeps the offsets
  and deepens the opacity.
- **`src/theme/foundations/shadows.ts` is the only place a `boxShadow` geometry is
  written.** A call site spreads a step (`...theme.shadows.md`). The exceptions
  are shadows whose COLOUR is the point, which no neutral step can express:
  - the FAB's brand glow;
  - the scanner's scan-line glow;
  - `commonStyles.shadow`'s primary tint.
- **Text or an icon on a fill reads that fill's `on*` token**, because the fill is
  user-overridable and the foreground follows its luminance. `onScrim` is the
  role for a ground the theme does NOT paint — over a photo, a camera preview, a
  dark overlay — and it stays light in both appearances. There is no
  `colors.white`.
- **`sous-chef/on-fill-text-uses-its-token`** catches the two per-file shapes: a
  raw white literal, and an `on*` token over a fill it does not name.
  **`__tests__/ui/onFillTextUsesItsToken.test.ts`** keeps what needs more than
  one file — a shared fill overridden locally — and the contrast maths.
- **`src/theme/__tests__/foundations.test.ts`** asserts light and dark declare the
  same colour, shadow and motion keys. A token defined in one theme only is
  invisible until someone switches appearance, and then the style silently drops.

## Motion

- **Where the tokens live:** `src/theme/foundations/motion.ts`, read as
  `theme.motion.timing.FAST` in a stylesheet and as `motion.timing.FAST` from
  the module elsewhere.
- **The scale stops at 300 ms.** A longer number is a loop's own period — a
  1500 ms shimmer, a 1200 ms bob — and stays a literal at its call site rather
  than becoming a token only one animation uses.
- **Reduce motion needs no branch.** Reanimated collapses `withTiming`,
  `withSpring`, `withRepeat` and the entering/exiting builders under the OS
  setting with no config, so the theme carries no zeroed motion twin
  ([Reanimated applies reduce motion itself](verified-library-behaviour.md#reanimated-applies-reduce-motion-itself)).
- **`useMotionEnabled()`** (`src/hooks/animations/useMotionEnabled.ts`) is the
  one `useReducedMotion` read. It is only for what a zero duration cannot stop:
  a loop's resting state, an ambient illustration.

## Pressable & gestures

- **Pick the `Pressable` by gesture system.** The default is `Pressable` from
  `#components/atoms/themedComponents`: RN's Pressable re-exported, which the
  Unistyles Babel plugin binds to the ShadowTree, so function-style styles and
  theme switches work with no wrapper. RN's Pressable does not take part in
  RNGH's gesture system. So inside a `Swipeable`, a
  `GestureDetector`/`Gesture.X` chain, or `RectButton`-style coordination, the
  control imports `Pressable` from `react-native-gesture-handler`.
- **Pick the `ScrollView` by what is inside it.** RNGH's `ScrollView` is only for
  a container with RNGH gesture components inside it; plain forms and settings
  screens use RN's.
- **A swipeable row needs an RNGH scrollable host.** RNGH cancels only v1/v2
  handlers when a native scrollable grabs the touch
  (`cancelAllLegacyHandlers`), and `ReanimatedSwipeable` runs on the v3
  detectors. Over a plain RN `ScrollView` the row's pan survives the takeover,
  accumulates horizontal drift for the whole drag, and opens rows mid-scroll. No
  `dragOffset` value fixes this, because the drift is unbounded. An RNGH
  scrollable restores arbitration through the orchestrator. The source chain,
  the on-device A/B and the `dragOffset` sign constraint are in
  [RNGH v3 handlers survive a native scroll takeover](verified-library-behaviour.md#rngh-v3-handlers-survive-a-native-scroll-takeover).
- **Every FlashList must decide its scroll host.**
  `sous-chef/flashlist-declares-scroll-component` makes every FlashList
  declare a `renderScrollComponent` — RNGH's, or gorhom's
  `BottomSheetScrollable` inside a sheet — or sit on an allowlist with a reason.
  It derives its file list from the tree, so a new list cannot skip the decision.
- **The refresh control must match the host.** RNGH's `ScrollView` hands its
  scroll gesture to the control as
  `cloneElement(refreshControl, { block: scrollGesture })`. Only a control built
  by `createNativeWrapper` (RNGH's own, which `ThemedRefreshControl` wraps) routes
  `block` into `useNativeGesture`; RN's control takes the prop and drops it.
  Given only `onRefresh`, FlashList builds RN's control itself
  (`useSecondaryProps.tsx`, `else if (onRefresh)`), so you get the wrong control
  without ever naming one. On the shopping list that control leaves an indicator
  hanging mid-list until it is pushed back up by hand. The mismatch in the other
  direction — RNGH's control in a plain RN scrollable — throws, so that host takes
  `PlainScrollRefreshControl`. The `withUnistyles` wrapper is transparent to
  either, since the gesture crosses by reference
  ([RNGH's scroll gesture reaches only RNGH's RefreshControl](verified-library-behaviour.md#rnghs-scroll-gesture-reaches-only-rnghs-refreshcontrol)).
- **A tab root's chrome sits above its list, never inside it.** The spinner
  drops from the scroll view's top edge and everything inside moves with the
  pull, so the header, search and filter tabs stay out of `ListHeaderComponent`;
  on every tab the spinner appears below still chrome. Pantry's test holds it
  (`keeps the header, search and tabs outside the refreshable list`).
- **The rule is about the host, not about FlashList.** A standalone RNGH scroller
  offering pull-to-refresh renders `SwipeAwareScrollComponent` too, never a
  hand-rolled RNGH `<ScrollView>`. The mechanism:

  1. RN turns `nestedScrollEnabled` on under a `refreshControl`
     (facebook/react-native#55189).
  2. That lets RNGH's `SwipeRefreshLayoutHook` fail the handler mid-pull.
  3. androidx ignores the ACTION_CANCEL that follows, so the Android spinner parks
     where the finger stopped. Only a pull past the trigger retracts it.

  `SwipeAwareScrollComponent` forces `nestedScrollEnabled={false}`. A hand-rolled
  host never reaches that shared prop, which is why the park reproduces on the
  meal plan and on no FlashList. The same test guards it.

- **Dropping the override is unmeasured.** RNGH ≥3.3.0 carries an upstream fix
  (`ScrollViewHook.shouldStopNestedScroll`, which gives androidx
  `onStopNestedScroll` → `finishSpinner()`), so removing the override is a live
  candidate. A synthetic hesitant pull does not reproduce the park even on 3.2.1,
  so only a real-finger A/B can settle it. Until one does, the override stays
  ([RNGH ends the nested scroll its ScrollView opens](verified-library-behaviour.md#rngh-ends-the-nested-scroll-its-scrollview-opens)).

## Bottom sheets

- **`BottomSheetModal`, never inline `BottomSheet`.** An inline sheet's backdrop
  conflicts with the global `OverlayBackdropProvider` + `GlobalBackdrop` system
  ([`backdrop-lifecycle-design.md`](backdrop-lifecycle-design.md)).
  `useStandardBottomSheet` (`src/hooks/useStandardBottomSheet.tsx`) drives it
  with a `visible` boolean and `onDismiss`; `present()`/`dismiss()` are called
  only inside the hook's own effects. It re-exports `BottomSheetModal`
  theme-wrapped, composes the backdrop claim into `modalProps.onChange`, and
  supplies the `animatedIndex` the backdrop's opacity follows — which is why
  neither may be overridden after the spread. `dismiss()` on a modal that was
  never presented wedges it closed for the session; the hook guards that and a
  raw ref does not.
- **Inputs in a sheet resolve to `BottomSheetTextInput`.** A plain RN `TextInput`
  leaves the sheet blind to the keyboard. `BottomSheetTextInput` throws outside a
  sheet, so shared inputs pick it from context —
  `useIsBottomSheetInput() ? ThemedBottomSheetTextInput : ThemedTextInput` — as
  `FormInput`, `FractionInput`, `EditableCounter` and
  `BottomSheetAutocompleteInput` do
  ([gorhom keyboard handling requires BottomSheetTextInput](verified-library-behaviour.md#gorhom-keyboard-handling-requires-bottomsheettextinput)).
- **A content-sized sheet (`enableDynamicSizing`) takes no keyboard-aware
  scrollable.** `KeyboardAwareScrollView` pads its content by the keyboard's
  height, and gorhom sizes the sheet to that content, so focusing a field grows
  the sheet by a whole keyboard and scrolls its header off the top. Such a sheet
  uses `BottomSheetView` (`PurchaseAmountSheet`, `QuantityEditSheet`) and lets
  gorhom's `interactive` lift seat it on the keyboard
  ([A keyboard-aware scrollable cannot size a sheet](verified-library-behaviour.md#a-keyboard-aware-scrollable-cannot-size-a-sheet)).
- **A fixed-snap-point sheet with inputs uses `BottomSheetFormScrollView`.** It is
  a gorhom-registered `KeyboardAwareScrollView` that also supplies the input
  context. The raw `BottomSheetKeyboardAwareScrollView` supplies the keyboard
  offset but not the input context, so its inputs would resolve to RN's; only
  `BottomSheetFormScrollView` may import it.
- **`bottomOffset` defaults to the density-scaled `theme.spacing.md`**, applied as
  a `withUnistyles` mapping in `BottomSheetKeyboardAwareScrollView` (sheets) and
  `ThemedKeyboardAwareScrollView` in `themedComponents.tsx` (full-screen forms).
  - Pass the prop only to override deliberately.
  - Never pass `undefined`: an explicit `undefined` overrides the mapping.
  - It measures from the input's bottom edge
    ([bottomOffset measures input bottom](verified-library-behaviour.md#keyboard-controller-bottomoffset-measures-input-bottom)).
- **Never wrap a scrollable in `BottomSheetView`.** This covers `FlashList` via
  `useBottomSheetScrollableCreator`, `BottomSheetScrollView` and
  `BottomSheetFlatList`. `BottomSheetView` is absolutely positioned with no
  bottom or height, so the list is never height-bounded and cannot scroll. Put
  the list in a plain `View style={{ flex: 1 }}`, as `IngredientSelectorSheet`
  and `AddMealSheet` do; a `maxHeight` list merely gets away with it.
  `BottomSheetAutocompleteInput.test.tsx`
  (`src/features/catalog/components/__tests__/`) guards it.

## Lists (FlashList v2)

- **`estimatedItemSize` does not exist** in FlashList 2.3.2's props, so passing it
  is a type error. No workalike replaces it.
- **A FlashList needs a height from its host.** Its root is `flex: 1`, so
  `flexBasis: 0`: it claims free space and contributes none. A container that
  sizes to its children therefore gives it zero height and no rows — silently,
  and invisibly to any test asserting on data or props. `FlatList` survives the
  same container because RN's `ScrollView` base style uses `flexBasis: auto`,
  which is why swapping one for the other empties a picker that worked. gorhom's
  `BottomSheetView` is the same trap from the other direction (absolute, no
  height). A bounded option set belongs in a scroll container that sizes to its
  content. `sous-chef/recycling-list-host-is-bounded` holds the rule.
- **`data` never comes from `useDeferredValue` or `startTransition`.** FlashList
  truncates its layout table during render and re-indexes cells only at commit.
  Only a transition render can be interrupted between the two, and a native
  `onLayout` landing in that gap is a production fatal
  (`index out of bounds, not enough layouts`). The mechanism, and the hooks that
  can defer internally, are in
  [`flashlist-layout-index-race.md`](flashlist-layout-index-race.md).
- **`perfCallbacks.CellRendererComponent` and `onCommitLayoutEffect`.**
  FlashList's own viewability is geometric and lags 250 ms, so the renderer is how
  blank cells are counted; the commit callback drives the `hasContentLayout`
  latch. The renderer is sampled per session, so `undefined` in an unsampled
  session is normal ([`flashlist-performance-analysis.md`](flashlist-performance-analysis.md)
  § Reading the instrumentation).
- **Skeleton release.** FlashList v2 holds every cell, sticky sentinel rows
  included, at `opacity: 0` until its progressive first layout commits. "Data
  ready" therefore precedes "rows visible" by 300 ms+ on a mid-range device, and a
  release on a loading flag exposes a header-only blank frame. `onLoad` cannot
  stand in for the latch: it fires once per mount, and a sentinel-only skeleton
  layout consumes it
  ([FlashList v2 first-layout opacity gate](verified-library-behaviour.md#flashlist-v2-first-layout-opacity-gate)).
- **The cover exists from the list's first commit.** A cover whose mount waits on
  a post-commit state update (an `onLayout` measurement, a deferred flag) is
  starved behind the row-mount storm it exists to hide. That is why the pantry's
  cover renders in the same pass as its list, as an absolute earlier sibling
  the cells paint over (`PantryListSkeletonOverlay.tsx`).
- **A settled empty list releases on `rowCount: 0`, not on a commit.** For data
  that goes empty to empty, FlashList commits once. That commit lands while the
  skeletons are still up, and the placeholder guard discards it — so a list
  waiting on a commit, with no rows to reveal, waits forever.
- **`InteractionManager` is a no-op stub in RN 0.86.3** (`runAfterInteractions`
  is `setImmediate`). Defer non-urgent work with `requestIdleCallback`
  ([InteractionManager is a no-op stub](verified-library-behaviour.md#interactionmanager-is-a-no-op-stub)).

## Autocomplete & dropdowns

- **`useAutocompleteSearch`** (`src/features/catalog/hooks/useAutocompleteSearch.ts`)
  backs every autocomplete hook.
- **`localFirst`** short-circuits the network on a local match, which is safe only
  when the warmed cache is complete for the dataset. The decision rule:

  - A complete reference set gets `localFirst: true` (units).
  - A bounded slice of a larger catalog gets `localFirst: !isOnline` (stores,
    brands and categories warm ~100 rows; items keep a seen-items LRU).

  Current assignments: `grep -rn "localFirst" src/features/catalog/hooks`.

- **Stale results are handled centrally** by the `lastFiredTerm` guard; a
  consumer hook implements no relevance check of its own.
- **Inline or modal picker inside a sheet: pick by result set, not by host.**
  `InlineAutocomplete` caps at 6 suggestions, so inline suits a set the user
  narrows by typing; a catalog needing its own search gets the modal picker.
- **A stacked picker sets `stackBehavior="push"`.** gorhom's default `'switch'`
  minimizes the host, which reads as a crash. Where it can, the picker also takes
  a snap point taller than its host; `snapPoint` is a prop, overridden per call
  site.
- **`DropdownStack`** (`src/components/atoms/DropdownStack.tsx`) exists because RN
  `zIndex` orders siblings only and Android view flattening prunes layout-only
  wrappers. A missed level in a hand-rolled chain paints the dropdown UNDER later
  inputs — on device only, invisible to typecheck, lint and Jest.

## Row actions

- **The `SwipeAction` shape.** `SwipeAction`
  (`src/components/organisms/SwipeableItem/types.ts`) is
  `{ key, icon, labelKey, onPress, testID?, haptic?, removesRow? }`. The same
  descriptors flow through `BaseItemCard`, `ItemCard` and `ItemList`.
- **`key` doubles as the accessibility action name**, so a swipe action and its
  VoiceOver/TalkBack equivalent cannot drift apart.
- **The testID** defaults to `kitTestIDs.swipeAction(testIDPrefix, key)`, which is
  `${testIDPrefix}-${key}`.
- **Universal and domain verbs.** Edit and delete are the only universal verbs,
  with builders in `SwipeableItem/commonActions.ts`. A domain-flavoured action
  belongs to its feature (`src/features/pantry/components/pantrySwipeActions.ts`).
- **`removesRow: true`** tells the row renderer (`ItemCard`, `SortableItem`) to
  slide the row out, calling FlashList's `prepareForLayoutAnimationRender()`
  first. `SwipeableItem` ignores it, since the swipe organism has no opinion
  about the list around it.

## Dynamic forms

- **`DynamicFormFields` renders a `component` NAME through a registry**, not a
  closed union.
- **The app supplies the registry once**, at the composition root:
  `FieldRendererProvider` in `App.tsx`, fed by
  `src/features/catalog/ui/catalogFieldRenderers.tsx`.
- **Field-specific callbacks travel in the field's `props` bag**, which the form
  forwards without reading.
- **`ownsErrorDisplay`** is set by an entry that renders its own validation
  message.

## Forms & validation

- **A field error goes on the field.** A modal alert covers the form and has to be
  dismissed before the field can be corrected. Once dismissed, it does not say
  which field it meant — or, in a paged sheet, which page. Alerts remain correct
  for SUBMISSION failures (a server refusal, a network throw), which are not a
  field the user can edit.
- **The form's shape.**
  - A yup schema sits next to the form, resolved through `yupResolver` on
    `useForm`.
  - Fields render through `Controller`, and Save goes through
    `handleSubmit(onValid, logValidationErrors)`.
  - The submit hook does not validate: reaching it means the form is already
    valid.
- **The schemas** are `shoppingItemFormConfig.ts` (shared by the AddEditItem
  screen and the AddToShoppingList sheet), `addPantryItemFormConfig.ts` and
  `pantryItemFormConfig.ts` (the edit form).
- **Schema messages resolve lazily** (`const msg = key => () => t(key)`, pattern
  in `src/utils/validation/common.ts`). A schema is built once at module scope,
  so an eagerly-resolved message freezes whichever language was active at
  import time. yup calls the function when the rule fails, which is after any
  language change.
- **A cross-field rule needs an explicit `trigger()`.**
  `setValue(field, v, { shouldValidate: true })` re-validates THAT field only:
  with a resolver, react-hook-form runs the whole schema but writes back only
  `errors[name]`. The all-or-nothing net-weight rule lives on the _unit_, while
  its inputs are the weight and the unit id. Without `trigger('netWeightUnit')`,
  typing a weight never raises the message and picking a unit never clears it.
- **Where a `Controller` owns the write**, the form has no `onChange` to hang the
  trigger on. It declares `rules={{ deps: ['otherField'] }}` instead
  (`FieldDef.deps` in `DynamicFormFields`), which react-hook-form turns into the
  same `trigger` call. Same concern, two spellings, picked by who writes the
  field.
- **A field a rule reads must live in the form.** A resolved autocomplete id kept
  in `useState` is invisible to the resolver, so its rule can never pass.
  `__tests__/forms/validationMessagesAreRendered.test.ts` derives the schema list
  from the tree.
- **A paged form maps field → page** (`FIELD_PAGE` in
  `addPantryItemFormConfig.ts`) and navigates before reporting, so the message is
  on screen rather than behind a tab the user has to find.
- **`dirtyFields` omits clean fields**, since react-hook-form never sets them
  `false`. Read it for truthiness (`if (dirtyFields.itemName)`), and assert
  `toBeUndefined()`, not `toBe(false)`.

## Quantities

- **`formatQuantityForDisplay`** (`src/utils/formatQuantity.ts`) renders a cooking
  fraction where one fits (`1/2`, `1/3`, `1/8`, `1 1/4`) and at most three
  decimals otherwise, since 1/8 is 0.125: 177.4412 reads `177.441`.
- **`formatQuantityForInput`** seeds an editable field. It writes a cooking
  fraction only where the fraction equals the value to three places (`0.33333334`
  → `1/3`, but `0.33` stays `0.33`), else the number rounded to three places in
  the device's decimal separator (`2,456` on a comma device). A `decimal-pad`
  field passes `notation: 'decimal'`, since its keypad has no `/`.
- **A deduction that reads as the whole stock is the whole stock**
  (`snapDeductionToCap`). A waste field seeded with 2.4566 shows `2.457`, which
  parses above the stock; it matches the stock in the seed's decimal or fraction
  form, or in the displayed form, so "use all of it" is never refused.
- **`QuantityDisplay`** maps the item's `DisplayFormat` and the unit's
  `displayAsFraction` onto its `notation`. Only an explicit
  `displayAsFraction: false` — a unit nobody halves — opts out of fractions.
- **`quantityInput` is re-formatted, never shown verbatim.** It holds the user's
  own text ("1 1/4"), but the API echoes it back as a stringified float, so a
  1/3-cup recipe line comes back carrying `"0.33333334"`. Text no parser can read
  ("a pinch") is kept as written.
- **The fraction math lives in that one module.** A second fraction table would
  decide its own denominators and precision. The cost of fraction.js's float
  constructor is in
  [the fraction.js entry](verified-library-behaviour.md#fractionjss-float-constructor-costs-a-quarter-second-on-device).
- **An editable field is seeded by the same function**, so a badge and its edit
  sheet cannot disagree. A decimal-only field (`PurchaseAmountSheet`, whose
  keypad has no `/`) seeds from `formatQuantity` instead.

## Navigation

`inactiveBehavior` and the focus-gate recipe for a secondary consumer of another
tab's query are explained in [`architecture.md`](architecture.md) § Navigation:

- what `'pause'` destroys and re-runs on resume;
- why `Home` needs `'none'` for deep pushes;
- the background work `'none'` keeps alive;
- when to re-measure.
