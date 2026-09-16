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
- [Code conventions](#code-conventions)
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

There are twelve: `pantry`, `shoppingList`, `recipes`, `mealPlan`, `home`,
`barcode`, `notifications`, `profile`, `catalog`, `auth`, `onboarding`,
`devtools`. Only the first four declare a `tab`; the rest are reached from
headers, buttons, push taps or the root navigator's groups. Removing a feature
from a fork is deleting its folder and its registry entries.

### Three registries

The feature list exists three times, split by who reads it and when:

- `registry.ts` (`FEATURE_REGISTRY`) — the screen-bearing manifests navigation
  iterates.
- `registry.static.ts` (`STATIC_FEATURE_REGISTRY`) — every feature as the APP
  SHELL sees it: feature locales for i18n init and push-notification routes,
  declared in each feature's `manifest.static.ts`. Its consumers run on the
  LAUNCH path, and importing the screen-bearing registry there pulls the whole
  component graph in with them. `staticFeatureRegistry.test.ts` fails when a
  static manifest reaches a screen or a component, or a feature has none.
- `registry.cache.ts` (`FEATURE_TYPE_POLICIES`) — each feature's cache type
  policies, read by `src/apollo/cache.ts`. A list of its own rather than a
  manifest field, because policies on a static manifest drag the queue store,
  the Zustand store and `apollo/client` into i18n init;
  `launchPathWeight.test.ts` holds that line.

A feature that needs shell wiring adds to its `manifest.static.ts`; it never
adds an import of the screen-bearing registry to a launch-path module.

### The public API boundary

A feature is a module with a small public surface. Reaching past it is blocked
by ESLint (`no-restricted-imports` + `import/no-restricted-paths`) for **new**
imports:

| Subfolder                         | Public? | Notes                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screens/`                        | ✅      | Imported by navigation stacks                                                                                                                                                                                                                                                                                       |
| `manifest.ts`                     | ✅      | Wired into `FEATURE_REGISTRY`                                                                                                                                                                                                                                                                                       |
| `testIDs.ts`                      | ✅      | The feature's testIDs; imported by the app and by e2e page objects                                                                                                                                                                                                                                                  |
| `hooks/` (top-level files only)   | ✅      | Cross-feature consumers may import these                                                                                                                                                                                                                                                                            |
| `<feature>Fragments.generated.ts` | ✅      | Type imports only, when composing your own fragments                                                                                                                                                                                                                                                                |
| `components/`                     | 🔒      | A component two features want is a KIT component — promote it to `src/components/`                                                                                                                                                                                                                                  |
| `ui/` (catalog only)              | ✅      | The catalog's public UI. Its pickers are domain UI two features consume, so they can go in neither a domain-free kit nor one consumer                                                                                                                                                                               |
| `context/`                        | 🔒      | Internal                                                                                                                                                                                                                                                                                                            |
| `graphql/`                        | 🔒      | Compose your own operations instead                                                                                                                                                                                                                                                                                 |
| `hooks/mutations/`, deeper hooks  | 🔒      | Internal lifecycle primitives                                                                                                                                                                                                                                                                                       |
| `utils/`                          | 🔒      | Internal                                                                                                                                                                                                                                                                                                            |
| `store/` (recipes only)           | ✅      | The recipe result caches. Two other features read them (pantry's per-item suggestions, mealPlan's recipe picker), so like catalog's `ui/` they belong in neither a domain-free kernel nor one consumer. A feature store MUST call `registerSessionScopedStore` — `SESSION_SCOPED_STATE` only reaches the root store |
| `offline/` (pantry, shoppingList) | 🔒\*    | Public to the OFFLINE QUEUE only. A feature's sync builders say what its queued mutation's input means, which nothing but the replayer needs — the kernel imports it, other features may not                                                                                                                        |

Shared UI atoms, molecules, organisms, and templates live in `src/components/`,
beside `providers/` and `performance/`. That is the whole taxonomy — there is no
`base/`, `charts/`, `modals/`, `navigation/` or `settings/`. A component's tier
follows from what it RENDERS, not from taste (`src/components/atoms/README.md`):
`DataStateView` is a molecule, because routing between Loading, Error and Empty
is composition, not a primitive. UI one feature renders stays in that feature's
`components/` (the pantry form is `src/features/pantry/components/form/`).
Shared hooks live in `src/hooks/`. If two features need the same thing, it moves
up — it doesn't get imported sideways, and it doesn't get imported _downwards_
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
app reuses wholesale. It does not import `#features/…` (an
`import/no-restricted-paths` zone in `eslint/boundaries.js`), own a `.graphql`
document, or carry a file named after a domain. Only the import direction has a
gate; the `.graphql` and naming halves are held by review.

The **kernel** (`src/apollo/`, `src/store/`, `src/utils/`, …) carries no module
NAMED after a feature either. Its feature IMPORTS are load-bearing — the offline
queue replays every feature's writes, i18n bundles every feature's copy, the
subscription layer mounts every feature's events — and are governed by the same
`eslint/boundaries.js` zones. The per-feature navigation stacks in
`src/navigation/stacks/` are exempt by design.

**A module in the shared layers is there because more than one feature uses it.**
Reach counts TRANSITIVELY — a hook used only by an atom that only pantry renders
belongs to pantry too. A module with a single consumer is one to move.

`src/domain/` is the exception the rule needed: logic several features share, in
neither a domain-free kit nor one feature's internals. Admission is by the same
consumer count — two or more features, or it belongs in the one that uses it.

Every feature has the same shape:
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

`src/screens/` holds only `SplashScreen` and `NotFoundScreen` — the two the app
shows before any feature is reachable. Auth and onboarding are features like
every other, with their own data layer; their stacks in
`src/navigation/stacks/` spread a `screens/registration.ts` the feature owns.

Their session PRIMITIVES stay in the kernel, which is a different question from
where their screens live: `src/graphql/operations/auth` is imported by
`refreshToken.ts` and `authService.ts`, and `useIsLoggedOut` and
`useEmailVerification` are read by every feature. `auth` and `onboarding`, like
`home`, `profile` and `notifications`, name a concept every app of this shape
has, so a shared module named for one is not by itself evidence of feature
coupling.

### Import aliases

`tsconfig.json` `paths` is the single source of the `#` aliases.
`babel.config.js` and `jest.config.js` derive theirs from it through
`scripts/lib/aliases.js`, and ESLint reads it via `import/resolver.typescript`.
Separately maintained lists drift, each with its own matching semantics, and an
alias present in `tsconfig` alone type-checks and then fails to resolve at
runtime — so an alias is added in that one place.

---

## State: two systems, one rule

**The rule: if the server owns it, Apollo owns it. Otherwise Zustand owns it.**

|              | Apollo Client                                                         | Zustand (`useAppStore`)                                                        |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Owns         | Pantry items, lists, recipes, meal plans, homes, users, notifications | Selected home/pantry/list, preferences, auth session, network status, UI flags |
| Persisted to | MMKV via `cache.extract()` / `cache.restore()`                        | MMKV via `zustandStorage` (tokens go to Keychain)                              |
| Read with    | `useQuery` / `useFragment` / `cache.readFragment`                     | Named hooks from `#store/useAppStore`                                          |

Notifications are the worked example of that rule. The feed, each row's
read-state and the unread count are server state, so they live only in the
cache: a copy in a Zustand slice, written from the same server events with no
rule for which is current, lets a mark-read from this device and a `READ` event
from another leave the row and the badge disagreeing.
`features/notifications/utils/notificationCacheWrites.ts` is the single
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

### Feature-owned stores

State nothing outside a feature reads lives with that feature rather than as a
root slice; `src/features/notifications/store/` is the worked example, and the
recipe result caches (`recipe-search-cache`, `recipe-suggestions-cache`) are
another. `SESSION_SCOPED_STATE` in `resetManager.ts` reaches only the ROOT
store, so a feature store that does not call
`registerSessionScopedStore(name, reset)` keeps its data across a sign-out with
nothing failing. `sessionEndLeavesNoData.test.ts` and
`sessionEndClearsPersistedFeatureStores.test.ts` assert a populated feature
store is emptied by `LOGOUT`.

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
as a surprise codegen failure later (`fields-on-correct-type` and
`no-deprecated` are errors). The schema reaches the parser as
`parserOptions.graphQLConfig` in `eslint/project.js`: graphql-eslint@4 has no
flat `schema` option and errors at PARSE time when one is present, which reads
as every document failing rather than as a config problem.

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

Set in `src/apollo/defaultOptions.ts` (`dataMasking: true` in `src/apollo/client.ts`):

|                          | Default             | Why                                                                          |
| ------------------------ | ------------------- | ---------------------------------------------------------------------------- |
| `watchQuery.fetchPolicy` | `cache-and-network` | Paint from the persisted cache immediately, refresh in the background        |
| `query.fetchPolicy`      | `cache-first`       | A one-shot read works offline; a caller needing fresh data opts out          |
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
with `PaginationFooter` (`src/components/atoms/PaginationFooter.tsx`) as the
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
  while blurred.** `'none'` does not make watchers free: a live watcher on
  another tab's query re-renders the hidden tab on every write there, and a
  consumer keyed by that data (`useRecipeDiscovery`, keyed by the ingredient
  list) calls its API from a hidden tab. So it passes
  `{ skip: !isFocused, fetchPolicy: 'cache-first' }` driven by
  `useFocusEffect`. `cache-first` is load-bearing: Apollo resets a re-enabled
  query to its initial policy, so `skip` alone costs a `cache-and-network`
  round-trip per focus. `usePreservedConnection` holds the last result across
  the skip, so nothing downstream moves while blurred.

---

## The UI layer

### React Compiler

`babel-plugin-react-compiler` handles memoization. Consequences:

- **No `useMemo` / `useCallback` / `React.memo`.** The compiler memoizes, and
  `React.memo` on list cells is redundant — FlashList v2's `ViewHolder` already
  does reference equality on `item`. There is no escape hatch:
  `eslint-comments/no-use` bans every `eslint-disable` directive repo-wide, so a
  disable comment is itself an error, and `check-compiler-bailouts` holds zero
  bailouts as an invariant — a file that bails is a regression to fix, not a
  licence to memoize. Where a stable
  reference is genuinely needed for a **dependency array**, hoist the function
  to module scope and pass what it needs as arguments.
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

### The screen scaffold and the sheet shell

Chrome is composed once, not per screen.

- **`Screen`** (`src/components/templates/Screen.tsx`) is a screen's frame:
  `header` (`standard | tab | collapsing | none`, with title, actions, back,
  close, and the offline pill), `scroll` (`none | scroll | form | list`),
  `gutter`, `refresh` and `state`. It never applies the top inset — the
  navigator does that; a bare `<SafeAreaView>` with no `edges` insets all
  four sides and is how a double inset usually happens. `scroll: 'list'` supplies the
  container only: a pull-to-refresh control has to reach the FlashList itself,
  never the scaffold, or RNGH cannot route the scroll gesture into it.
- **`Sheet`** (`src/components/templates/Sheet.tsx`) is a bottom sheet's shell:
  `view | form | action | list`; `list` hands a scrollable that fills the sheet
  to the modal, since `BottomSheetView` cannot bound one. `form` brings both the keyboard offset and the input
  context, so every `TextInput` under it resolves to gorhom's
  `BottomSheetTextInput` rather than RN's, which would leave the sheet blind to
  the keyboard. `__tests__/sheets/bottomSheetShell.test.ts` holds it.
- **`FormScreen`** is a full-screen form — a screen with a form's chrome. It is
  not a sheet and does not share a mechanism with one.

### Typography roles

Text is set by a named ROLE, never by a size and a weight. The eleven roles live
in `src/theme/foundations/type.ts` (`display`, `title`, `subheading`, `heading`,
`body`, `bodyStrong`, `caption`, `label`, `footnote`, `footnoteStrong`, `error`) and each carries size, weight,
leading and tracking together — and only those. **Colour is `tone`'s job**, so
`role="error"` pairs with `tone="error"`; a role that carried a colour would
decide it in a place the caller cannot see.

`<Text role="caption">`, never `<Text size="sm">`. An element that cannot take
the prop — a `TextInput`, a shared style module — spreads
`...theme.type.<role>`. `size`, `weight` and `lineHeight` remain on `Text` as
kit-only escape hatches; outside `src/components/**` they are a second
definition of a role that already exists.

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

## Code conventions

### Type-level gates

`@typescript-eslint/no-unnecessary-condition` runs on all of `src/**`, with no
exclusions. It earns its place on one shape nothing else catches: a METHOD read
without calling it. TypeScript's own
TS2774 is emitted only from an `if` condition, a ternary condition and the left
operand of `&&`/`||`, and `!fn` types as `boolean`, which has no call signatures
— so `!Environment.isProduction` is always `false`, and a gate written that way
switches its branch off in every build while typecheck, lint and the full suite
stay green.

Most findings the rule raises are `?.` and null guards on data that codegen types
as non-nullable and the server does not guarantee. Deleting such a guard to
satisfy the rule trades a lint finding for a runtime crash, so the fix is a dead
branch deleted or the over-promising type widened where it is DECLARED — never a
cast at the call site, and never an exclusion.

Two shapes cover it. Where a library's declared type is narrower than its runtime
(`ApolloClient.mutate` under `errorPolicy: 'none'` types `data` as present, while
`QueryManager` resolves `{ data: undefined }` for a `{"data": null}` response),
annotate the receiving variable with the honest shape — `const response: { data?:
T } = await client.mutate(…)`. Annotating a DESTRUCTURED binding instead does not
work: control-flow analysis narrows the union straight back from the initializer.
Where a closed codegen enum is dispatched on, a trailing `!== LastMember` guard
reads as dead; a `switch` with a `default` keeps the unknown-subtype path without
a condition the types can call unnecessary.

`noUncheckedIndexedAccess` makes `arr[0]`, `record[key]` and a regex capture
group read as `T | undefined`, so a guard on one is necessary rather than noise.
A lookup table annotated `Record<string, …>` erases its key set and makes every
read optional; keyed by its real key type (the codegen enum, or the type the
keys come from), a literal-key read is defined and a missing or misspelled key
is a compile error. `sous-chef/no-unchecked-domain-literal` reports a table
whose keys are one generated enum's values while it is keyed by `string`.

### Comments

A comment that narrates a fix outlives the fix and then lies: it describes a
bug, or a design, that the code beneath it does not have. Present tense keeps
it checkable against the code it sits on; what changed and when belongs in
git and the PR. A test still names the defect its case pins, stated as the
behaviour it asserts: "a chip sizes to the row, not its label". `no-warning-comments` catches the narrating vocabulary and
`sous-chef/no-dated-comment` catches the date a change-log entry carries. Both
cover `src/**`, `__tests__/**` and `e2e/**`; `scripts/`, the root config files
and `.graphql` stay outside, because plain-substring matching has a false
positive in each.

A doc block describes the declaration directly beneath it. Blocks drift onto a
different declaration when code is inserted or reordered — sometimes hundreds
of lines from what they describe — and "the function above/below" goes stale
the same way, which `{@link other}` does not.

---

## Directory map

```
src/
├── apollo/          Client, cache, links, offline queue, cache persistence
├── assets/          Bundled images and fonts
├── components/      Shared UI in four TIERS: atoms · molecules · organisms ·
│                    templates, plus providers and performance. A component's
│                    tier follows from what it renders
├── config/          Generated env config
├── constants/
├── context/         App-level React context
├── domain/          Domain logic SEVERAL features share — neither kit nor one
│                    feature's internals; admission is by consumer count
├── features/        The twelve feature modules (see above), registry.ts for
│                    navigation and registry.static.ts for the app shell
├── graphql/         Shared operations, generated schema + types
├── hooks/           Shared hooks ONLY — what more than one feature uses:
│                    apollo, offline, ui, search, auth, performance,
│                    navigation, autocomplete, subscriptions, …
├── i18n/            i18next config + locale JSON
├── native/          Native module bindings
├── navigation/      RootNavigator, stacks, layouts
├── screens/         SplashScreen and NotFoundScreen only
├── services/        Push, subscriptions, telemetry, Spoonacular,
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
