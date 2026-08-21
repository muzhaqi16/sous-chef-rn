- to regenerate the schema run npm run codegen
- always run npm run typecheck and npm run lint after making code changes to ensure no typescript and linting errors were introduced
- `npm run lint` also lints every `.graphql` operation against the codegen-pulled schema (`@graphql-eslint` override in `.eslintrc.js`, files `**/*.graphql`): `fields-on-correct-type` (selecting a field/arg the schema lacks) and `no-deprecated` (using an `@deprecated` field/arg/enum value) are both `error`. This surfaces API drift — a renamed/removed field or a freshly-deprecated one — at lint time, one at a time, instead of as a surprise `npm run codegen` batch failure. The guard reads `src/graphql/generated/schema.graphql`, so run `npm run codegen` first if the schema is stale.
- typecasting \_\_typename: 'Mutation' as any, is never needed
- estimatedItemSize has been deprecated in version 2 of flashlist and to never use it which is the version that is app is uisng
- **Never use `InteractionManager` from `react-native`.** It has been deprecated. Avoid long-running work on the JS thread and use `requestIdleCallback` instead for deferring non-urgent tasks.

### Bottom Sheet Convention

- **Always use `BottomSheetModal`** (not `BottomSheet`) from `@gorhom/bottom-sheet`.
  The app uses a global backdrop system (`OverlayBackdropProvider` + `GlobalBackdrop`
  rendered at the App level). `BottomSheet` renders inline and its backdrop conflicts
  with the global overlay, causing the backdrop to appear on top of the sheet content.
  `BottomSheetModal` is portal-based and renders inside `BottomSheetModalProvider` at the
  correct stacking order.
- **Always use `useStandardBottomSheet`** from `src/hooks/useStandardBottomSheet.ts`.
  It provides the ref, standard `modalProps` (backdrop, animations, insets, back handler),
  and `contentContainerStyle`. Control visibility via a `visible` boolean state + `onDismiss`
  callback — never call `present()` / `dismiss()` directly outside of an effect.
- **Every text input inside a sheet must resolve to gorhom's `BottomSheetTextInput`.**
  This is the library's own requirement, not a local preference: the
  [keyboard-handling docs](https://gorhom.dev/react-native-bottom-sheet/keyboard-handling)
  say it is "pre-integrated" to "communicate internally to react to the keyboard
  appearance", and the only sanctioned alternative is to "copy the `handleOnFocus`
  and `handleOnBlur`" logic into your own component.

  The mechanism, from the installed source: `BottomSheetTextInput.handleOnFocus`
  sets `animatedKeyboardState.target`, and `useAnimatedKeyboard.ts` **caches and
  discards** a keyboard-shown event while that target is unset. A plain RN
  `TextInput` therefore leaves the sheet blind to the keyboard — `keyboardBehavior`
  never fires and the sheet sits still while the keyboard covers the field.

  It cannot be hardcoded, because `BottomSheetTextInput` reads the sheet's internal
  context and **throws outside a sheet** (`useBottomSheetInternal`), and shared
  fields render on full screens too. Pick it from context, as `FormInput`,
  `FractionInput`, `EditableCounter` and `BottomSheetAutocompleteInput` do:

  ```tsx
  const InputComponent = useIsBottomSheetInput()
    ? ThemedBottomSheetTextInput
    : ThemedTextInput;
  ```

  `BottomSheetFormScrollView` supplies that context, so a sheet whose form uses it
  gets the right input everywhere for free.

- **Sheets containing inputs use `BottomSheetFormScrollView`, not
  `BottomSheetScrollView`** — a gorhom-registered `KeyboardAwareScrollView` from
  `react-native-keyboard-controller`, which is what `react-native-edge-to-edge`'s
  README recommends once edge-to-edge stops `adjustResize` from resizing the window.
  `bottomOffset` defaults to `16` in the component — do NOT restate it at call
  sites, which only creates a second place to change. It is measured from the
  focused input's **bottom edge**, not the caret the prop's docstring mentions —
  see `point = absoluteY + inputHeight` in `KeyboardAwareScrollView/index.tsx`.
  Without it a focused field lands flush against the keyboard, and without the
  container nothing scrolls at all.

  **This migration is not finished.** Eight sheets still use
  `BottomSheetKeyboardAwareScrollView` directly and therefore do NOT supply
  `BottomSheetInputContext`, so their inputs resolve to the plain RN one:
  `AdjustQuantityModal`, `PantryActionModal`, `ManageRecipeSheet`,
  `SearchResultsScreen`, and the four `AddToPantrySheet` pages
  (`grep -rl BottomSheetKeyboardAwareScrollView src` — that list is the whole
  set, so the count above is checkable rather than remembered). Convert one when you are
  already working in it; the rule above describes where this is going, not
  where it entirely is.

### Pressable & Modal Convention

- **Use `Pressable` from `#components/atoms/themedComponents`** as the default
  across the app. That export is now React Native's `Pressable` (re-exported
  through the shared module so existing imports keep working). The Unistyles
  babel plugin auto-binds RN's `Pressable` to the C++ ShadowTree, so styles
  — including function-style `style={({pressed}) => [styles.X, ...]}` callbacks
  with `StyleSheet.create` proxies — and theme switches work natively without
  any wrapper.
- **Do not wrap `Pressable` with `withUnistyles(...)`.** Wrapping silently drops a
  function-style `style={({ pressed }) => [...]}` callback — see the Unistyles
  Convention section below for the mechanism and how to re-check it.
- **For gesture composition, import `Pressable` directly from
  `react-native-gesture-handler`.** Required when the pressable lives inside
  a `Swipeable`, is part of a `GestureDetector` / `Gesture.X` chain, or
  needs RNGH's `RectButton`-style coordination. RN's Pressable does not
  participate in RNGH's gesture system.
- **`ScrollView` from `react-native-gesture-handler`** is only needed when the
  scroll container has RNGH gesture components inside it (Swipeable,
  GestureDetector, pan gestures). For plain forms, settings, and display
  screens, use `ScrollView` from `react-native`.

### Unistyles Convention

The app uses `react-native-unistyles@3` with the React Compiler. Unistyles' value
prop is **ShadowTree updates without React re-renders** — but that only works
when styles are declared via `StyleSheet.create(theme => ...)` and theme reads
happen inside that factory.

- **Prefer `StyleSheet.create(theme => ...)` for RN primitives.** Theme changes
  are pushed to native via the C++ ShadowTree binding — no React work needed.
  Use `styles.useVariants({ disabled, active, … })` for runtime-flag-driven
  styling instead of conditional theme reads.
- **Use `withUnistyles(Component)` for third-party components** that take
  theme-derived props (icon `color`, `<BottomSheetModal backgroundStyle>`,
  `<SystemBars style>`, etc.). Wrapping with `withUnistyles` lets the wrapper
  re-render only when its declared dependencies change, instead of re-rendering
  the parent on every theme tick.
- **Do not wrap `Pressable` / `TouchableX` with `withUnistyles`.** The wrapper
  silently discards a function-style `style={({ pressed }) => [...]}` callback, so
  layout, padding and colour rules disappear at render time.

  > **Verified 2026-08 against the installed `react-native-unistyles@3.3.0`.** > `src/core/withUnistyles/withUnistyles.native.tsx` builds the forwarded style with
  > `Object.assign({}, uni__getStyles())`, and for a function-valued `style` prop
  > `uni__getStyles()` returns the function itself. `Object.assign({}, fn)` copies a
  > function's own enumerable properties — an arrow function has none — so the child
  > receives `{}`. Re-check in one line:
  >
  > ```
  > node -e "console.log(Object.assign({}, ({pressed}) => [{padding:12}]))"   // -> {}
  > ```
  >
  > This rule previously cited unistyles#1109. The issue link was replaced with the
  > mechanism because a closed issue says nothing about what the installed code does —
  > and this behaviour **is** still in 3.3.0's source. Re-run the check above before
  > relaxing the rule on a future upgrade.

  RN's `Pressable` is auto-bound to the ShadowTree by the babel plugin, so use
  it directly (via the re-export in `themedComponents.tsx`). For RNGH
  gesture composition (Swipeable underlays, `GestureDetector` chains), import
  `Pressable` from `react-native-gesture-handler` at the call site — also
  without a `withUnistyles` wrapper.

- **Shared themed wrappers live in `src/components/atoms/themedComponents.tsx`.**
  Use `ThemedBottomSheetTextInput`, `ThemedActivityIndicator`, and
  `OnPrimaryActivityIndicator` from there instead of recreating per-file
  `withUnistyles(...)` wrappers. The pattern is established — add new ones to
  this module when a third-party component needs to be theme-reactive.
- **For Switches, use `BaseSwitch`** from `src/components/base/BaseSwitch.tsx`
  instead of RN's `<Switch trackColor=... thumbColor=...>` with theme reads.
  `BaseSwitch` is already wrapped with `withUnistyles` and has the standard
  on/off colors built in.
- **For icons with theme-derived colors, use `<Icon tone="X" />`** from
  `src/utils/iconUtils.tsx`. It internally uses `withUnistyles(Ionicons)` so
  the icon re-renders independently of the parent on theme change.
- **Use `useUnistyles()` only for runtime metadata** — `rt.colorScheme`,
  `rt.themeName`, `rt.insets`. Reading `theme.*` via this hook re-renders the
  entire calling component on every theme change and loses the ShadowTree
  optimization. Legitimate exceptions:
  - `useTheme` / `ThemedStatusBar` — need `rt.colorScheme` / `rt.themeName`.
  - `RootNavigator.Navigation` — builds a React Navigation `Theme` object
    from Unistyles theme; the `theme` prop on `<StaticNavigation>` is what
    drives RN Navigation's color scheme. This cross-library hand-off is the
    intended use of `useUnistyles()`.
  - `TrendLineChart` — Skia primitives don't accept Unistyles styles; theme
    colors flow into Skia draw calls.
  - `RecipeMain`, `SortableShoppingList` — theme colors flow into data
    structures (`SearchBarAction[]`, the sortable theme context provider).
- **Merging a `style` prop with themed styles uses the array pattern**
  `<View style={[styles.x, callerStyle]} />` ([Unistyles "Merging styles"
  guide](https://www.unistyl.es/v3/guides/merging-styles/)). No wrapper or
  `'use no memo'` directive needed.
- **Navigators default to `inactiveBehavior: 'pause'`, EXCEPT `HomeTabs` and
  the root `Home` screen, which set `inactiveBehavior: 'none'`.**
  `'pause'` (React 19 `React.Activity`, used by `@react-navigation/native-stack`
  v8 / `@react-navigation/bottom-tabs` v8) destroys every layout effect in a
  hidden subtree and re-runs all of them synchronously in one commit on
  resume. The tab subtree is 4 FlashLists plus every mounted item cell's own
  animation/gesture effects, so resuming freezes the JS thread for
  multi-second stretches. `HomeTabs` covers switching tabs; `Home` covers a
  detail screen being pushed over the tabs (that only pauses from the second
  push down — native-stack treats the screen directly under the focused one
  as active — but `Home > Profile > HomeManagement > HomeDetail` reaches it).
  **The cost is not just idle memory.** `'none'` keeps the blurred subtree
  _mounted and subscribed_, so it keeps doing work:

  - every Apollo `useQuery` in the hidden tabs stays watching the cache and
    **re-renders on any write that touches its fields** — a pantry mutation
    re-renders the hidden shopping-list and meal-plan trees too;
  - subscriptions, `AppState`/`NetInfo` listeners and polling intervals in those
    trees keep firing;
  - Reanimated/gesture handlers stay attached, and their layout effects keep
    running on every commit.

  So the trade is _one_ multi-second freeze on resume against continuous
  background render work for the lifetime of the session. That is the right
  trade for 4 FlashLists, and the wrong one almost everywhere else — which is
  why every other navigator stays on `'pause'`, and why adding a fifth tab or a
  heavy subscription to a tab should prompt re-measuring rather than assuming.

  Asserted by `HomeTabs.test.tsx` and `RootNavigator.test.tsx` (the latter
  checks `Home` is the ONLY root screen that opts out). Every other navigator
  stays on the default `'pause'`. (Unistyles ShadowTree updates on paused
  screens are unrelated and already fixed as of `react-native-unistyles@3.3.0`.)

The Unistyles babel plugin must run **before** `babel-plugin-react-compiler`
(see `babel.config.js`); reversing the order produces compile errors.

### React Compiler Conventions

> **Rules here carry their evidence.** Each one that constrains how you write code
> states what was checked, against which installed version, and the command that
> re-derives it. That is deliberate: three rules in this file were once justified by
> claims that had stopped being true (a `try/catch` compiler bailout that does not
> occur, an `exhaustive-deps` exemption the cited page never granted, an upstream
> issue standing in for behaviour nobody re-checked), and nothing made them
> identifiable as expired short of re-running a full review. **If you change a rule
> here, record the check beside it. If a rule has no check, treat its justification
> as unverified.**

- **Default to NOT writing `useMemo` / `useCallback`.** `babel-plugin-react-compiler`
  memoizes values and callbacks for you, so manual memoization is redundant in the
  ordinary case. This is a default, not an absolute — reach for it where you need
  referential stability the compiler cannot give you:

  - a value that goes into a **dependency array** (the compiler memoizes values; it does
    not re-run an effect you forgot to depend on),
  - a prop read by something the compiler did not compile — e.g. a third-party component
    doing its own `===` check,
  - anything in a file the compiler **bails out of**. 63 files currently do; check
    `scripts/check-compiler-bailouts.baseline.json` before assuming coverage.

  The lint rule stays an **error** so the exception has to be written down rather than
  waved through: add `// eslint-disable-next-line no-restricted-imports` with the reason.
  (An error with a documented escape hatch, not a warning — the repo already carries
  warnings nobody reads, and "this component isn't compiled" is exactly the kind of
  reasoning that should survive in the diff.)

- **Inside hook/component bodies, two `try` shapes make the React Compiler bail out on
  the whole function** (so none of its derived values are memoized):

  1. **A finalizer** — any `finally`, with or without a `catch`. Also a catch-less `try`.
  2. **A "value block" inside the `try` body** — `?.`, `??`, `&&`, `||`, or a ternary.

  A `try/catch` whose body is **plain statements only** compiles fine. So keep the
  conditional part out of the `try`:

  ```ts
  // BAILS — `?? null` is a value block inside the try
  let data = null;
  try { data = (await client.query(…)).data ?? null; } catch {}

  // COMPILES — try body is a plain assignment; the value block moved out
  let result;
  try { result = await client.query(…); } catch {}
  const data = result?.data ?? null;
  ```

  > **Verified 2026-08 against `babel-plugin-react-compiler@1.0.0`.** Re-derive with
  > `node scripts/probe-compiler-try-forms.mjs`, which compiles one fixture per shape and
  > prints the compiler's own diagnostic — `Handle TryStatement with a finalizer ('finally') clause`, `Support value blocks (conditional, logical, optional chaining, etc) within a try/catch statement`, `Unexpected terminal in optional`.
  >
  > This rule previously read "never write try-catch **or** try-finally". That was
  > over-broad — a plain `try/catch` compiles — but it was not wrong by accident: most
  > real `try` bodies contain a `?.` or `??`, which is why the blanket ban looked correct.
  > `node scripts/check-compiler-bailouts.mjs` is what actually enforces this; it catches
  > a mis-shaped `try` that no linter sees.

  The `react-compiler/react-compiler` ESLint rule has a
  [known bug](https://github.com/facebook/react/issues/35644) where it **silently stops
  reporting all diagnostics** on unsupported syntax like `finally` — zero warnings rather
  than a flagged bailout. `react-hooks/todo` catches these, and
  `node scripts/check-compiler-bailouts.mjs` is the backstop that actually compiles every
  file. For the `finally` cases, use the shared helpers in
  `src/utils/finallyHelpers.ts`.

- **Never read/write `ref.current` during render.** Use the "adjusting state during render"
  pattern (`useState` + conditional `setState`) for comparing previous/current values.
- **Hook return objects are auto-memoized by the compiler** — but only if the compiler doesn't
  bail out. Once the `finally` is extracted, return objects like `{ actions }` become stable
  automatically.
- **`React.memo` is normally unnecessary** — the compiler caches JSX elements at the parent
  call site. This includes FlashList/FlatList `renderItem` components: FlashList v2's
  `ViewHolder` already applies `===` reference equality on `item`, and the compiler memoizes
  inline `renderItem` functions in compiled parents.

  The same caveat as above applies: "the parent memoizes it" holds only for a parent the
  compiler actually compiled. If a profile points at a component whose parent is in the
  bailout baseline, `React.memo` there is a legitimate fix — say so in a comment.

### `scheduleOnRN` Worklet Convention

Functions passed to `scheduleOnRN` (Reanimated's `runOnJS` replacement) **must be pre-defined
in RN runtime scope**. Inline arrow/function expressions inside worklets cause native crashes
on Android because the worklet serializer cannot capture closures created at call-site.

```ts
// CORRECT — callback defined in RN scope
const handlePress = (id: string) => {
  /* ... */
};
const gesture = Gesture.Tap().onEnd(() => {
  scheduleOnRN(handlePress)(id);
});

// WRONG — inline function crashes on Android
const gesture = Gesture.Tap().onEnd(() => {
  scheduleOnRN(() => handlePress(id))(); // native crash
});
```

**Never pass function references as arguments to `scheduleOnRN`.** Functions cannot be
serialized across the worklet boundary — they arrive as plain objects in release mode,
causing `TypeError: Object is not a function`. Only pass primitives (strings, numbers,
booleans). Capture function dependencies via RN-scope closure instead:

```ts
// CORRECT — capture onDismiss via closure, pass only primitives
const handleDismiss = () => {
  onDismiss(id);
};
scheduleOnRN(handleDismiss);

// WRONG — passing a function reference through the worklet boundary
scheduleOnRN(dismissEntry, onDismiss, id); // onDismiss is an object in release
```

Two ESLint `no-restricted-syntax` rules enforce this at lint time:

1. No inline functions as the first argument
2. No more than 2 arguments (prevents passing function refs as extra args)

### Cache Persistence — Raw Apollo State

The Apollo cache is persisted to MMKV as-is via `cache.extract()` / `cache.restore()`
in `ApolloCachePersistence.ts`. No transformation is applied — connection fields (`edges`,
`pageInfo`) are preserved so queries can be satisfied from cache immediately on cold start.

**What gets persisted:** The full normalized cache — entities (`PantryItem:123`,
`ShoppingListItem:456`), connection wrappers (`itemsConnection`, `membersConnection`),
and `ROOT_QUERY`. On restore, queries return cached data instantly.

**Stale data handling:** The default `cache-and-network` watchQuery policy fires a
background network request on every mount. Stale `pageInfo` or edges from a previous
session are automatically replaced within seconds. A brief flash of stale pagination
state (e.g., "load more" visible when no more items exist) is acceptable — it
self-corrects when the network response arrives.

**When adding new paginated connections:**

- Use `itemsConnectionFieldPolicy()` or `mergeConnectionByNodeId()` for merge logic
- Use `extractNodes()` / `normalizeConnection()` helpers which return `[]` for missing edges
- Use `cache-and-network` → `cache-first` fetch policy so the network fires immediately on restore

### Feature API Boundary Convention

Each feature under `src/features/<name>/` is treated as a self-contained module
with a small public surface. The convention:

| Subfolder                             | Public?            | Notes                                                                                                   |
| ------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| `screens/`                            | ✅ Public          | Imported by navigation stacks                                                                           |
| `manifest.ts`                         | ✅ Public          | Wired into `FEATURE_REGISTRY`                                                                           |
| `hooks/` (top-level files only)       | ✅ Public          | Cross-feature consumers may import top-level hooks                                                      |
| `components/`                         | ⚠️ Mostly internal | Shared UI atoms/molecules belong in `src/components/`; feature-private cards/rows stay here             |
| `context/`                            | 🔒 Internal        | Cross-feature consumers should not reach into another feature's context                                 |
| `graphql/`                            | 🔒 Internal        | Other features should compose their own queries; only the feature's own hooks read from these documents |
| `hooks/mutations/`, `hooks/<deeper>/` | 🔒 Internal        | Lifecycle / mutation primitives — stay within the feature                                               |
| `utils/`                              | 🔒 Internal        | Feature-specific helpers — stay within the feature                                                      |

**Cross-feature reach is OK only for:** `screens`, `manifest`, top-level `hooks`,
and the `<feature>Fragments.generated.ts` types (when composing your own
fragments). Anything deeper (`hooks/mutations/...`, `context/`, `utils/`) is an
implementation detail and may change without notice.

This is enforced via ESLint `no-restricted-imports` patterns in `.eslintrc.js`
(see the `from feature internals` rule). Migrations of working code are not
required — the rule only blocks NEW reach-across imports.

### Apollo Test Patterns

**Always use `renderHookWithApollo` / `renderWithApollo` from `__tests__/helpers/apolloMockProvider.tsx`.**
Direct `jest.mock('@apollo/client/react', () => ({ useQuery: jest.fn(...) }))`
is the legacy anti-pattern — it couples tests to operation names (refactor-broken)
and bypasses the real cache, missing the very integration bugs tests should catch.

```ts
// ✅ Correct — schema-backed cache, type-safe mocks
//
// Import `MockedResponse` from the helper, NOT from '@apollo/client/testing'
// (the flat import there is deprecated; the helper re-exports the canonical
// MockLink.MockedResponse type).
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';

const operationMocks: MockedResponse[] = [
  {
    request: { query: GetItemDoc, variables: { id: '1' } },
    result: { data: { item: { __typename: 'Item', id: '1', name: 'A' } } },
  },
];

const { result } = renderHookWithApollo(() => useItem('1'), { operationMocks });
```

```ts
// ❌ Anti-pattern — couples to operation names, no cache, refactor-broken
jest.mock('@apollo/client/react', () => ({
  useQuery: jest.fn((doc) => {
    if (doc?.definitions?.[0]?.name?.value === 'GetItem') return { data: ... };
  }),
}));
```

The helper supports two modes:

- **`operationMocks: MockedResponse[]`** — explicit per-operation request/response pairs (preferred for assertions on exact data flow)
- **`mocks` + `resolvers`** — schema-driven auto-mocks via `@graphql-tools/mock` (preferred for setup-heavy tests where exact shapes don't matter)

For mutation tests: assert on the cache after the mutation, not on the mock function. The whole point is exercising the cache update path that the production code relies on.

**Apollo test gotchas:**

1. **A failing mutation RESOLVES; it does not throw.** Both production
   (`apollo/client.ts`) and the shared `apolloMockProvider` set
   `mutate: { errorPolicy: 'all' }`, so a GraphQL or network failure arrives as
   `{ data: undefined, error }`. A `catch` around a mutation therefore only sees
   a link-level throw (e.g. `authLink` cancelling during logout).

   Drive a failure with an operation mock that carries an `error` and assert the
   hook's real behaviour:

   ```ts
   const failing = recordMock(SomeDocument, {
     error: new Error('network down'),
   });
   renderHookWithApollo(() => useThing(), { operationMocks: [failing.mock] });
   ```

   Do NOT stub a helper to fake the throw — that tests a path the app barely
   takes. This was previously documented as a workaround around
   `executeMutation`; removing that wrapper surfaced five hooks that keyed
   success off "the call returned" and so reported a failed write as a success.
   **Put the failure handling where the failure arrives: on the resolved
   result**, not only in the `catch`.

2. **Use `variables: () => true` for complex transformed inputs.** When a
   mutation's `input` is built from a non-trivial transform (Spoonacular →
   CreateRecipeInput, device-info → register payload), don't mirror the
   transform in the test — use Apollo's `VariableMatcher` shape:
   `{ request: { query, variables: () => true }, result: { data: ... } }`.

3. **`waitFor(() => expect(result.current.loading).toBe(false))` is the right
   settling primitive.** A bare `await Promise.resolve()` doesn't flush Apollo's
   microtask chain reliably.

4. **Schema-driven `mocks` for deep selections.** Queries with 3-4 levels of
   fragment spreads (`GetPantry`, etc.) are impractical to mock literally — use
   `{ mocks: { Query: () => ({ pantry: { id: 'p1' } }) } }` and let
   `@graphql-tools/mock` fill the rest.

5. **Mock provider doesn't auto-flatten connections.** If a query selects
   `pantriesConnection` but the hook reads `home.pantries` (a flat array via a
   normalizer), the test must either (a) reshape inside the test's mock
   `normalize*` helper, or (b) update the production hook to read the
   connection edges directly.

6. **Subscription hooks with `customOnData`.** When a hook delegates to
   `subscriptionService.register({ customOnData })`, keep mocking
   `subscriptionService.register` to capture and invoke `customOnData` directly.
   Driving a real subscription event through `MockedProvider` is brittle and
   not what the cache-update assertion is testing.

7. **`__typename` on every entity in `operationMocks`.** Without it, Apollo
   can't normalize/cache the entity. The schema-driven path adds it
   automatically; literal `operationMocks` must include it explicitly. Use the
   generated TypeScript types as a structural reference.

**Helper shortcuts (`__tests__/helpers/apolloMockProvider`):**

- **`recordMock(query, { data, error?, delay?, maxUsageCount? })`** — replaces
  the legacy variables-spy pattern. Returns `{ mock, fired }`: `mock` goes
  into `operationMocks`; `fired` is an array of every variables payload Apollo
  observed for that operation, in order. Assert via
  `expect(fired).toContainEqual({ … })`.

- **`seedCache(entries)`** — pre-writes entities into a fresh
  `InMemoryCache` so hooks that call `useApolloClient().cache.readFragment(…)`
  find them. Each entry needs `__typename` + `id` and any fields the hook
  reads. Pass the returned cache as `{ cache }` to `renderHookWithApollo`.

### Apollo Mutation Patterns

Pick the cache-update pattern based on what the mutation changes:

| Pattern                                                        | Use when                                                                                                                             | Example                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No `update` callback** (preferred default)                   | Mutation returns the entity and Apollo auto-normalizes by `__typename + id`                                                          | `useAdjustPantryItemQuantity` — the mutation spreads the hook's fragment on the response; Apollo writes through automatically                                                                                                                                                                                    |
| **`cache.modify` on parent aggregates**                        | Need to update parent stat fields not in the response                                                                                | `useRecipeReviews` — patches `Recipe.totalReviews` / `averageRating` / `rating{N}Count` aggregates (`recipeReviewCacheUpdaters`) after create/update/delete review. (`Pantry.stats` is instead kept current via the `Pantry.stats` `mergeObjects` field policy + mutation responses — no manual `cache.modify`.) |
| **`cache.modify` on entity fields BEFORE firing the mutation** | Optimistic UI without a callback — set fields synchronously, revert from a snapshot on error                                         | `useToggleShoppingItem` — flips `purchaseInfo.isPurchased` + moves the item between purchased/unpurchased connections immediately, reverts in `onError`                                                                                                                                                          |
| **`updateEntityFieldsLocalFirst`**                             | Settings-shaped mutation: a normalized entity whose GraphQL field names ARE the flat setting names, updated a field or two at a time | `useAppSettings` (`UserSettings`), `useNotificationSettings` (`NotificationPreferences`) — writes the fields, fires with `context: { localFirst: true }`, reverts from the caller's `previous` snapshot only on `'rejected'`                                                                                     |
| **`cache.modify` on connection edges + parent counts**         | Entity moves between filtered connections (purchased ↔ unpurchased, list ↔ list)                                                     | `useToggleShoppingItem`, `useRemoveShoppingItem` — `moveShoppingListItemTo*` helpers                                                                                                                                                                                                                             |
| **`writeFragment`**                                            | Subscription handler receives an entity push and writes it through                                                                   | `usePantrySubscriptions`, `useShoppingListSubscriptions`                                                                                                                                                                                                                                                         |
| **`refetchQueries`** (last resort)                             | Mutation affects queries whose shape can't be derived from the response                                                              | `CreateHomeScreen` (refetches home list after creating home), `useRecipePreload`                                                                                                                                                                                                                                 |

Defaults:

- `optimisticResponse` (callback form returning `Unmasked<TData>`) for mutations that need to materialize the cached entity for the optimistic shape; otherwise prefer the **cache.modify before mutation + revert on error** pattern (no callback needed, no `Unmasked<>` import).
- `errorPolicy: 'all'` so partial-data errors are surfaced to the hook, not swallowed.
- Avoid `refetchQueries` unless `cache.modify` would require duplicating server logic.
- Build optimistic responses from the existing cache via `cache.readFragment` + spread, never with hand-rolled placeholder shapes that can drift from the schema.
- **Never pair `optimisticResponse` with `context: { localFirst: true }`.** Apollo tears the optimistic layer down as soon as the mutation completes, and offline that completion is `queueLink`'s null result — so the change reverts on screen while it sits in the queue. Local-first writes to the cache permanently before firing instead.

**Optimistic entities must be COMPLETE for every query that reads them.** Apollo has no
`returnPartialData` on these hooks, so one missing field makes the whole query's cache read incomplete
and `useQuery` returns no data at all. Online a refetch hides it; offline there is no refetch and the
row the user just added stays invisible for the rest of the session. When you add a field to a list
query — or to a fragment it spreads — the optimistic builder, the create mutation's selection, AND the
queue's `Sync*` replay fragment all have to carry it.
`__tests__/apollo/optimisticEntityCompleteness.test.ts` executes the real schema and asserts
`cache.diff(...)` reads complete for all three writers; add a case there for any new local-first entity.
Corollary for nested entity references (`unit`, `item`): resolve them from the cache with
`cache.readFragment` selecting **every** field the query needs — `readFragment` returns null on a
partially-cached entity exactly as it does on a missing one, so a narrow selection elsewhere in the app
silently drops the reference.

### Autocomplete Local-First Search

All autocomplete hooks use `useAutocompleteSearch` from `src/hooks/ui/useAutocompleteSearch.ts`.
When a hook provides `fallbackItems` + `filterFallback`, it can opt into **local-first** search
via `localFirst`. When `localFirst` is true, a local match short-circuits the network query
entirely. That is only safe when the warmed cache is **complete** for the dataset — otherwise an
online user whose term collides with a cached entry never reaches the rest of the catalog. So:

- **Complete reference set → `localFirst: true`.** Small, fully-warmed sets (units).
- **Bounded slice of a larger catalog → `localFirst: !isOnline`.** Warm the cache for offline use,
  but online always hit the full-catalog search. Stores/brands/categories warm only the first
  ~100 rows (`GetStores`/`GetBrands`/`GetCategories first: 100`), and items keep an LRU of only
  what the user has seen, so all four use `!isOnline`.

**Current status:**

| Hook                             | `localFirst` | Notes                                                     |
| -------------------------------- | :----------: | --------------------------------------------------------- |
| `useUnitAutocomplete`            |    `true`    | `cachedUnits` is the complete common-units set            |
| `useBrandAutocomplete`           | `!isOnline`  | Warmed cache is first ~100 brands; full search online     |
| `useCategoryAutocomplete`        | `!isOnline`  | Warmed cache is first ~100 categories; full search online |
| `useStoreAutocomplete`           | `!isOnline`  | Warmed cache is first ~100 stores; full search online     |
| `useItemAutocomplete`            | `!isOnline`  | Seen-items LRU only; full catalog search online           |
| `useStorageLocationAutocomplete` |     N/A      | Fully local, doesn't use `useAutocompleteSearch`          |

When adding cached data to a new autocomplete hook, pass `localFirst: !isOnline` unless the warmed
cache is provably complete for the dataset (only then is unconditional `true` correct).

**Staleness guard:** `useAutocompleteSearch` tracks the last term sent to `search()` via
`lastFiredTerm` state. API results are only displayed when `searchTerm.startsWith(lastFiredTerm)`
(case-insensitive). This prevents stale results from appearing when the user types faster than
the debounce cycle — e.g., switching from "app" to "banana" won't flash "app" results.
Consumer hooks do not need to implement their own relevance checks.

### Autocomplete UI Variants & Dropdown Stacking

- **Both variants are fine inside a bottom sheet — pick by result set, not by host.**
  This rule previously said to avoid `variant="modal"` in a sheet because stacking
  a second sheet is "confusing". That was a local preference dressed up as a
  constraint: gorhom advertises
  ["Support stack sheet modals"](https://gorhom.dev/react-native-bottom-sheet/modal)
  as a feature, with an Apple Maps clone as its reference. The library has no
  position here, so neither should this file. What survives is measurable:
  [Baymard's mobile autocomplete research](https://baymard.com/blog/autocomplete-design)
  targets **4–8 suggestions on mobile** because the list is squeezed between the
  field and the keyboard. `InlineAutocomplete` caps at `maxResults = 6`, so inline
  suits a set the user narrows by typing; a catalog that needs its own search and
  browsing suits the modal picker.
- **Two things a stacked picker must get right.** `stackBehavior="push"` — gorhom's
  default `'switch'` "minimize[s] the current modal then mount[s] the new one"
  (`bottomSheetModal/types.d.ts`), which reads as the host crashing closed. And,
  where it can, a snap point **taller than its host**, so the picker reads as a
  separate surface rather than the host redrawing itself; that height difference
  is what makes the Apple Maps reference legible.
  `BottomSheetAutocompleteInput` sets both (`stackBehavior="push"`,
  `snapPoint = '85%'` over hosts that mostly sit at 70%).

  The height half is a preference, not an invariant, and the file used to state
  it as one. Hosts in this app run from 35% to 95% — `CorrectWeightModal`
  expands to 85%, `MoveToPantryModal` and `ManageRecipeSheet` to 95% — so no
  single default can clear all of them, and `topInset` caps everything at the
  safe area anyway. Over a tall host the stack reads through the push animation
  and the dimmed backdrop instead. `snapPoint` is a prop; override it per call
  site rather than moving the default to chase one host.

- **Every sibling an inline dropdown can overlap needs an explicit, non-zero,
  descending zIndex on a `collapsable={false}` view — at every ancestor level
  up to where the overlap happens.** RN `zIndex` only orders siblings, and
  Android view flattening prunes layout-only wrappers (silently discarding
  their zIndex). **Wrap vertically stacked form content in `DropdownStack`**
  (`src/components/atoms/DropdownStack.tsx`), which applies both automatically;
  do not hand-roll zIndex chains. Miss a level and the dropdown paints UNDER
  the inputs below it — on device only, invisible to typecheck/lint/jest.

### Apollo: Fragment composition + `useFragment` convention

`dataMasking: true` is enabled globally (`src/apollo/client.ts`). The project
follows Apollo Client 4.x's recommended pattern: **per-component / per-hook
colocated fragments**, masked at the type level, materialized through
`useFragment` (for cache subscriptions) or `cache.readFragment` (for one-shot
reads).

**Fragment locations:**

- A component / hook owns its fragment in a sibling `<Name>.graphql` file
  (e.g. `PantryDetailInfo.graphql` next to `PantryDetailInfo.tsx`,
  `useUpdatePantryItem.graphql` next to `useUpdatePantryItem.ts`).
- Naming: `<Consumer>_<entity>` (e.g. `PantryItemCard_pantryItem`,
  `useToggleShoppingItem_item`).
- Screen-level fragments compose children via spread:
  `fragment ItemDetail_X on X { ...ChildA_X ...ChildB_X /* + screen fields */ }`.
- Queries spread the screen-level fragment(s); mutations spread the
  hook-owned fragment.
- **Shared fragments** live in `*Fragments.graphql` and each carries a
  header listing the operations that spread it and the hooks that read it.
  That header is the contract for keeping the fragment shared. Current set:
  `PantryItemBatchFragment`, `ShoppingListItemDisplayFragment`,
  `ShoppingListOwnershipFragment`, `ShoppingListCollaboratorFragment`,
  `MealPlanDisplay`, `MealTemplateDisplay`, `MealTemplateItemFragment`,
  `BasicRecipeFragment`, `RecipeIngredientFragment`, `RecipeReviewFragment`,
  `LoginUser`, `PartialUser`.

**Don't:**

- Don't add a new fragment to `*Fragments.graphql` without 2+ operations and
  1+ hook needing the identical shape, plus the consumer-list header.
- Don't import the following names from `**/*Fragments.generated` (lint
  blocks them via `no-restricted-imports` in `.eslintrc.js`):
  `UnitBasic*`, `UnitFull*`, `StoreFields*`, `BrandFields*`,
  `UserProfileFields*`, `UserProfileFull*`, `UserSummary*`,
  `ItemFragment*`, `ItemDisplay*`, `ItemCore*`, `HomeFragment*`,
  `PantryItemFragment*`, `PantryItemDisplay*`, `ShoppingListItemFragment*`,
  `MealPlanFullFragment*`, `RecipeFragment*`. If you need fields one of
  these described, create a colocated `<Consumer>_<entity>` fragment in a
  sibling `.graphql` file.
- Don't use `@unmask` (any mode). It's an Apollo migration tool, not a
  steady-state pattern. If a mutation hook needs an unmasked shape, annotate
  the `optimisticResponse` callback return type as `Unmasked<TData>` — see
  the "Mutation optimistic responses" section below.
- Don't reach across feature boundaries into another feature's
  `graphql/`, `context/`, `hooks/mutations/`, or `utils/` folder. Only
  `<feature>Fragments.generated.ts` type imports are allowed across
  features. `import/no-restricted-paths` enforces this.

**Two valid `useFragment` consumer patterns — pick by use case:**

| Pattern                    | Prop type                                | Cache miss                   | Use for                                                                                                   |
| -------------------------- | ---------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| **A — strict**             | `FragmentType<typeof XDoc>`              | `return null` on `!complete` | List cells (`MyRecipeCard`, `SavedRecipeCard`, `PantryItemCard`, `HomeMemberCard`) — brief blanking is OK |
| **B — resilient fallback** | `FragmentType<typeof XDoc> \| XFragment` | Fall back to source prop     | Detail panels, sheets (`PantryDetailInfo`, `MealPlanSettingsSheet`) — must render without blanking        |

Pass the masked ref directly as `from`. Apollo's `useFragment` runs
`cache.identify(from)` internally (which reads only `__typename` + the
type's key fields) so the masked ref shape
`{ __typename, id, $fragmentRefs }` and a bare `{ __typename, id }`
produce the same cache lookup — no manual extraction needed.

**That masked ref only carries `id` if the operation selects `id` directly.**
Under `dataMasking`, a named fragment spread (`...Frag`) is hidden from its
parent — the parent sees only the fields it selects itself plus `__typename`.
So a field written as `shoppingListItem(id: $id) { ...ItemDetail_shoppingListItem }`
masks to just `{ __typename }`: the `id` is inside the (masked) fragment. The
moment that object reaches `useFragment` / `cache.readFragment` /
`cache.identify` — or any code reads `.id` off it — key-field extraction throws
`Missing field 'id' while extracting keyFields…`. **Rule: any selection set that
spreads a fragment identifying its type must also select `id` directly**
(e.g. `shoppingListItem(id: $id) { id ...ItemDetail_shoppingListItem }`). It's
free — `id` is already fetched inside the fragment; selecting it at the parent
level just keeps the key field visible after masking. Enforced for every
operation and fragment by `__tests__/graphql/maskingIdentity.test.ts`.

Pattern B template (preferred for new sheets/detail components):

```tsx
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { XFragmentDoc, type XFragment } from './X.generated';

interface Props {
  itemRef: FragmentType<typeof XFragmentDoc> | XFragment;
  // …other props
}

export const Foo: React.FC<Props> = ({ itemRef, … }) => {
  const fragmentResult = useFragment({
    fragment: XFragmentDoc,
    fragmentName: 'X',
    from: itemRef,
  });
  const item: XFragment = fragmentResult.complete
    ? fragmentResult.data
    : (itemRef as XFragment);
  // …direct field reads on `item`
};
```

**Guard scalar reads** that would crash on undefined when the fallback
fires (e.g. `parseISO(item.startDate)`, arithmetic on `item.qty`).
`complete: false` means the cache doesn't have every field the fragment
selects — the cast to `XFragment` lies in that case, and unguarded reads
on the masked-ref fallback will throw. Either gate the dangerous read
(`item.startDate && parseISO(item.startDate)`) or use Pattern A:

```tsx
const item: XFragment | null = fragmentResult.complete
  ? fragmentResult.data
  : null;
if (!item) return null;
```

Tests must wrap with `renderWithApollo` from `__tests__/helpers/apolloMockProvider`
(so `useFragment` has an Apollo context) and include `__typename` on the literal
fixture. For hooks that read from cache via `cache.readFragment`, use
`seedCache([...])` to pre-write the entity. **Do not
`jest.mock('@apollo/client/react', …)` directly** — banned by the lint rule
(`no-restricted-syntax`).

**Mutation optimistic responses** materialize their fragment from cache and
spread/inline into the response shape. Two cases:

1. **Hook reads via `cache.readFragment` then calls `enhanceWithVersion`** (when
   the fragment shape matches the mutation's payload shape) — annotate the
   return type with `Unmasked<TData>`. This is the one and only feature-code
   site where `Unmasked<>` is allowed and expected (Apollo's
   `optimisticResponse?: Unmasked<NoInfer<TData>> | ...` signature requires
   it). Example: `usePantryItemMutations.ts`.

2. **Hook constructs the optimistic shape field-by-field** (when the mutation
   selects narrower fields than the hook's read fragment) — return type
   annotation isn't required if every field is inlined explicitly, but
   `Unmasked<TData>` is still preferred for clarity. Example:
   `useToggleShoppingItem.ts`.

**`Unmasked<>` is reserved for `optimisticResponse` callbacks** — nowhere
else in feature code. The HKT registration in `src/types/apollo-masking.d.ts`
is required for `FragmentType<typeof Doc>` to resolve.

**Never write `as unknown as X`** — it hides type mismatches. If a cast feels necessary,
fix the data flow or widen the type contract.

**`useSuspenseQuery` / `useBackgroundQuery` — use selectively, not by default.** For this
React Native app the practical benefit is small:

- No SSR, so the streaming-SSR benefit Apollo markets doesn't apply.
- `cache-and-network` + persisted MMKV cache already gives instant paint on cold start,
  which is what Suspense + cache-first would give.
- `if (loading)` / `if (error)` moves from the component body to a `<Suspense>` + error
  boundary wrapper — net LOC is roughly identical.
- Mixed-source screens (Apollo + REST API) still need manual loading coordination for
  the non-Apollo half, defeating the simplification.

Reach for `useSuspenseQuery` when a new screen has **2+ independent parallel queries**
that benefit from `useBackgroundQuery` waterfall avoidance. Otherwise stay with `useQuery`.

**File layout:**

- Shared fragments live in per-feature `*Fragments.graphql`:
  `src/graphql/operations/auth/userFragments.graphql`,
  `src/features/pantry/graphql/pantryFragments.graphql`,
  `src/features/shoppingList/graphql/shoppingListFragments.graphql`,
  `src/features/mealPlan/graphql/mealPlanFragments.graphql`,
  `src/features/recipes/graphql/recipeFragments.graphql`.
- All other fragments are colocated next to their consuming component or
  hook (e.g. `PantryItemCard.graphql`, `InviteCard.graphql`,
  `useUpdatePantryItem.graphql`).
- Use the `#operations/<domain>/...` alias for imports rather than long
  relative paths.

**Screen-level materialization fragments** (e.g. `PantryItemDetail_pantryItem`
composing `PantryDetailInfo_pantryItem` + `PantryItemForm_pantryItem` via
spread) are the right shape when a single screen needs the union of its
children's data — the screen owns one fragment, children own theirs, and
the screen fragment spreads them.

**Why not `client-preset`:** the client-preset bundles its own
type-level fragment-masking helper (`@graphql-codegen/client-preset`'s `useFragment`) that
**conflicts** with Apollo Client 4.x's runtime data masking. Apollo's docs explicitly
advise against client-preset for AC4 projects. Our `near-operation-file` setup already
emits `TypedDocumentNode`s, which is all Apollo's `FragmentType<typeof Doc>` and runtime
masking need.

### Test Mock Conventions — `Environment`

`Environment` (`src/utils/environment.ts`) is auto-mocked globally for every
test via `jest.setup.js` + `src/utils/__mocks__/environment.ts`. Tests get a
complete `jest.fn()` surface with sensible defaults (dev mode, analytics off,
loggers as no-op spies). This eliminates `TypeError: Environment.X is not a
function` failures from any code that transitively pulls in the store, the
telemetry slice, `IconButton → HapticService`, or anywhere else.

**For tests that need bespoke values:**

```ts
// ✅ Override per-suite via mockReturnValue — do not replace the whole module
import { Environment } from '#/utils/environment';
beforeEach(() => {
  (Environment.isDevelopment as jest.Mock).mockReturnValue(false);
  (Environment.getApiConfig as jest.Mock).mockReturnValue({
    baseUrl: 'https://test.example.com/graphql',
  });
});
```

```ts
// ✅ For the rare suite that tests the real Environment class itself
jest.unmock('#/utils/environment');
import { Environment } from '../environment';
```

```ts
// ❌ Don't do this — partial factories defeat the shared mock and reintroduce
//    the per-test "missing method" fragility we removed:
jest.mock('#/utils/environment', () => ({
  Environment: { isDevelopment: jest.fn() }, // missing all other methods
}));
```

The same pattern applies to `logger` (no-op `jest.fn()` per method) — assert on
`logger.error` etc. directly without redefining the mock.

### i18n Convention

**Two ways to translate, and they differ only by whether you are in a component.**

```ts
import { useTranslation } from '#/i18n'; // components and hooks
const { t } = useTranslation();

import { t } from '#/i18n'; // module scope: services, utilities,
// mutation onError handlers
```

The module-scope `t` does **not** subscribe to language changes. A
`no-restricted-syntax` rule enforces the hook in every `src/**/*.tsx`; a file
that genuinely needs the module-scope one (a class component like
`ErrorBoundary`, module-level config) imports it aliased as `tGlobal`, which
keeps a bare `t(...)` in JSX unambiguously the hook's.

There used to be four idioms, and nine files used two at once depending on
whether the string had a variable in it. Don't reintroduce a third — in
particular, `getI18n().t(...)` is no longer needed for interpolation: `t` takes
i18next's full options (`t('key', { count })`, `t('key', 'English fallback')`).

> The old `src/i18n/t.ts` helper reimplemented key-echo, string fallback and
> `fallbackLng`, all of which i18next does natively. Verified against the
> installed `i18next@26`; the probe is recorded in the docblock of
> `src/i18n/index.ts`. Because it could not pass options, 25 call sites across
> 15 files routed around it — which is what a helper that duplicates its
> library costs.

**Error and empty-state copy has one home.** `errors.*`, `empty.*` and
`labels.*` are canonical. A feature namespace must not redeclare a string one of
them already has — 33 did, which is why the same English rendered as different
Albanian depending on the screen. Enforced by
`__tests__/i18n/canonicalVocabulary.test.ts`, with an exemption list where each
entry names its exact key set and must still describe a live duplicate.

**Never concatenate a number with a translated noun.**

```ts
`${count} ${t('recipes.ingredientsSuffix')}`; // ✗ "1 ingredients"
t('recipes.ingredientCount', { count }); // ✓
```

Concatenation loses plural agreement, bakes English word order into code, and
skips locale number formatting. Give each plural form its own whole sentence
rather than interpolating a word into one. Enforced by
`__tests__/i18n/numberNounConcatenation.test.ts`, which also bans appending a
literal `'s'` — that shape produced "2 lattinas" in Italian and "2 kgs" in
English.

**Plural categories are derived, not hand-written.**
`completePluralCategories` in `src/i18n/config.ts` fills any CLDR category a
locale needs but its JSON lacks, from `_other`, before `init`.

> A missing category is not graceful degradation. Verified against `i18next@26`:
> it does NOT fall back to that locale's `_other` — it falls through to
> `fallbackLng`, so an Italian user at a count of 1,000,000 reads `1000000 items` in English. Spanish and Italian need `many`; nothing this app counts
> reaches it, so the 82 hand-written strings would never have rendered.
> `__tests__/i18n/pluralCategories.test.ts` asks `Intl.PluralRules` which
> categories each locale needs rather than hardcoding one/other, so a locale
> added later is checked for whatever IT needs.

**Never inflect copy for the reader's gender.** The app does not know it, does
not ask, and in a two-gender language there is no correct form for a non-binary
person — so a `context` parameter cannot be right, only less often wrong. Use a
construction with no gendered slot; every locale here has one:

```
it  "Sei sicuro di voler X?"   ->  "Vuoi davvero X?"
sq  "Je i sigurt që do ta X?"  ->  "Vërtet dëshiron ta X?"
es  "¡Bienvenido a X!"         ->  "¡Te damos la bienvenida a X!"
```

Enforced by `__tests__/i18n/addresseeGender.test.ts`. This is about the
ADDRESSEE only — an adjective agreeing with a **noun** is correct and lives in
per-context keys (`labels.default` → `Predeterminado`,
`storageLocationCard.default` → `Predeterminada`). That is a fact about the
language, not about the data, so it belongs in the key, never in a runtime
parameter.

**None of the guards proves completeness.** A string reaching JSX through a
variable is invisible to all of them — 36% of `<Text>` children arrive that way.
Typing the sink was measured (it costs ~0 to typecheck) and rejected as too
invasive; pseudolocalization is the preferred answer when this is picked up.
See `docs/i18n-architecture.md`.

### Session End Convention

**`authService.logout()` is the only sign-out.** There were two paths clearing
different subsets, and the profile button used the weaker one — so the previous
person's notification inbox, scanner history, item-autocomplete LRU and queued
mutations survived a sign-out on a shared device.

`SESSION_SCOPED_STATE` in `src/store/resetManager.ts` is the single list of what
a session end removes. `resetStore` applies it in memory and
`clearAuthFromStorage` deletes the same keys from the persisted blob, so the two
cannot disagree. It spreads the notification and scanner slices' own
`initial*State`, so a field added to either is cleared without anyone
remembering.

`__tests__` equivalent lives at `src/store/__tests__/sessionEndLeavesNoData.test.ts`:
it plants a marker in **every** key of the real `PERSISTED_KEYS` allowlist and
requires each survivor to be named in `KEPT_ON_PURPOSE` with a reason. Adding a
persisted key fails the test until someone classifies it.

**A session end must also STOP things, not just clear them.** Clearing the tokens
leaves the socket dialling, in-flight queries landing and the offline queue
waking — all against credentials the server has already refused, which is what
the user sees as a screen that never loads. `endSession` therefore runs
`runSessionTeardown()` (`src/store/sessionTeardown.ts`) _before_ the state reset.

That registry exists because the steps live in the Apollo layer while
`endSession` lives in the store, and importing both ways closes the cycle
`store → resetManager → apollo/client → links → store`. Each module registers
its own step at module init — `logoutCleanup` the Apollo teardown, `queueManager`
the drain cancel — the same hand-off `registerApolloClient` and
`registerTokenRefresh` use. Three things about it are load-bearing:

- **`completeLogout()` must run after `performLogoutCleanup()`.** That latch makes
  `authLink` and `errorLink` refuse every operation; left set, the next sign-in
  cannot send its login mutation.
- **`queueManager.onLogout()` is deliberately NOT called.** It deletes the user's
  queued writes, and a rejected refresh token is not the user choosing to discard
  unsynced work. Only the pending drain is cancelled; the entries wait for that
  user's next sign-in. `onLogout` stays on the deliberate sign-out path.
- **`apiReachabilityBreaker`'s `/health` probe keeps running.** It is
  unauthenticated, and the sign-in screen needs to know whether the API is up.

### Token Refresh & WebSocket Close Codes

**Both transports rotate, and that is safe** — but only because the server tells
a lost race apart from a dead session. Rotation is single-use; when an HTTP
refresh and a WebSocket handshake reach for the same token, the loser is refused
`AUTH_REFRESH_TOKEN_SUPERSEDED`, which means the winner's successor is valid and
the session is alive. `AUTH_REFRESH_TOKEN_INVALID` is the terminal one. Never
collapse the two: signing out on the first ends a session the server considers
perfectly healthy.

**The hazard that remains is re-presenting a token you already know was spent.**
The server forgives a replay for ten seconds and then reads it as compromise,
revoking the whole token lineage — successor included. So the retry rule is not
"retry on superseded", it is **retry only once a different token is stored**
(`retryWithSuccessorToken` in `refreshToken.ts`). An unchanged token means our own
response was the one that went missing and no successor exists anywhere; there is
nothing to recover, so defer rather than spend the lineage looking. That decision
lives in one place, and the socket's 4403 handling routes through it rather than
reconnecting straight into a second rotation attempt — the reconnect backoff
crosses the ten-second window by its fourth attempt.

`connectionParams` sends the refresh token on every connect. The server spends it
only when the access token has actually expired, so an ordinary connect costs
nothing, and the rotated pair comes back in the `connection_ack` payload — the
only delivery there will ever be.

**graphql-ws owns the reconnect loop. The app owns only the verdict.**
The library re-dials after every retryable close, re-evaluating
`connectionParams` each attempt; `retryWait` in `wsLink.ts` supplies the backoff
curve and parks a retry while the device is offline. `shouldRetry` is the single
hook over that loop and answers one question — **is this verdict terminal** —
reading `src/apollo/links/wsCloseCodes.ts`. `shouldAutoReconnect` is folded into
it, because it is now the only thing that can stop a re-dial.

Do NOT add a second backoff beside it. There was one: a timer whose only action
was `wsClient.terminate()`, which is `if (connecting) emit('closed')` — a no-op
once a socket has closed, since graphql-ws clears `connecting` in its own close
handler. It could interrupt a live connection; it could never dial one, so every
path that looked like recovery silently wasn't.

| Code                      | Meaning                                                            | Response                                                         |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 4403                      | Token is stale — expired, or superseded by a rotation we lost      | **Never terminal.** Retry; one HTTP refresh as a fast path       |
| 4410                      | Subscription lifetime cap                                          | Retry with the counter reset, so the next wait is the base delay |
| 4411                      | Build below the server minimum                                     | Stop; prompt to update                                           |
| 4412                      | Session unrecoverable — at the handshake **or** revoked mid-stream | Stop **and** `endSession`                                        |
| 4429 / 4500               | Transient, but the library refuses to retry them regardless        | The subscription layer re-subscribes (see below)                 |
| 4413                      | API key refused                                                    | Stop, but do **not** sign the user out — it is a build fault     |
| 1006 / 1000               | Transient                                                          | Library retry with backoff                                       |
| 4400 / 4401 / 4406 / 4409 | Protocol violation                                                 | Stop; only a code change fixes it                                |

**`shouldRetry` is not consulted for every code.** `shouldRetryConnectOrThrow`
(graphql-ws `dist/client.js:278`) rethrows 4400, 4401, 4406, 4409, 4429, 4500 and
the internal fatal range before reaching it — and a rethrow errors every active
subscription's sink. Apollo's `useSubscription` has no auto-restart, so those
subscriptions are finished until something re-subscribes.
`useSubscriptionTransportRecovery` is what does, on the line after every
`useSubscription`; `isLibraryFatalCloseCode` records the list.

**Never branch on the close reason.** Each code carries exactly one verdict, and
the same reason string is emitted for several distinct conditions.

**A session end must drop the socket client, not just dispose it.** `dispose()`
latches `disposed` inside graphql-ws with no reset, and a disposed client
connects once and then refuses every retry — silently. `disposeWebSocket()`
therefore clears the reference so the next `enableAutoReconnect()` builds a fresh
one.

### Bundled Credentials Convention

Every credential-shaped var in `generate-env.js`'s `KEYS` must be classified in
`scripts/check-bundled-secrets.mjs` as `PUBLIC_BY_DESIGN` or
`ACCEPTED_FINDINGS`, or the build fails.

The test is not "can it be extracted" — everything in a binary can be, and
obfuscation does not change that. It is **what does this grant a hostile
holder?** A credential is `PUBLIC_BY_DESIGN` only if it is write-only or
identity-only, individually revocable, and rate-limited server-side (the
Sentry-DSN / Datadog-client-token shape). An infrastructure credential — a
storage backend's basic auth — never qualifies, however narrowly scoped.

Decisions and their reasoning: `docs/bundled-credentials-decision.md`.

### Verification Commands

After implementing fixes, run:

```bash
npm run typecheck  # Verify TypeScript changes
npm run lint       # Verify code quality
npm test           # Run test suite
```

Two checks are not part of those, and nothing runs them for you:

```bash
node scripts/check-compiler-bailouts.mjs   # no new React Compiler bailouts,
                                           # and no extracted leaf re-absorbed
node scripts/check-bundled-secrets.mjs --self-test
```

`check-compiler-bailouts` guards a file COUNT and, separately, WHICH function
bails in the files where a variant call was deliberately extracted into a leaf —
moving it back into the composite keeps the count unchanged and would otherwise
pass.

`npm run check:version-sync` runs on **pre-push**, alongside `typecheck`,
`i18n:check` and `check:codegen-orphans`. It compares `package.json`,
`versionName`, and **each** `MARKETING_VERSION` in the pbxproj. A failure means
the mismatched platform would ship reporting a version it is not: `getVersion()`
is native, so the version-keyed Apollo cache purge
(`ApolloCachePersistence.ts`) never fires there and `CLIENT_VERSION` reaches the
server's minimum-version gate wrong — with nothing else failing to warn you,
which is exactly why it is a hook and not a habit. iOS
`CURRENT_PROJECT_VERSION` and Android `versionCode` are deliberately NOT
compared: they are per-platform build counters on independent sequences, read by
`getBuildNumber()`.
