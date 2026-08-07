# Architecture

How Sous Chef is built and organized. This is the orientation document — read
it first, then follow the links into the deep dives.

- [The shape of the app](#the-shape-of-the-app)
- [Feature modules](#feature-modules)
- [State: two systems, one rule](#state-two-systems-one-rule)
- [The data layer](#the-data-layer)
- [Offline-first](#offline-first)
- [Navigation](#navigation)
- [The UI layer](#the-ui-layer)
- [Directory map](#directory-map)

---

## The shape of the app

Sous Chef is a **GraphQL client**. Every piece of durable data — pantry items,
lists, recipes, meal plans, homes — lives on the backend API. The app's entire
job is to make remote data behave like local data: instant on cold start,
writable while offline, and consistent across everyone in a shared home.

That goal drives most of the architectural choices below.

```
┌─────────────────────────────────────────────────────────┐
│  Screens & components  (features/, screens/)            │
├─────────────────────────────────────────────────────────┤
│  Hooks — the seam between UI and data                   │
│    feature hooks · shared hooks · store hooks           │
├───────────────────────────┬─────────────────────────────┤
│  Apollo Client 4          │  Zustand                    │
│  server state             │  device & UI state          │
│  ├ normalized cache       │  ├ selections               │
│  ├ data masking           │  ├ preferences              │
│  ├ offline queue          │  ├ auth session             │
│  └ subscriptions          │  └ network status           │
├───────────────────────────┴─────────────────────────────┤
│  MMKV (persistence) · Keychain (secrets)                │
├─────────────────────────────────────────────────────────┤
│  GraphQL API  (HTTP + WebSocket)                        │
└─────────────────────────────────────────────────────────┘
```

---

## Feature modules

Everything user-facing lives in a self-contained module under `src/features/`:

```
src/features/pantry/
├── screens/       # Navigation entry points
├── components/    # Feature UI
├── hooks/         # Data + behavior
│   └── mutations/ # Internal mutation primitives
├── graphql/       # Operations and shared fragments
├── context/       # Feature-scoped React context
├── utils/         # Feature-specific helpers
└── manifest.ts    # What this feature contributes to navigation
```

Each feature declares itself through a **manifest**, and
`src/features/registry.ts` holds the canonical list. Navigation iterates the
registry to build tabs — nothing else knows the feature list:

```ts
export const pantryFeature: FeatureManifest = {
  id: 'pantry',
  tab: {
    screenName: 'Pantry',
    title: 'navigation.tabs.pantry',
    order: 10,
    stack: PantryStack,
  },
};
```

Features without a tab (`barcode`, `notifications`, `profile`) omit `tab` and
are reached from headers, buttons, or push taps. Removing a feature from a fork
is deleting its folder and its registry entry.

### The public API boundary

A feature is a module with a small public surface. Reaching past it is blocked
by ESLint (`no-restricted-imports` + `import/no-restricted-paths`) for **new**
imports:

| Subfolder | Public? | Notes |
| --- | --- | --- |
| `screens/` | ✅ | Imported by navigation stacks |
| `manifest.ts` | ✅ | Wired into `FEATURE_REGISTRY` |
| `hooks/` (top-level files only) | ✅ | Cross-feature consumers may import these |
| `<feature>Fragments.generated.ts` | ✅ | Type imports only, when composing your own fragments |
| `components/` | ⚠️ | Shared UI belongs in `src/components/`; feature-private cards stay here |
| `context/` | 🔒 | Internal |
| `graphql/` | 🔒 | Compose your own operations instead |
| `hooks/mutations/`, deeper hooks | 🔒 | Internal lifecycle primitives |
| `utils/` | 🔒 | Internal |

Shared UI atoms, molecules, organisms, and templates live in `src/components/`.
Shared hooks live in `src/hooks/`. If two features need the same thing, it moves
up — it doesn't get imported sideways.

---

## State: two systems, one rule

**The rule: if the server owns it, Apollo owns it. Otherwise Zustand owns it.**

| | Apollo Client | Zustand (`useAppStore`) |
| --- | --- | --- |
| Owns | Pantry items, lists, recipes, meal plans, homes, users | Selected home/pantry/list, preferences, auth session, network status, UI flags |
| Persisted to | MMKV via `cache.extract()` / `cache.restore()` | MMKV via `zustandStorage` (tokens go to Keychain) |
| Read with | `useQuery` / `useFragment` / `cache.readFragment` | Named hooks from `#store/useAppStore` |

### Reading from the store

The store exposes **named hooks** — use them. They wrap a pre-built selector so
components only re-render when that slice changes:

```ts
import {
  useUser,
  useSelectedHomeId,
  useIsOnline,
} from '#store/useAppStore';

const user = useUser();
const homeId = useSelectedHomeId();
const isOnline = useIsOnline();
```

Grouped hooks (`usePantryState`, `usePreferences`, `useAuthTokens`, …) use
`useShallow` internally, so destructuring several related values costs one
subscription.

For a one-off selection with no named hook, call `useAppStore` with an inline
selector:

```ts
const someFlag = useAppStore(state => state.someFlag);
```

**Never subscribe to the whole store.** `useStore` from `#store` is the raw
Zustand store — it exists for `storeApi` and non-React access, not for
components. Subscribing to it re-renders on every state change anywhere.

### Slices

`src/store/slices/` — `appSlice`, `authSlice`, `barcodeScannerSlice`,
`navigationSlice`, `networkSlice`, `notificationSlice`, `performanceSlice`,
`preferencesSlice`, `telemetrySlice`, `uiSlice`. `resetManager.ts` coordinates
clearing them on logout.

Session tokens are written through to the **Keychain**, not MMKV — see the
`authSlice` write-through and hydration ordering.

---

## The data layer

### Codegen, not hand-written types

`.graphql` operation files sit next to the component or hook that uses them.
`npm run codegen` pulls the schema, then emits a `TypedDocumentNode` and
TypeScript types into a sibling `*.generated.ts`:

```
PantryItemCard.tsx
PantryItemCard.graphql        # fragment PantryItemCard_pantryItem on PantryItem
PantryItemCard.generated.ts   # generated — committed
```

Generated files are committed, and a pre-push hook fails if they're stale.
`npm run lint` also validates every `.graphql` file against the pulled schema,
so a renamed or newly deprecated server field surfaces at lint time rather than
as a surprise codegen failure later.

### Fragment colocation and data masking

`dataMasking: true` is on globally. Each component or hook owns its fragment
(`<Consumer>_<entity>`), screens compose children's fragments by spread, and
queries spread the screen fragment. Components materialize data through
`useFragment` rather than receiving deep prop trees.

One rule worth internalizing: **any selection set that spreads a fragment
identifying its type must also select `id` directly.** Masking hides the
fragment's fields from the parent, including the key field — without an explicit
`id`, `cache.identify` throws. `__tests__/graphql/maskingIdentity.test.ts`
enforces this for every operation.

Full guidance — cache update patterns, optimistic responses, fetch policy
decision trees, subscription handling, test patterns — is in
**[`apollo-client-patterns.md`](apollo-client-patterns.md)**.

### Client defaults

Set in `src/apollo/client.ts`:

| | Default | Why |
| --- | --- | --- |
| `watchQuery.fetchPolicy` | `cache-and-network` | Paint from the persisted cache immediately, refresh in the background |
| `query.fetchPolicy` | `network-only` | One-shot reads should be fresh |
| `errorPolicy` (all) | `all` | Partial data + errors both reach the hook, instead of errors swallowing data |

### Links

`src/apollo/links/` composes the request pipeline: auth and token refresh,
persisted queries, retry, offline-mode gating, API reachability probing and
circuit breaking, network status, telemetry, error handling, and the WebSocket
link for subscriptions.

### Pagination

Connections paginate through `usePagination` (`src/hooks/utils/usePagination.ts`)
with `PaginationFooter` (`src/components/organisms/PaginationFooter.tsx`) as the
list footer:

```tsx
const { hasMore, loadMore, isLoadingMore } = usePagination({
  pageInfo: data?.itemsConnection?.pageInfo,
  loading,
  itemCount: items.length,
  fetchMore,
  cursorVariableName: 'cursor',
});

<FlashList
  data={items}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  ListFooterComponent={
    <PaginationFooter
      hasMore={hasMore}
      isFetchingMore={isLoadingMore}   // only shows the indicator mid-fetch
      itemCount={items.length}
      SkeletonComponent={PantryItemSkeleton}
      skeletonCount={3}
    />
  }
/>
```

Always pass `isFetchingMore` — without it the footer falls back to `hasMore`
and shows persistent skeleton rows at the bottom of a list that merely *has*
another page, which reads as flicker.

New paginated connections use `itemsConnectionFieldPolicy()` or
`mergeConnectionByNodeId()` for merge logic, and `extractNodes()` /
`normalizeConnection()` to read edges.

---

## Offline-first

Three mechanisms, working together:

**1. Cache persistence.** The Apollo cache is written to MMKV verbatim via
`cache.extract()` and restored with `cache.restore()` on launch
(`src/apollo/offline/ApolloCachePersistence.ts`). No transformation — connection
fields (`edges`, `pageInfo`) are preserved, so queries resolve from cache
instantly on cold start. `cache-and-network` then refreshes in the background;
brief stale pagination state is expected and self-corrects.

**2. A mutation queue.** `src/apollo/offlineQueue/` intercepts mutations while
offline, converts them to replayable `Sync*` operations, and drains the queue on
reconnect. Writes apply to the cache **before** firing (local-first) rather than
via `optimisticResponse`, because Apollo tears optimistic layers down when a
mutation "completes" — and offline, completion is the queue's null result, which
would visibly revert the change while it sits queued.

Because there's no refetch to paper over gaps offline, **optimistic entities
must be complete for every query that reads them**. A single missing field makes
the whole cache read incomplete and the row disappears.
`__tests__/apollo/optimisticEntityCompleteness.test.ts` runs the real schema and
asserts `cache.diff()` reads complete for the optimistic builder, the create
mutation's selection, and the queue's replay fragment.

**3. Subscriptions.** `graphql-ws` pushes changes from other members of a shared
home; handlers write entities through with `cache.writeFragment`.

The user-visible surface is the offline banner (offline / server unreachable /
*N* pending / back online) and an explicit Offline Mode toggle in settings.

Deep dive: **[`local-first-architecture.md`](local-first-architecture.md)**.

---

## Navigation

React Navigation 8, static API. `RootNavigator.tsx` defines the top-level
groups: `Auth`, `Verification`, `Onboarding`, `BiometricSetup`, `MainApp`, and
`DeepLinks`.

Inside `MainApp`, `HomeTabs` is a bottom tab navigator built from `TAB_FEATURES`
(the registry, sorted by `order`) with a custom `FloatingTabBar`. Each tab hosts
a per-feature native stack: `PantryStack`, `ShoppingListStack`, `RecipeStack`,
`MealPlanStack`.

Two structural decisions worth knowing:

- **Detail screens are root-level siblings of `HomeTabs`, not nested inside tab
  stacks.** This keeps the floating tab bar structurally off detail screens and
  avoids a stuck-hidden race.
- **Navigators default to `inactiveBehavior: 'pause'`, except `HomeTabs` and the
  root `Home` screen, which use `'none'`.** `'pause'` (React 19 `Activity`)
  destroys every layout effect in a hidden subtree and re-runs them
  synchronously on resume — for a tab subtree of four FlashLists plus every
  mounted cell's animations, that's a multi-second JS freeze. The trade is
  higher idle memory for the tabs.

---

## The UI layer

### React Compiler

`babel-plugin-react-compiler` handles memoization. Consequences:

- **No `useMemo` / `useCallback` / `React.memo`.** They're redundant, and
  `React.memo` on list cells is counterproductive — FlashList v2's `ViewHolder`
  already does reference equality on `item`.
- **No `try`/`catch` or `try`/`finally` inside hook or component bodies.** The
  compiler bails out on the entire hook, silently losing all auto-memoization.
  Use the shared helpers in `src/utils/compilerSafeWrappers.ts`.
- **Never read or write `ref.current` during render.** Use the adjusting-state-
  during-render pattern instead.

### Unistyles 3

`StyleSheet.create(theme => …)` pushes theme changes straight to native through
the C++ ShadowTree — no React re-render. That only holds if theme reads happen
inside the factory:

- Use `StyleSheet.create(theme => …)` for RN primitives, and
  `styles.useVariants({ … })` for runtime flags.
- Use `withUnistyles(Component)` for third-party components taking
  theme-derived props — but **never** on `Pressable`/`TouchableX`, where the
  wrapper drops `StyleSheet.create` proxies inside function-style `style`
  callbacks.
- Use `useUnistyles()` only for runtime metadata (`rt.colorScheme`,
  `rt.themeName`, `rt.insets`), not for reading `theme.*`.
- Shared themed wrappers live in `src/components/atoms/themedComponents.tsx`.

The Unistyles babel plugin must run **before** the React Compiler plugin.

### Lists

**FlashList v2** for anything that can grow — it's in ~60 files. Plain
`ScrollView` is for static, bounded content (settings, forms).
`SortableShoppingList` handles drag-and-drop. Never `.map()` an unbounded list
inside a `ScrollView`.

`estimatedItemSize` is deprecated in FlashList v2 and must not be used. See
[`flashlist-performance-analysis.md`](flashlist-performance-analysis.md).

### Bottom sheets

Always `BottomSheetModal` (never `BottomSheet`) via the `useStandardBottomSheet`
hook, driven by a `visible` boolean rather than imperative `present()`/
`dismiss()`. The app has a global backdrop system
(`OverlayBackdropProvider` + `GlobalBackdrop`); inline `BottomSheet` backdrops
conflict with it. See
[`backdrop-lifecycle-design.md`](backdrop-lifecycle-design.md).

### Theming and design tokens

`src/theme/` holds foundations (colors, typography, spacing, radii, shadows,
sizes, breakpoints, zIndex), theme composition, and the appearance system —
light/dark/system, brand color, density, font scale, and high contrast, all
derived at runtime (`derivePalette.ts`, `applyAppearance.ts`).

### Internationalization

`src/i18n/locales/` — `en`, `es`, `it`, `sq`, kept in lockstep. `npm run
i18n:check` (also a pre-push hook) fails on drift between locale files.

---

## Directory map

```
src/
├── apollo/          Client, cache, links, offline queue, cache persistence
├── assets/          Bundled images and fonts
├── components/      Shared UI: atoms · molecules · organisms · templates
│                    plus charts, forms, modals, navigation, providers, settings
├── config/          Generated env config
├── constants/
├── context/         App-level React context
├── features/        Feature modules (see above) + registry.ts
├── graphql/         Shared operations, generated schema + types
├── hooks/           Shared hooks: apollo, offline, ui, search, auth, home,
│                    performance, navigation, autocomplete, subscriptions, …
├── i18n/            i18next config + locale JSON
├── native/          Native module bindings
├── navigation/      RootNavigator, stacks, layouts
├── screens/         Cross-cutting screens: auth, home management, onboarding
├── services/        Push, subscriptions, telemetry, recipe API (Spoonacular),
│                    haptics, permissions, performance, alerts, errors, toasts
├── storage/         MMKV wrappers
├── store/           Zustand store, slices, reset manager
├── styles/
├── theme/           Design tokens, themes, appearance system
├── types/
└── utils/
```

Supporting directories at the repo root: `__tests__/` (integration tests and
shared helpers), `__mocks__/`, `e2e/` (Detox), `scripts/` (build, codegen,
tagging), `infra/`, `docs/`.

---

## See also

- [`development.md`](development.md) — setup, commands, build variants, testing
- [`apollo-client-patterns.md`](apollo-client-patterns.md) — the Apollo deep dive
- [`local-first-architecture.md`](local-first-architecture.md) — offline queue and sync
- [`performance-monitoring.md`](performance-monitoring.md) — instrumentation
- `CLAUDE.md` (repo root) — the enforced day-to-day conventions
