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

There are eight: `pantry`, `shoppingList`, `recipes`, `mealPlan`, `home`,
`barcode`, `notifications`, `profile`. Features without a tab (`barcode`,
`home`, `notifications`, `profile`) omit `tab` and
are reached from headers, buttons, or push taps. Removing a feature from a fork
is deleting its folder and its registry entry.

### The public API boundary

A feature is a module with a small public surface. Reaching past it is blocked
by ESLint (`no-restricted-imports` + `import/no-restricted-paths`) for **new**
imports:

| Subfolder                         | Public? | Notes                                                                   |
| --------------------------------- | ------- | ----------------------------------------------------------------------- |
| `screens/`                        | ✅      | Imported by navigation stacks                                           |
| `manifest.ts`                     | ✅      | Wired into `FEATURE_REGISTRY`                                           |
| `hooks/` (top-level files only)   | ✅      | Cross-feature consumers may import these                                |
| `<feature>Fragments.generated.ts` | ✅      | Type imports only, when composing your own fragments                    |
| `components/`                     | 🔒      | A component two features want is a KIT component — promote it to `src/components/` |
| `ui/` (catalog only)              | ✅      | The catalog's public UI. Its pickers are domain UI two features consume, so they can go in neither a domain-free kit nor one consumer |
| `context/`                        | 🔒      | Internal                                                                |
| `graphql/`                        | 🔒      | Compose your own operations instead                                     |
| `hooks/mutations/`, deeper hooks  | 🔒      | Internal lifecycle primitives                                           |
| `utils/`                          | 🔒      | Internal                                                                |

Shared UI atoms, molecules, organisms, and templates live in `src/components/`.
Those four are the whole taxonomy — there is no `base/`. It existed as a fifth
name for the atoms bucket and folded into `atoms/` (`DataStateView` went to
`molecules/`, since routing between Loading, Error and Empty is composition, not
a primitive).
Shared hooks live in `src/hooks/`. If two features need the same thing, it moves
up — it doesn't get imported sideways, and it doesn't get imported *downwards*
either: a hook owned by one feature lives in that feature, and `src/hooks/` holds
only what more than one feature uses. Both directions are enforced by
`import/no-restricted-paths` zones.

A zone's `from` may name a directory that does not exist yet, and 18 do. That is
deliberate: the boundary around `mealPlan/context/` is declared before anyone
creates it, so the first import into it is blocked rather than grandfathered.

`src/config/appConfig.ts` is the fork-point: identity, deep links, brand colour,
the keychain namespace, which locales ship, and `features` — a per-feature
`false` that drops it from `FEATURE_REGISTRY`'s enabled set without touching the
feature. The keychain strings are pinned by
`src/storage/__tests__/keychainServiceNames.test.ts`: the OS keychain is keyed by
service name, so changing one on a shipped app signs every user out silently.

`src/app/` is the composition root: the modules whose whole job is to know which
features exist — the provider that mounts each feature's subscriptions, the
offline tab preloader. They are not reusable and a sibling app writes its own, so
they sit outside the kit rather than being excused from its rule.

`src/components/` and `src/hooks/` together are the **kit** — the layer a sibling
app reuses wholesale. `scripts/check-layer-purity.mjs` ratchets what the kit knows
about a feature: an import of `#features/…`, a colocated `.graphql` document, or a
file named after a domain. The recorded baseline is the backlog, and it may only
shrink. Generated-schema-type imports are counted but do not fail — that coupling
only costs when a sibling app has a different schema.

Both baselines are empty, so both are invariants rather than backlogs.

`scripts/check-feature-shape.mjs` ratchets the other half: every feature has
`manifest.ts` (whose `id` equals its directory name), `screens/`, `hooks/` and
`components/`, and a feature with more than one screen declares
`screens/registration.ts`. A `.graphql` document beside its consumer is the
convention, not a deviation — see § Fragments.

One asymmetry in those zones is deliberate: `graphql/` is absent from the
shared-layer zone (while feature-to-feature zones do block it). The offline
queue replays every feature's `Sync*` mutations and the subscription layer
mounts every feature's event subscription centrally, so neither can move into
a feature — listing `graphql/` would need ~19 `except` entries and excuse more
than it forbids. Generated operation documents are typed and side-effect-free;
treating them as a feature's data contract is the honest reading. `context/`,
`utils/` and `hooks/mutations/` carry behaviour and stay private, with four
named exceptions that each say why. Tests are exempt — a cache test has to
import the fragment it exercises. The rules block NEW reach-across imports;
migrating working code is not required.

`src/screens/` holds auth and onboarding only. Those are flows rather than
domains — they have no feature-shaped data layer, and they run before a home
exists. Every domain, `home` included, is a folder under `src/features/`.

---

## State: two systems, one rule

**The rule: if the server owns it, Apollo owns it. Otherwise Zustand owns it.**

|              | Apollo Client                                          | Zustand (`useAppStore`)                                                        |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Owns         | Pantry items, lists, recipes, meal plans, homes, users, notifications | Selected home/pantry/list, preferences, auth session, network status, UI flags |
| Persisted to | MMKV via `cache.extract()` / `cache.restore()`         | MMKV via `zustandStorage` (tokens go to Keychain)                              |
| Read with    | `useQuery` / `useFragment` / `cache.readFragment`      | Named hooks from `#store/useAppStore`                                          |

Notifications are the worked example of that rule, because they used to break
it. The feed, each row's read-state and the unread count lived in a Zustand
slice AND in the Apollo cache, written from the same server events with no rule
for which was current — so a mark-read from this device and a `READ` event from
another could leave the row and the badge disagreeing. They now live only in the
cache; `features/notifications/utils/notificationCacheWrites.ts` is the single
place those transitions are applied, by both the user acting locally and the
subscription handler. What stays in the slice is the one part the cache cannot
hold: `pendingExpirationLinks`, a buffer for an `expirationNotificationChanged`
event that can arrive BEFORE the notification it enriches, when there is nothing
yet to attach it to.

### Reading from the store

The store exposes **named hooks** — use them. They wrap a pre-built selector so
components only re-render when that slice changes:

```ts
import { useUser, useSelectedHomeId, useIsOnline } from '#store/useAppStore';

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
`navigationSlice`, `networkSlice`, `notificationSlice` (the expiration buffer
only — see above), `performanceSlice`, `preferencesSlice`, `telemetrySlice`,
`uiSlice`. `resetManager.ts` coordinates
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

Full guidance — fragment composition and masking templates
([§ Fragment Composition & Data Masking](apollo-client-patterns.md#fragment-composition--data-masking)),
cache update patterns, optimistic responses, fetch policy decision trees,
subscription handling — is in
**[`apollo-client-patterns.md`](apollo-client-patterns.md)**.

### Client defaults

Set in `src/apollo/client.ts`:

|                          | Default             | Why                                                                          |
| ------------------------ | ------------------- | ---------------------------------------------------------------------------- |
| `watchQuery.fetchPolicy` | `cache-and-network` | Paint from the persisted cache immediately, refresh in the background        |
| `query.fetchPolicy`      | `network-only`      | One-shot reads should be fresh                                               |
| `errorPolicy` (all)      | `all`               | Partial data + errors both reach the hook, instead of errors swallowing data |

### Links

`src/apollo/links/` composes the request pipeline: auth and token refresh,
persisted queries, retry, offline-mode gating, API reachability probing and
circuit breaking, network status, telemetry, error handling, and the WebSocket
link for subscriptions. Session end, token rotation, and the WebSocket
close-code verdicts are covered in
[`session-and-transport.md`](session-and-transport.md).

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
      isFetchingMore={isLoadingMore} // only shows the indicator mid-fetch
      itemCount={items.length}
      SkeletonComponent={PantryItemSkeleton}
      skeletonCount={3}
    />
  }
/>;
```

Always pass `isFetchingMore` — without it the footer falls back to `hasMore`
and shows persistent skeleton rows at the bottom of a list that merely _has_
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
_N_ pending / back online) and an explicit Offline Mode toggle in settings.

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
  mounted cell's animations, that's a multi-second JS freeze. `Home` needs it
  too because native-stack only treats the screen directly under the focused
  one as active, so a deep push (`Home > Profile > HomeManagement >
  HomeDetail`) pauses the tabs from the second push down.

  **The trade is not idle memory — it's one resume freeze against continuous
  background work.** `'none'` keeps the blurred subtree mounted and
  subscribed: every Apollo `useQuery` in the hidden tabs keeps watching the
  cache and re-renders on any write touching its fields; subscriptions,
  `AppState`/`NetInfo` listeners and polling intervals keep firing; Reanimated
  and gesture effects keep running on every commit. Right for four FlashLists,
  wrong almost everywhere else — every other navigator stays on `'pause'`, and
  adding a fifth tab or a heavy subscription should prompt re-measuring.
  `HomeTabs.test.tsx` and `RootNavigator.test.tsx` assert these are the ONLY
  two opt-outs.

  **A secondary consumer of another tab's query must stand its watcher down
  while blurred.** `'none'` does not make watchers free: `useRecipeDiscovery`
  held a live `GetPantry` watcher, so every pantry delete re-rendered the
  hidden Recipes tab and — its discovery cache being keyed by the ingredient
  list — called the recipe API from a hidden tab. It now passes
  `{ skip: !isFocused, fetchPolicy: 'cache-first' }` driven by
  `useFocusEffect`. `cache-first` is load-bearing: Apollo resets a re-enabled
  query to its initial policy, so `skip` alone costs a `cache-and-network`
  round-trip per focus. `usePreservedConnection` holds the last result across
  the skip, so nothing downstream moves while blurred.

---

## The UI layer

### React Compiler

`babel-plugin-react-compiler` handles memoization. Consequences:

- **Default to no `useMemo` / `useCallback` / `React.memo` — a default, not an
  absolute.** The compiler memoizes for you in the ordinary case, and
  `React.memo` on list cells is usually redundant — FlashList v2's `ViewHolder`
  already does reference equality on `item`. Manual memoization is legitimate
  in exactly three places: a value that feeds a **dependency array**, a prop
  read by something the compiler did not compile (a third-party `===` check),
  and any file in the bailout baseline
  (`scripts/check-compiler-bailouts.baseline.json`). The lint rule is an error
  so the exception is written down: add
  `// eslint-disable-next-line no-restricted-imports` with the reason.
- **Two `try` shapes bail the compiler out of the whole function** (silently
  losing all its auto-memoization): a **finalizer** (`finally` with or without
  `catch`, and a catch-less `try`), and a **value block inside the `try` body**
  (`?.`, `??`, `&&`, `||`, or a ternary). A `try/catch` whose body is plain
  statements compiles fine — move the conditional part out of the `try`.
  Mechanism and probe:
  [`verified-library-behaviour.md`](verified-library-behaviour.md#react-compiler-try-shapes).
  For `finally` cases use the shared helpers in `src/utils/finallyHelpers.ts`;
  `node scripts/check-compiler-bailouts.mjs` is the backstop that actually
  compiles every file.
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

`estimatedItemSize` is **removed** in FlashList v2 — the prop no longer exists. List
`data` must never come through `useDeferredValue` / `startTransition` —
[`flashlist-layout-index-race.md`](flashlist-layout-index-race.md). How the two
big lists are fed and what an append costs:
[`flashlist-performance-analysis.md`](flashlist-performance-analysis.md).

### Bottom sheets

Always `BottomSheetModal` (never `BottomSheet`) via the `useStandardBottomSheet`
hook, driven by a `visible` boolean rather than imperative `present()`/
`dismiss()`. The app has a global backdrop system
(`OverlayBackdropProvider` + `GlobalBackdrop`); inline `BottomSheet` backdrops
conflict with it. See
[`backdrop-lifecycle-design.md`](backdrop-lifecycle-design.md). The two
verified gorhom mechanics behind the sheet rules — why a scrollable must never
sit inside `BottomSheetView`, and why sheet inputs must resolve to
`BottomSheetTextInput` — are recorded in
[`verified-library-behaviour.md`](verified-library-behaviour.md).

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
│                    plus charts, modals, navigation, providers, settings
├── config/          Generated env config
├── constants/
├── context/         App-level React context
├── features/        Feature modules (see above) + registry.ts
├── graphql/         Shared operations, generated schema + types
├── hooks/           Shared hooks ONLY — what more than one feature uses:
│                    apollo, offline, ui, search, auth, performance,
│                    navigation, autocomplete, subscriptions, …
├── i18n/            i18next config + locale JSON
├── native/          Native module bindings
├── navigation/      RootNavigator, stacks, layouts
├── screens/         Auth and onboarding flows only
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
- [`session-and-transport.md`](session-and-transport.md) — session end, token rotation, WS close codes
- [`verified-library-behaviour.md`](verified-library-behaviour.md) — the probe record behind the verified rules
- [`performance-monitoring.md`](performance-monitoring.md) — instrumentation
- `CLAUDE.md` (repo root) — the enforced day-to-day conventions
