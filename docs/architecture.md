# Architecture

How Sous Chef is built and organized. This is the orientation document — read
it first, then follow the links into the deep dives.

- [The shape of the app](#the-shape-of-the-app)
- [Layers](#layers)
- [Feature modules](#feature-modules)
- [State: two systems, one rule](#state-two-systems-one-rule)
- [The data layer](#the-data-layer)
- [Offline-first](#offline-first)
- [Data ingestion seams](#data-ingestion-seams)
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

## Layers

Every production file in `src/` belongs to one of two layers:

- **core** runs without React Native. It holds the data layer, state, copy and
  domain logic, and loads in node with nothing from a device.
- **mobile** is the React Native app: screens, components, navigation, device
  services and the composition root.

| Core                                                                                                                                                                                      | Mobile                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `platform`, `apollo`, `domain`, `graphql`, `i18n`, `config`, `store`, `types`, `utils`                                                                                                    | `app`, `assets`, `components`, `constants`, `context`, `native`, `navigation`, `screens`, `styles`            |
| `services/` except the next column                                                                                                                                                        | `services/{push,permissions,haptic,notifications,performance,biometric,device}`, `NavigationService.ts`       |
| `hooks/{apollo,app,auth,data,deepLink,offline,search,settings,subscriptions,utils}`                                                                                                       | `hooks/{ui,animations,navigation,permissions,performance,device}`                                             |
| `theme/foundations/`                                                                                                                                                                      | the rest of `theme/`                                                                                          |
| `features/*/{hooks,cache,offline,graphql,utils,store,locales,constants}`, `manifest.static.ts`, `types.ts`, `pushCopy.ts`, and `features/{registry.static,registry.cache,staticTypes}.ts` | `features/*/{screens,components,ui,context}`, `manifest.ts`, `testIDs.ts`, and `features/{registry,types}.ts` |

**Classify by folder; move only what mixes.** A file takes its layer from where
it sits, so a new file needs no registration, and a file that would need an
exception moves to the folder of its layer instead. `src/hooks/` has no files at
its top level for that reason.

The map lives in `scripts/lib/layers.js`, the one copy lint, Jest and scripts
read. `__tests__/architecture/layerMembership.test.ts` fails when a file matches
no entry or two, naming the file.

The core is held two ways:

- **Lint** (`eslint/boundaries.js`). Every file carries a `core` or `mobile`
  category, and a `core` file may not import a `mobile` one, type
  imports included, whether by `import`, `import()` or `export … from`. Of
  packages it imports only `CORE_EXTERNALS`, and it names no host-only global
  (`window`, `navigator`, …), so `globalThis` it is, and none of Node's
  (`process`, `Buffer`, `require`, …), so build values come through the
  `environment` port. `__tests__/lint/layerPolicies.test.ts` pins what is blocked.
- **Types** (`tsconfig.core.json`, part of `npm run typecheck`). Every core
  file, checked with no host's ambient types (`types: []`) and React Native's
  language level plus the DOM's, so a React Native or Node global, or a
  React-Native-only API shape, fails to compile. `__DEV__`, which every host's
  bundler defines, is declared in `src/platform/buildGlobals.d.ts`.
  `layerMembership.test.ts` holds its file list to the core layer and its
  libraries to React Native's.
- **At runtime** (the `core-portability` Jest project). A node environment with
  no React Native preset, where every React-Native-family package throws when
  loaded and the in-memory platform is installed. `coreLoadsInNode.test.ts`
  loads every core file, so a reach anywhere in its imports fails, naming
  the package it got to. Other suites there run core flows with no device: a
  sign-out with no host steps registered, and the meal-plan writes,
  rendered through a probe component with `react-test-renderer`.

### Platform ports

The core reaches the device only through ports in `src/platform/`, in two kinds.

**Services** are installed once by the host, before any core module evaluates,
with `installPlatform()`. A core module reads one with
`requirePlatform('<name>')`, which throws `PlatformServiceMissing` naming the
service if the install has not happened, so nothing degrades silently.

| Service         | What it is                                                 | Mobile adapter                                     |
| --------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `environment`   | Build-time configuration (`Env`)                           | `env.generated.ts`, via `native/generatedEnv`      |
| `keyValueStore` | Synchronous storage, its readiness and recovery state      | MMKV (`native/storage/keyValueStore`)              |
| `secureStore`   | Session tokens, the durable device id, pending revocations | Keychain (`native/storage/secureStore`)            |
| `platformInfo`  | OS, installed version, emulator                            | `Platform`, react-native-device-info               |
| `appLifecycle`  | Foreground state and its changes                           | `AppState`                                         |
| `appearance`    | Applies a theme and appearance settings                    | The Unistyles runtime                              |
| `imagePrefetch` | Warms the image cache                                      | `CachedImage`'s `preloadImages`                    |
| `fileParts`     | Appends a picked file to a multipart body                  | `{ uri, type, name }`, streamed from disk          |
| `screen`        | Navigation intents and focus, as hooks run in a screen     | `useAppNavigation`, React Navigation's focus hooks |

`src/app/installNativePlatform.ts` assembles the mobile adapters, and `index.js`
imports it right after the startup clock, the startup profiler and the crypto
polyfill (`platformInstallOrder.test.ts` pins that). Each adapter delegates
through an arrow or a getter, so Metro's inline requires load a native module at
its first use, not during the install. `jest.setup.js` installs the in-memory
platform (`__tests__/helpers/memoryPlatform.ts`) the same way.

**Presenters** are what the core asks a host to show: toast and alert requests
(`platform/presenters.ts`), which a host registers. `docs/ui-layer.md`
§ Presenters has the mobile side.

The `screen` service is hooks rather than an object to call: a screen calls a
data hook in its own body, above anything a context provider in it could wrap,
so the host supplies the hooks themselves. `#platform/screen` exports them.

---

## Feature modules

Everything user-facing lives in a self-contained module under `src/features/`:

```
src/features/pantry/
├── screens/       # Navigation entry points, and the hooks only they use
├── components/    # Feature UI, and the hooks only it uses
├── hooks/         # Data + behavior (core)
│   └── mutations/ # Internal mutation primitives
├── graphql/       # Operations and shared fragments
├── context/       # Feature-scoped React context
├── utils/         # Feature-specific helpers
├── types.ts       # Shapes the core produces and the UI renders
└── manifest.ts    # What this feature contributes to navigation
```

A feature splits along the layers too (§ Layers). `hooks/` is core, so a hook
that renders, picks an icon, shapes FlashList rows or reaches a device API sits
beside the screen or component that uses it, and runs that UI's display query
there (`COLOCATED_DATA_HOOKS` in `eslint/boundaries.js`). A shape both sides
read, such as a form's values or a unit a picker lists, is declared in the
feature's `types.ts`, never in the component that renders it.

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
by ESLint (`no-restricted-imports` + `boundaries/dependencies`) for **new**
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
| `offline/` (pantry, shoppingList) | 🔒\*    | Public to the OFFLINE QUEUE only. A feature's replay preparers and reconcilers say what its queued mutation means, which nothing but the replayer needs — the kernel imports it, other features may not                                                                                                             |

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
`boundaries/dependencies` policies.

The policy matches a feature by CAPTURE — "an element whose captured
`featureName` differs from the importer's" — so it is one rule rather than a pair
of zones per feature, a feature is covered the day its directory exists, and a
directory that does not exist yet is already inside the boundary. A type-only
import of a generated fragment is `dependency.kind`, not a per-feature
exception list.

`src/config/appConfig.ts` is the fork-point: identity, deep links, brand colour,
the keychain namespace, which locales ship, and `features` — a per-feature
`false` that drops it from `FEATURE_REGISTRY`'s enabled set without touching the
feature.

A capability inside a feature is switched by `featureFlags` instead
(`src/config/featureFlags.ts`): a closed `FeatureFlag` union with a default
each. The fork's `appConfig.featureFlags` overrides the default, and a build's
`FEATURE_FLAGS` env value (`pantrySuggestions=off`) overrides both. Code reads a
flag only through `useFeatureFlag`. A flag the server owns
(`src/config/serverFeatureFlags.ts` maps each `FeatureFlagName`) is on only where
the build allows it AND the user's `myFeatureFlags` entry is `enabled`, which is
true exactly when its state is `ON`: a feature that needs a plan the user lacks
(`UPGRADE_REQUIRED`) reads as off. It is off until the first answer, and the
cached answer holds offline; a `FEATURE_DISABLED` or `PREMIUM_REQUIRED` refusal
re-reads it (`errorLink`). A flagged capability is a seam, not a branch in the
code it extends:

- the existing component takes it as an optional prop, and renders as before
  without it (`RecipeIngredientList`'s `onPasteIngredients`);
- or a selector picks between the code that predates it and the new code, each
  a separate hook (`useRecipeDiscovery` over `useCatalogDiscovery` and
  `useServerRecipeSuggestions`).

With the flag off, the feature does what it did before the capability existed. The keychain strings are pinned by
`src/native/storage/__tests__/keychainServiceNames.test.ts`: the OS keychain is keyed by
service name, so changing one on a shipped app signs every user out silently.

`src/app/` is the composition root: the modules whose whole job is to know which
features exist — the provider that mounts each feature's subscriptions, the
offline tab preloader — and the ones that assemble the host: the platform
install, the Apollo client built over the native socket (`apolloClient.ts`),
the session steps this device adds (`mobileSessionHost.ts`), and the startup
bootstrap (`useStartupInit`). They are not reusable and a
sibling app writes its own, so they sit outside the kit rather than being
excused from its rule.

`src/components/` and `src/hooks/` together are the **kit** — the layer a sibling
app reuses wholesale. It does not import `#features/…` (a
`boundaries/dependencies` policy in `eslint/boundaries.js`), own a `.graphql`
document, or carry a file named after a domain. Only the import direction has a
gate; the `.graphql` and naming halves are held by review.

The **kernel** (`src/apollo/`, `src/store/`, `src/utils/`, …) carries no module
NAMED after a feature either. Its feature IMPORTS are load-bearing — the offline
queue replays every feature's writes, i18n bundles every feature's copy, the
subscription layer mounts every feature's events — and are governed by the same
`eslint/boundaries.js` policies: `graphql/` and `offline/` stay open to it,
`context/`, `utils/`, `components/` and `hooks/mutations/` do not. The per-feature navigation stacks in
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
queue replays every feature's queued mutations and the subscription layer
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

Codegen output is gitignored and rebuilt — by CI, and by the `npm run codegen`
that setup already asks for. Two artifacts are tracked because nothing else
carries what they hold: `schema.graphql`, where a live server change lands in
the branch, and `persisted-query-manifest.json`, which is what the server
matches an operation against. A pre-push hook fails if either is stale, and its
pathspec names exactly those two — a gitignored path there would check nothing.

`npm run lint` validates every `.graphql` file against the pulled schema through
`@graphql-eslint`'s `flat/operations-recommended`, so a renamed or newly
deprecated server field, an undefined variable, a missing required argument or an
unspreadable fragment surfaces at lint time rather than as a surprise codegen
failure later. `no-unused-fragments` is off: most fragments are read from
TypeScript through `readFragment`, which it cannot see, and
`fragmentsAreReachable.test.ts` holds that invariant instead.

`naming-convention` keeps the preset's operation and variable casing but not its
fragment rule: fragments here are `<consumer>_<entity>`, and its `Get` prefix ban
does not apply.

The schema reaches the parser as `parserOptions.graphQLConfig` in
`eslint/project.js`: graphql-eslint@4 has no flat `schema` option and errors at
PARSE time when one is present, which reads as every document failing rather than
as a config problem. `documents` is set alongside it because the cross-document
rules report nothing without it.

### Fragment colocation and data masking

`dataMasking: true` is on globally. Each component or hook owns its fragment
(`<Consumer>_<entity>`), screens compose children's fragments by spread, and
queries spread the screen fragment. Components materialize data through
`useFragment` rather than receiving deep prop trees.

One rule worth internalizing: **any selection set on a type that has an `id`
must select it directly** — spreading a fragment that selects it is not enough.
`@graphql-eslint/require-selections` asks for the `id` but accepts one inside a
spread; `sous-chef/selects-key-field-directly` holds the direct half. Masking hides the
fragment's fields from the parent, including the key field — without an explicit
`id`, `cache.identify` throws.

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
offline and replays each as the canonical mutation it was queued as, each safe
to send again, when the device reconnects. Writes apply to the cache **before** firing (local-first) rather than
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

## Data ingestion seams

Data enters the catalog and the pantry through a handful of shared seams. Each
seam has one home, and a new source extends it rather than adding a parallel
path. The API and the admin app own the server side; this client never edits
those repos.

| Seam                                                                                                                                                    | A new source                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The intake expiry default: `today` on every intake input, read by the server's shelf-life resolver                                                      | sends `today` from its intake hook; supplies shelf-life data to the resolver                                                                                                                                             |
| `CatalogResolutionService` and its ordered steps; GTIN equivalence                                                                                      | adds one resolution step                                                                                                                                                                                                 |
| Survivorship engine, admin field overrides, provenance, refresh scheduler, review queue                                                                 | adds a mapper and its precedence entries                                                                                                                                                                                 |
| The barcode miss/result flow; the embedding model                                                                                                       | reaches the scan through a resolution step, never its own lookup                                                                                                                                                         |
| `receipts` feature; the add sheet's receipt action; `usePantryIntake`; `ReceiptParser`                                                                  | implements `ReceiptParser`                                                                                                                                                                                               |
| Stock writes: `stockAmountOf` / `boughtAmountOf` (`src/domain/stockAmount.ts`), the one create `usePantryIntake` and the one restock `usePantryRestock` | states what was bought through `stockAmount.ts` and writes through those two hooks, never its own mutation (a confirmed receipt alone goes as one check-in, below); a count naming no unit goes through `boughtAmountOf` |
| Per-language names and search; the language header; the `languageChanged` resync event                                                                  | adds names as synonyms in their language                                                                                                                                                                                 |

**Receipt reading.** The phone reads a receipt first, by the rules the server reads with (`@muzhaqi16/receipt-rules`, pinned to an exact version), and the server reads only what they refuse. Every reading is in the API's shape, and `fromServerReceipt` copies its lines and adds none of its own.

- The rules read the redacted pages (`readOnPhone`), the text their corpus holds. The day is read before redaction, by the package's `readReceiptDate`, because tills print it below the payment block.
- Where the `deviceReceiptModel` flag is on (off by default) and the phone's model is available, the model reads at the same time. Its reading is held to the same check (`checkOnPhone`, the package's `checkReading`).
- The first reading that adds up is the receipt's (`parsedBy: 'device'`), its store taken from the reading's merchant. The draft is then parsed, so no server parse is asked, and any photos prepared for it are deleted unsent. The rules answer in milliseconds, so the model is waited for only once they refuse.
- A reading's verdict is stored with it (`draft.totalsGap`): the server's `TOTALS_MISMATCH`, or the rules' refusal. The review shows it and never adds up the lines itself. With the server's reading off (`receiptParsing`), a reading the rules refused is kept anyway, with its gap.
- `deviceReceiptReading` turns reading on the phone off, and every receipt then goes to the server.
- A new version of the package is pinned only after `scripts/receipt-rules/hermes-check.mjs` passes. Run against the dev app with the receipt scan screen open, it reads the package's corpus under the app's Hermes and in Node. It fails when a reading differs between the two, or an accepted reading departs from its receipt. Installing needs `NODE_AUTH_TOKEN` (`docs/development.md`).
- A scan is at most four pages (`MAX_PHOTOS`), the most the API reads as photos: Android's scanner stops there. iOS's takes no limit, so a longer scan is read from its text, and one the phone cannot read is not sent in part.
- With the user's one-time consent (`receiptPhotoConsentStore`, session-scoped) and a connection, a scan of up to four pages sends photos (`createReceiptParse { photos }`).
- `TextRecognition.preparePhotos({ keepPages })` prepares the photos first, and `recognizeAndDelete` then reads the text from the same pages. The native side runs calls in order, so the pages are never deleted under the preparation. The photos go up together, within one time limit, only once the text is read and the phone could not read the receipt: their masks come from the text.
- `receiptPhotoMasks` covers what the phone read as personal: the payment block as a full-width band along its rows from its first payment row after an item to the receipt's end, its date rows left open, and above it each row redaction drops or masks, an email, and a phone below the header, line by line. `TextRecognition.maskPhotos` paints them into the prepared JPEG (a build without it sends the photos as they are). A parse sends `photosMasked: true` only when every photo was masked, and with no payment block read nothing is masked: the API lets only a marked photo reach a hosted model.
- The redacted text stays beside the photos as the fallback: offline, a failed upload, or a photo parse that reads nothing. The draft records which one a parse read (`serverParse.via`).
- `assembleReceiptRows` rebuilds the printed rows from the recognised lines' geometry. A tilted page is read along its slope. A level page is read by height, with its price column moved back by the offset at least three of its prices agree on: ML Kit can read every price a fraction of a row above or below its name. The offset is looked for within half a row of what the page's tilt predicts, because on evenly spaced rows a column a whole row away agrees as well.
- The phone's text is scored stage by stage against the corpus answer key by `scripts/receipt-corpus/text-fidelity.mjs`: Vision's from `ocr-variants.mjs`, and ML Kit's laid out by `mlkit-root.mjs` from a device run and the API's receipt corpus. A recognition or assembly change ships only if no item is lost there.

**Receipt check-in.** A confirmed receipt is recorded by one `createReceiptCheckIn` per 100 lines (`useReceiptCheckIn`), never by a write per line.

- Its ids are minted once and kept in the draft (`receiptDraftStore.checkIn`): the check-in's own, and each line's purchase, stack and typed item. A retry, a restart and a replay send the same ids, so nothing is recorded twice.
- Every line's local rows are written before the call fires, by the writers the pantry add and the list move use (`writeLocalIntake`, `writeLocalMove`). `applyReceiptCheckIn` settles each line from its result: a refused line withdraws only its own writes, and a merged stack or a matched item is adopted.
- Queued, it replays through `reconcileReceiptCheckInReplay`, which also settles the saved receipt. Refused for good, `withdrawReceiptCheckIn` and `restoreReceiptCheckInListLines` undo every line.
- A line that still lacks its product, unit or price is held back and named on the review. A refused line stays on the saved receipt with its cause, and Add sends only the lines not yet recorded.

Four rules keep parallel work apart:

- **A public hook ships with its first production consumer.**
  `check:dead-modules` and `hookMembersAreConsumed.test.ts` reject one added
  "for later", so the work that consumes a hook creates it.
- **New GraphQL operations live in the owning feature's folder,** not the shared
  `src/graphql/operations/item/item.graphql`.
- **Generated files are regenerated after a rebase, never hand-merged:**
  `schema.graphql`, `schemaTypes.ts` and the persisted-query manifest. One
  session pulls the schema at a time, and commits it on its own.
- **Append-only shared files** (`registry.ts`, `registry.static.ts`,
  `src/i18n/localeTypes.ts`, `useAppNavigation.ts`,
  `verified-library-behaviour.md`) take one-line or one-block additions in their
  own sections. A textual conflict there keeps both sides.

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

FlashList v2 takes no `estimatedItemSize`. List
`data` must never come through `useDeferredValue` / `startTransition` —
[`flashlist-layout-index-race.md`](flashlist-layout-index-race.md). How the two
big lists are fed and what an append costs:
[`flashlist-performance-analysis.md`](flashlist-performance-analysis.md).

### Bottom sheets

Always `BottomSheetModal` (never `BottomSheet`) via the `useStandardBottomSheet`
hook, driven by a `visible` boolean rather than imperative `present()`/
`dismiss()`. The app has a global backdrop system
(`OverlayBackdropProvider` + `GlobalBackdrop`); inline `BottomSheet` backdrops
conflict with it. How a sheet claims and releases it:
[`ui-layer.md` § Bottom sheets](ui-layer.md#bottom-sheets). The two
verified gorhom mechanics behind the sheet rules — why a scrollable must never
sit inside `BottomSheetView`, and why sheet inputs must resolve to
`BottomSheetTextInput` — are recorded in
[`verified-library-behaviour.md`](verified-library-behaviour.md).

### Theming and design tokens

`src/theme/` holds foundations (colors, typography, spacing, radii, shadows,
sizes, breakpoints, zIndex, motion durations, the palette derivation and the
appearance options), theme composition, and the appearance system —
light/dark/system, brand color, density, font scale, and high contrast, all
derived at runtime (`foundations/derivePalette.ts`, `applyAppearance.ts`).
`foundations/` is core and has no React Native in it; the rest of `src/theme/`
is the Unistyles runtime.

### Internationalization

`src/i18n/locales/` — `en`, `es`, `it`, `sq`, kept in lockstep. `npm run
i18n:check` (also a pre-push hook) fails on drift between locale files.

---

## Code conventions

### Type-level gates

Three projects own the tree — `tsconfig.json` (app), `__tests__/tsconfig.json`
(the root test tree) and `e2e/tsconfig.json` — and `npm run typecheck` runs all
three. ESLint reaches them through `parserOptions.projectService`, which resolves
each file against the project that owns it rather than a named one. That matters
because a type-aware rule guards with `if (!services?.program) return {}`: a file
no project claims reports nothing, which reads exactly like a clean file.
`e2e/` was in that state until it got its own tsconfig.
`__tests__/lint/typeAwareRulesHaveTypes.test.ts` asserts a type-aware rule fires
in every tier.

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
├── native/          Native module bindings, the storage adapters, React
│                    Native ambient types
├── platform/        Ports the core reaches the device through (§ Layers)
├── navigation/      RootNavigator, stacks, layouts
├── screens/         SplashScreen and NotFoundScreen only
├── services/        Push, subscriptions, telemetry, haptics, permissions,
│                    performance, alerts, errors, toasts
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
