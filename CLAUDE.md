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

### Pressable & Modal Convention

- **Use `Pressable` from `#components/atoms/themedComponents`** as the default
  across the app. That export is now React Native's `Pressable` (re-exported
  through the shared module so existing imports keep working). The Unistyles
  babel plugin auto-binds RN's `Pressable` to the C++ ShadowTree, so styles
  — including function-style `style={({pressed}) => [styles.X, ...]}` callbacks
  with `StyleSheet.create` proxies — and theme switches work natively without
  any wrapper.
- **Do not wrap `Pressable` with `withUnistyles(...)`.** Wrapping silently
  drops `StyleSheet.create` proxy values inside function-style `style`
  callbacks (unistyles#1109).
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
  silently drops `StyleSheet.create` proxy values inside function-style
  `style={({ pressed }) => [...]}` callbacks — layout, padding, and color rules
  declared in the referenced styles disappear at render time
  ([unistyles#1109](https://github.com/jpudysz/react-native-unistyles/issues/1109)).
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
  The cost is higher idle memory/CPU for the tabs. Every other navigator
  stays on the default `'pause'`. (Unistyles ShadowTree updates on paused
  screens are unrelated and already fixed as of `react-native-unistyles@3.3.0`.)

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

**Apollo test gotchas:**

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
| **No `update` callback** (preferred default) | Mutation returns the entity and Apollo auto-normalizes by `__typename + id` | `useAdjustPantryItemQuantity` — the mutation spreads the hook's fragment on the response; Apollo writes through automatically |
| **`cache.modify` on parent aggregates** | Need to update parent stat fields not in the response | `useRecipeReviews` — patches `Recipe.totalReviews` / `averageRating` / `rating{N}Count` aggregates (`recipeReviewCacheUpdaters`) after create/update/delete review. (`Pantry.stats` is instead kept current via the `Pantry.stats` `mergeObjects` field policy + mutation responses — no manual `cache.modify`.) |
| **`cache.modify` on entity fields BEFORE firing the mutation** | Optimistic UI without a callback — set fields synchronously, revert from a snapshot on error | `useToggleShoppingItem` — flips `purchaseInfo.isPurchased` + moves the item between purchased/unpurchased connections immediately, reverts in `onError` |
| **`updateEntityFieldsLocalFirst`** | Settings-shaped mutation: a normalized entity whose GraphQL field names ARE the flat setting names, updated a field or two at a time | `useAppSettings` (`UserSettings`), `useNotificationSettings` (`NotificationPreferences`) — writes the fields, fires with `context: { localFirst: true }`, reverts from the caller's `previous` snapshot only on `'rejected'` |
| **`cache.modify` on connection edges + parent counts** | Entity moves between filtered connections (purchased ↔ unpurchased, list ↔ list) | `useToggleShoppingItem`, `useRemoveShoppingItem` — `moveShoppingListItemTo*` helpers |
| **`writeFragment`** | Subscription handler receives an entity push and writes it through | `usePantrySubscriptions`, `useShoppingListSubscriptions` |
| **`refetchQueries`** (last resort) | Mutation affects queries whose shape can't be derived from the response | `CreateHomeScreen` (refetches home list after creating home), `useRecipePreload` |

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

| Hook                             | `localFirst` | Notes                                       |
|----------------------------------|:------------:|---------------------------------------------|
| `useUnitAutocomplete`            | `true`       | `cachedUnits` is the complete common-units set |
| `useBrandAutocomplete`           | `!isOnline`  | Warmed cache is first ~100 brands; full search online |
| `useCategoryAutocomplete`        | `!isOnline`  | Warmed cache is first ~100 categories; full search online |
| `useStoreAutocomplete`           | `!isOnline`  | Warmed cache is first ~100 stores; full search online |
| `useItemAutocomplete`            | `!isOnline`  | Seen-items LRU only; full catalog search online |
| `useStorageLocationAutocomplete` | N/A          | Fully local, doesn't use `useAutocompleteSearch` |

When adding cached data to a new autocomplete hook, pass `localFirst: !isOnline` unless the warmed
cache is provably complete for the dataset (only then is unconditional `true` correct).

**Staleness guard:** `useAutocompleteSearch` tracks the last term sent to `search()` via
`lastFiredTerm` state. API results are only displayed when `searchTerm.startsWith(lastFiredTerm)`
(case-insensitive). This prevents stale results from appearing when the user types faster than
the debounce cycle — e.g., switching from "app" to "banana" won't flash "app" results.
Consumer hooks do not need to implement their own relevance checks.

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

| Pattern | Prop type | Cache miss | Use for |
|---|---|---|---|
| **A — strict** | `FragmentType<typeof XDoc>` | `return null` on `!complete` | List cells (`MyRecipeCard`, `SavedRecipeCard`, `PantryItemCard`, `HomeMemberCard`) — brief blanking is OK |
| **B — resilient fallback** | `FragmentType<typeof XDoc> \| XFragment` | Fall back to source prop | Detail panels, sheets (`PantryDetailInfo`, `MealPlanSettingsSheet`) — must render without blanking |

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
  Environment: { isDevelopment: jest.fn() },  // missing all other methods
}));
```

The same pattern applies to `logger` (no-op `jest.fn()` per method) — assert on
`logger.error` etc. directly without redefining the mock.

### Verification Commands

After implementing fixes, run:

```bash
npm run typecheck  # Verify TypeScript changes
npm run lint       # Verify code quality
npm test           # Run test suite
```
