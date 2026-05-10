- to regenerate the schema run npm run codegen
- always run npm run typecheck and npm run lint after making code changes to ensure no typescript and linting errors were introduced
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

### Pressable & Modal Convention

- **Use `Pressable` from `#components/atoms/themedComponents`** as the default across
  the app. That export is `withUnistyles(GHPressable)` — it integrates with the RNGH
  gesture system *and* keeps the underlying View's style proxies in sync with theme
  changes. Importing `Pressable` directly from `react-native-gesture-handler` works
  for gestures but its child View does **not** repaint on theme change until a
  remount (unistyles#1109), which is why theme switches appeared partial until the
  app was reopened.
- **Exception: inside RN's `<Modal>`**, always use `Pressable` from `react-native`.
  React Native's `Modal` renders in a separate native window that has **no
  `GestureHandlerRootView` ancestor**. RNGH components (Pressable, RectButton,
  GestureDetector, etc.) silently stop responding to touches without that root view.
  If you must use RNGH components inside a Modal, wrap the Modal content in
  `<GestureHandlerRootView>` (see `SpotlightCoachMark.tsx` for an example).
- **`ScrollView` from `react-native-gesture-handler`** is only needed when the scroll
  container has RNGH gesture components inside it (Swipeable, GestureDetector, pan
  gestures). For plain forms, settings, and display screens, use `ScrollView` from
  `react-native`.

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
- **Merging a `style` prop with themed styles is supported.** Unistyles'
  [official "Merging styles" guide](https://www.unistyl.es/v3/guides/merging-styles/)
  recommends `<View style={[styles.x, callerStyle]} />`, and the React
  Compiler interaction bug ([unistyles#368](https://github.com/jpudysz/react-native-unistyles/issues/368),
  fixed in [PR #672](https://github.com/jpudysz/react-native-unistyles/pull/672))
  was resolved upstream — the babel plugin now parses variants on
  `Program.enter` so the React Compiler's auto-memoization no longer hides
  theme deps. Just use the array merge pattern; no wrapper or `'use no memo'`
  directive is needed.
- **Navigators must use `inactiveBehavior: 'none'`** in `screenOptions`. The
  default `'pause'` behavior in `@react-navigation/native-stack` v8 and
  `@react-navigation/bottom-tabs` v8 freezes inactive screens, preventing
  Unistyles ShadowTree updates from reaching them — the visible symptom is a
  theme change that only applies after navigating back. See
  [react-native-unistyles#1183](https://github.com/jpudysz/react-native-unistyles/issues/1183).

The Unistyles babel plugin must run **before** `babel-plugin-react-compiler`
(see `babel.config.js`); reversing the order produces compile errors.

### React Compiler Conventions

- **Do not use `useMemo` or `useCallback`.**  The `babel-plugin-react-compiler` plugin automatically
  memoizes values and callbacks. Manual `useMemo`/`useCallback` is redundant and should not be added.
- **Never write try-catch or try-finally inside hook/component bodies.** The React Compiler
  bails out entirely on hooks containing try-catch **or try-finally**, preventing
  auto-memoization of all derived values. The `react-compiler/react-compiler` ESLint rule
  has a [known bug](https://github.com/facebook/react/issues/35644) where it **silently
  stops reporting all diagnostics** when encountering unsupported syntax like `finally` —
  producing zero warnings instead of flagging the bailout. The `react-hooks/todo` rule
  catches these silent bailouts. Use the shared helpers from `src/utils/compilerSafeWrappers.ts`
  instead.
- **Never read/write `ref.current` during render.** Use the "adjusting state during render"
  pattern (`useState` + conditional `setState`) for comparing previous/current values.
- **Hook return objects are auto-memoized by the compiler** — but only if the compiler doesn't
  bail out. Once try-catch is extracted, return objects like `{ actions }` become stable automatically.
- **`React.memo` is unnecessary** — the compiler caches JSX elements at the parent call site,
  making `React.memo` redundant. This includes FlashList/FlatList `renderItem` components:
  FlashList v2's `ViewHolder` already applies `===` reference equality on `item`, and the
  compiler memoizes inline `renderItem` functions in compiled parents. Do not add `React.memo`
  or custom comparators to any component.

### `scheduleOnRN` Worklet Convention

Functions passed to `scheduleOnRN` (Reanimated's `runOnJS` replacement) **must be pre-defined
in RN runtime scope**. Inline arrow/function expressions inside worklets cause native crashes
on Android because the worklet serializer cannot capture closures created at call-site.

```ts
// CORRECT — callback defined in RN scope
const handlePress = (id: string) => { /* ... */ };
const gesture = Gesture.Tap().onEnd(() => {
  scheduleOnRN(handlePress)(id);
});

// WRONG — inline function crashes on Android
const gesture = Gesture.Tap().onEnd(() => {
  scheduleOnRN(() => handlePress(id))();  // native crash
});
```

**Never pass function references as arguments to `scheduleOnRN`.** Functions cannot be
serialized across the worklet boundary — they arrive as plain objects in release mode,
causing `TypeError: Object is not a function`. Only pass primitives (strings, numbers,
booleans). Capture function dependencies via RN-scope closure instead:

```ts
// CORRECT — capture onDismiss via closure, pass only primitives
const handleDismiss = () => { onDismiss(id); };
scheduleOnRN(handleDismiss);

// WRONG — passing a function reference through the worklet boundary
scheduleOnRN(dismissEntry, onDismiss, id);  // onDismiss is an object in release
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

| Subfolder | Public? | Notes |
|---|---|---|
| `screens/` | ✅ Public | Imported by navigation stacks |
| `manifest.ts` | ✅ Public | Wired into `FEATURE_REGISTRY` |
| `hooks/` (top-level files only) | ✅ Public | Cross-feature consumers may import top-level hooks |
| `components/` | ⚠️ Mostly internal | Shared UI atoms/molecules belong in `src/components/`; feature-private cards/rows stay here |
| `context/` | 🔒 Internal | Cross-feature consumers should not reach into another feature's context |
| `graphql/` | 🔒 Internal | Other features should compose their own queries; only the feature's own hooks read from these documents |
| `hooks/mutations/`, `hooks/<deeper>/` | 🔒 Internal | Lifecycle / mutation primitives — stay within the feature |
| `utils/` | 🔒 Internal | Feature-specific helpers — stay within the feature |

**Cross-feature reach is OK only for:** `screens`, `manifest`, top-level `hooks`,
and the `<feature>Fragments.generated.ts` types (when composing your own
fragments). Anything deeper (`hooks/mutations/...`, `context/`, `utils/`) is an
implementation detail and may change without notice.

This is enforced via ESLint `no-restricted-imports` patterns in `.eslintrc.js`
(see the `from feature internals` rule). Migrations of working code are not
required — the rule only blocks NEW reach-across imports.

### Apollo Test Patterns

**Always use `renderHookWithApollo` / `renderWithProviders` from `__tests__/helpers/`.**
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
  { request: { query: GetItemDoc, variables: { id: '1' } },
    result: { data: { item: { __typename: 'Item', id: '1', name: 'A' } } } },
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

**Migration gotchas (from the P1-16 sweep):**

1. **`errorPolicy: 'all'` defeats `executeMutation`'s catch path.** The shared
   `apolloMockProvider` wrapper sets `mutate: { errorPolicy: 'all' }`, so Apollo
   mutations never throw — they resolve with `{ data: undefined, error }`. Hook
   code wrapped in `executeMutation(fn, onError)` therefore never invokes
   `onError` on Apollo errors, breaking failure-path tests. Workaround: mock
   `executeMutation` directly with
   `mockImplementationOnce((_, onError) => { onError(new Error('fail')); return false; })`.

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

| Pattern | Use when | Example |
|---|---|---|
| **`writeFragment`** (preferred default) | Mutation returns the full updated entity | `useAdjustPantryItemQuantity` — server returns the patched item, fragment write syncs cache |
| **`cache.modify`** | Need to update parent aggregate / stat fields not in the response | `useUpdatePantryItem` — patches `Pantry.stats` counts after a location change |
| **`cache.modify` on connection edges + parent counts** | Entity moves between filtered connections (purchased ↔ unpurchased, list ↔ list) | `useToggleShoppingItem`, `useRemoveShoppingItem` |
| **`refetchQueries`** (last resort) | Mutation affects unrelated queries / root-level aggregates that can't be derived from the response | `useRecipeReviews` (rating stats on the parent recipe) |

Defaults:
- `optimisticResponse` for any user-facing mutation; the cache update should be idempotent so the eventual server response converges cleanly.
- `errorPolicy: 'all'` so partial-data errors are surfaced to the hook, not swallowed.
- Avoid `refetchQueries` unless `cache.modify` would require duplicating server logic (e.g., recomputing aggregate ratings).
- Build optimistic responses from the existing cache via `cache.readFragment` + spread, never with hand-rolled placeholder shapes that can drift from the schema.

### Autocomplete Local-First Search

All autocomplete hooks use `useAutocompleteSearch` from `src/hooks/ui/useAutocompleteSearch.ts`.
When a hook provides `fallbackItems` + `filterFallback`, it can opt into **local-first** search
by passing `localFirst: true`. This filters cached/local items first and only fires the API
if no local matches exist — eliminating unnecessary network requests for common lookups.

**Current status:**

| Hook                             | `localFirst` | Notes                                       |
|----------------------------------|:------------:|---------------------------------------------|
| `useUnitAutocomplete`            | `true`       | Uses `cachedUnits` from Zustand             |
| `useBrandAutocomplete`           | `true`       | Uses `suggestedBrands` fallback              |
| `useCategoryAutocomplete`        | `false`      | No cached data yet — add when categories are cached |
| `useItemAutocomplete`            | `false`      | No cached data yet — add when items are cached |
| `useStorageLocationAutocomplete` | N/A          | Fully local, doesn't use `useAutocompleteSearch` |

When adding cached data to a new autocomplete hook, pass `localFirst: true` along with
`fallbackItems` and `filterFallback` to enable local-first behavior.

**Staleness guard:** `useAutocompleteSearch` tracks the last term sent to `search()` via
`lastFiredTerm` state. API results are only displayed when `searchTerm.startsWith(lastFiredTerm)`
(case-insensitive). This prevents stale results from appearing when the user types faster than
the debounce cycle — e.g., switching from "app" to "banana" won't flash "app" results.
Consumer hooks do not need to implement their own relevance checks.

### Apollo: Fragment Colocation Convention (new code)

Apollo Client 4.x recommends colocated fragments + `useFragment` for new components,
and runtime data masking (`dataMasking: true`) once enough consumers are migrated. The
existing 256+ `useQuery` sites and 39 fragments in `src/graphql/operations/fragments.graphql`
predate this and stay as-is — **don't migrate working code opportunistically**. New
components and new entity-consuming child components should follow the convention below.

**New non-page components that consume entity data:**

- Define a colocated fragment named `<ComponentName>_<propName>` next to the component
  (NOT in `src/graphql/operations/fragments.graphql` — that file is legacy).
- Accept `FragmentType<typeof MyFragmentDoc>` (from `@apollo/client`) as the prop type,
  not the raw fragment type.
- Read fields via `useFragment` (from `@apollo/client/react`), not direct property access.
  This creates a per-entity cache subscription so the child re-renders only when its own
  fields change — a real win in deep component trees, available even before `dataMasking: true`
  is flipped globally.
- The page-level query composes the child fragments via codegen's automatic inlining;
  no manual fragment interpolation needed.

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

**Existing code:**

- The legacy `src/graphql/operations/fragments.graphql` monolith has been deleted.
  Fragments are organized by domain: `auth/userFragments.graphql`,
  `home/homeFragments.graphql`, `item/itemFragments.graphql`,
  `mealPlan/mealPlanFragments.graphql`, `pantry/pantryFragments.graphql`,
  `recipe/recipeFragments.graphql`, `shoppingList/shoppingListFragments.graphql`.
  Multi-consumer fragments live in those domain files; single-consumer fragments
  (e.g. `MealPlanItemCard_item`, `InviteCard_invite`) are colocated next to their
  component.
- Use the `#operations/<domain>/...` alias for imports rather than long relative paths.
- Don't migrate working `useQuery` sites or fragment consumers opportunistically.
  Convert only when you're touching the area for another reason and the conversion
  is small.

**Why `dataMasking: true` is NOT set globally:** flipping the flag strips fragment fields
from parent query results, which would break every existing direct-access consumer (e.g.
`item.recipe?.name` would return `undefined`). The flag flips only after enough consumers
are migrated to `useFragment`, which is a separate, scoped initiative.

**Why we don't use graphql-codegen's `client-preset`:** the client-preset bundles its own
type-level fragment-masking helper (`@graphql-codegen/client-preset`'s `useFragment`) that
**conflicts** with Apollo Client 4.x's runtime data masking. Apollo's docs explicitly
advise against client-preset for AC4 projects. Our `near-operation-file` setup already
emits `TypedDocumentNode`s, which is all Apollo's `FragmentType<typeof Doc>` and runtime
masking need.

### Verification Commands

After implementing fixes, run:

```bash
npm run typecheck  # Verify TypeScript changes
npm run lint       # Verify code quality
npm test           # Run test suite
```
