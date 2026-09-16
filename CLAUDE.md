# Sous Chef RN — project instructions

React Native 0.86 (New Architecture) · React 19.2 + React Compiler · Apollo
Client 4.2 (`dataMasking` on) + GraphQL codegen · Unistyles 3 · FlashList v2 ·
React Navigation 8 · Zustand · i18next · MMKV. Offline-first: writes land in
the cache immediately and replay through an offline queue.

Each rule links its enforcer or mechanism doc. A **Verified** rule names the version
checked; change it only by re-running its probe (`docs/verified-library-behaviour.md`).

## Commands

```bash
npm start / npm run ios / npm run android    # dev loop
npm run codegen      # re-pull schema + regenerate types (run before lint if schema is stale)
npm run typecheck    # app AND test tsconfig — run after every code change
npm run lint         # ESLint, incl. every .graphql operation vs the pulled schema;
                     # --max-warnings 0, so a rule is 'error' or 'off', never 'warn'
npm test             # full Jest suite, unfiltered — ~800 suites; workers capped in jest.config.js
node scripts/check-compiler-bailouts.mjs         # also in pre-push
node scripts/check-unistyles-variant-staleness.mjs   # also in pre-push
npm run check:dead-modules   # knip: a src/ module with no production importer (pre-push)
npm run check:import-cycles  # madge: load-time import cycles (pre-push)
npm run check:audit          # npm audit over production dependencies (CI)
node scripts/check-bundled-secrets.mjs --self-test
```

Those are ALL the whole-tree gates; every other rule is an ESLint entry (`eslint/`,
`sous-chef/*` in `docs/rules/`), a Jest test named beside it, or review. Never add a
check script for a rule a lint entry or test can express. Hook matrix:
`docs/development.md` § Git hooks; `.graphql` lint: `docs/architecture.md` § Codegen.

**Agent hooks** (`.claude/settings.json`, scripts in `.claude/hooks/`): every
file an agent edits is linted on the spot and the findings come back as a
blocking result; a stop runs `typecheck` when the session edited TypeScript;
a command that skips the git hooks (`--no-verify`, `-n`, `HUSKY=0`,
`core.hooksPath`) is refused. Lint and TS configs, ratchet baselines, git hooks,
workflows and the hook setup itself are `ask`-gated: loosening a gate is the
user's decision, never a way past a failing check.

## Repository map & imports

- `src/features/<name>/` — the TWELVE features, auth and onboarding included;
  `src/screens/` holds only `SplashScreen` and `NotFoundScreen`. Map and every
  § below: `docs/architecture.md`.
- **The registry split is load-bearing.** Navigation iterates `registry.ts`;
  launch-path code reads `registry.static.ts` (i18n, push routes) and
  `registry.cache.ts` (type policies). Shell wiring goes in `manifest.static.ts`,
  never an import of `registry.ts` — § Three registries.
- `src/components/` — `atoms/`, `molecules/`, `organisms/`, `templates/`,
  `providers/`, `performance/`, nothing else; tier follows what it RENDERS
  (`atoms/README.md`). Feature-private UI stays in its feature's `components/`.
- **Kit** (`src/hooks/` + `src/components/`): only what 2+ features use; no
  `#features/*` import (boundary zone), no `.graphql`, no domain-named file
  (review). **Kernel** (`src/apollo/`, `src/store/`, `src/utils/`, …): no module
  named after a feature; feature imports go through the zones. Nav stacks exempt.
- `src/features/catalog/` — grocery `Item`, pickers, storage locations; `ui/` is
  the one PUBLIC feature component directory, `components/` stays private.
- `src/app/` — composition root that knows the feature list; not kit, exempt. `src/domain/` —
  logic 2+ features share (`dietary`, `nutrition`, `recipeTransform`, `pantryItemDuplicate`).
- `src/components/templates/` — `Screen`, `Sheet`, `FormScreen`; a screen never assembles
  its own header. Also `apollo/`, `store/`, `i18n/`, `services/`, `navigation/`, `theme/`, `utils/`.
- **Aliases** — add one ONLY to `tsconfig.json` `paths` (§ Import aliases). Each
  top-level `src/` folder is `#<name>`; irregular: `#/*` → `src/*`, `#operations`
  → `src/graphql/operations` (preferred), `#generated` → `src/graphql/generated`,
  `#/test-utils/*` → `__tests__/helpers/*`. Aliases over relative paths.
- **No dead modules** — a `src/` module needs a PRODUCTION importer
  (`check:dead-modules`); a test import or `jest.mock()` does not count, so dead
  code goes with its test. Shell-loaded modules are `entry`s in `knip.json`.
- **No unread hook members** — every member a hook returns is read by production
  code (`hookMembersAreConsumed.test.ts`). An unread `loadMore`, `error` or action
  is a gap to wire or dead code to delete, never an allowlist entry.
- **testIDs come from a registry** — `src/features/<name>/testIDs.ts` or
  `src/components/testIDs.ts`, composed ids as builders, no imports in a registry
  (e2e reads it by relative path) — `sous-chef/testid-from-registry`.
- **Feature shape** — `manifest.ts` (`id` = dir name), `screens/`, `hooks/`,
  `components/`; 2+ screens adds `screens/registration.ts`; colocated `.graphql` is the norm.
- **Feature API boundary** — public: `screens/`, `manifest.ts`, `testIDs.ts`,
  top-level `hooks/` files, `<feature>Fragments.generated.ts` type imports; the
  rest is internal, both directions, via `boundaries/dependencies` (matched by
  feature capture, so a new feature needs no config); tests exempt. Table and
  `graphql/` asymmetry: § The public API boundary.

## State ownership

- **Server owns it → Apollo; else Zustand**, via `#store/useAppStore`'s named
  hooks, never a whole-store subscription — `docs/architecture.md` § State.
- **A feature store MUST call `registerSessionScopedStore(name, reset)`** —
  `sessionEndLeavesNoData.test.ts`; § Feature-owned stores.
- Notifications live ONLY in the cache (`notificationCacheWrites.ts`): a local
  write moves the badge by a delta, a server event calls `reseedUnreadCount()`,
  `addNotificationToFeed` scopes with `skipUnmatchedFilterVariants` —
  `docs/apollo-client-patterns.md` § Server events, the unread badge, and write scoping.

## TypeScript conventions

- Types come from codegen, never hand-written; `npm run codegen` after any `.graphql` change.
- No `as any`, `as unknown as X`, `as never`, `as Record<…>` or key casts; fix the
  data flow or widen the contract — `no-restricted-syntax`,
  `@typescript-eslint/no-explicit-any` and `sous-chef/no-schema-enum-cast`.
- `Unmasked<>` ONLY as an `optimisticResponse` callback return type; never
  `@unmask`. HKT registration: `src/types/apollo-masking.d.ts`.
- **A condition the types say cannot matter is an error** (`no-unnecessary-condition`),
  over all of `src/**` with no exclusions. **Never delete a runtime guard to satisfy
  it**: delete a dead branch, or widen the type where DECLARED — annotate the
  receiving variable (never a destructured binding, which CFA re-narrows), or
  `switch` + `default` over a closed enum. No cast, not at the call site. Why:
  `docs/architecture.md` § Type-level gates.
- **`noUncheckedIndexedAccess` is on.** Bind and guard
  (`const [first] = xs; if (!first) return;`); `!` only in tests. Key a lookup
  table by its real key type (codegen enum or source type), never
  `Record<string, …>`, and never fix it with `satisfies` — `sous-chef/no-unchecked-domain-literal`.

## Comments

A comment says only what code cannot (a library gotcha, an invariant an edit would silently
break, a deliberate oddity); rationale goes in the PR or `docs/`, history in git — `docs/architecture.md` § Comments.

- **Present tense, no history, no dates** — `no-warning-comments`,
  `sous-chef/no-dated-comment`. A test states the defect it pins in the present.
- Volume is review's: one to three lines; no run over six (`/**` and `*/` count, a
  blank ` *` does not split it); comments under half the code in 60+ line files.
- No doc restating the identifier, no `@param`/`@returns` echoing the signature, no
  `@example` on internal helpers. Attach a doc to what it documents: `{@link x}`.

## GraphQL & Apollo

### The data layer stays out of what renders

- **A screen, sheet or cell gets data from its feature's `hooks/`** — never
  `#/apollo/*`, Apollo's operation hooks, the client or a cache write
  (`import/no-restricted-paths`); `useFragment` and masking types stay allowed.
- **A hook hands back plain values and callbacks, no library type**; a mutate
  wrapper returns what `settleMutation` settled, or its own outcome — `hookReturnTypes.test.ts`
  (`docs/apollo-client-patterns.md` § The data layer stays out of what renders).

### Fragments & data masking

- A component/hook owns a sibling `<Consumer>_<entity>` fragment; screens spread
  children's, queries the screen's, mutations the hook's. A shared
  `*Fragments.graphql` has a consumer-list header, 2+ operations and 1+ hook.
- Generated catalog-fragment names (`ItemFragment*`, …) are banned imports
  (`no-restricted-imports`) — colocate a fragment instead.
- List cells are **strict** (`null` on `!complete`), detail panels and sheets
  **resilient fallback** with guarded scalar reads — templates:
  `docs/apollo-client-patterns.md` § Fragment Composition & Data Masking.
- **A selection spreading a type-identifying fragment also selects `id`** —
  `maskingIdentity.test.ts`.

### Mutations & cache updates

Pick the pattern from `docs/apollo-client-patterns.md` § Choosing a pattern (no
`update` callback by default, `refetchQueries` last); build optimistic responses
from `cache.readFragment` + spread, never hand-rolled shapes.

- **`errorPolicy: 'all'`: a failed mutation RESOLVES `{ data: undefined, error }`**
  — handle failure on the result, not only in a `catch`.
- **Settle a write with `settleMutation`** (`applied | queued | failed`; queued is
  never a failure); narrow with `appliedPayload(data)`, never a `__typename`
  string (`sous-chef/no-unchecked-domain-literal`).
- **Never display or branch on the server's `message`** — a refusal is its `code`
  and `field` (`sous-chef/no-error-message-branching`, `sous-chef/no-rendered-server-message`).
- **Pass caller copy INTO `localizedErrorMessage(err, fallback)`, never `|| t(…)`
  after it** — `callerFallbackReachesResolver.test.ts`.
- **A field with a write-time invariant goes through its ONE writer** —
  `cache.writeFragment` (`writePurchaseInfo`), never `cache.modify`; the
  restoration pass uses `src/apollo/utils/fieldWriters.ts`.
- **Never pair `optimisticResponse` with `context: { localFirst: true }`** — the
  queued completion reverts it on screen (`docs/local-first-architecture.md` § 2).
- **A write in `SYNC_REGISTRY` writes the cache first and passes `localFirst: true`**:
  `queueLink` queues it offline either way, so a caller that skips the local write
  queues an invisible change. Both rules: `queueableWritesAreLocalFirst.test.ts`.

### Local-first & optimistic completeness

- **An optimistic entity is COMPLETE for every query reading it**: a new read field
  reaches every connection writer (builder, create, `Sync*` replay, move/restock,
  subscription read-back) — `optimisticEntityCompleteness.test.ts`. Nested refs
  resolve via a `cache.readFragment` selecting every field the query needs.
  Persistence and the queue/replay model: `docs/local-first-architecture.md`.

### Queries & fetch policies

Defaults (`src/apollo/defaultOptions.ts`): `watchQuery` `cache-and-network` →
`cache-first`, one-shot `query` `cache-first`, `errorPolicy: 'all'`. Suspense
hooks are not adopted (`docs/apollo-client-patterns.md` § Apollo Client 4.x Notes).

- **Gate a screen on `loading && !data`, NEVER `loading`** — it is true on every
  mount, warm cache or not. A defaults-filling hook returns a flag
  (`hasLoadedSettings`); the loading branch stays inside the header wrapper.
- **`returnPartialData: false`: `!data` means the read was INCOMPLETE**, so every
  writer writes the full shape its reader selects — `userProfileCompleteness.test.ts`.
  Verified vs `@apollo/client@4.2.12` —
  `docs/verified-library-behaviour.md#apollo-reports-loading-true-on-every-mount-warm-cache-or-not`.

### Subscriptions & transport verdicts

- **Envelope + `node { id }` event subscriptions run `fetchPolicy: 'no-cache'`**
  (`docs/apollo-client-patterns.md` § Subscriptions).
- **Judge a WebSocket close by code (`src/apollo/links/wsCloseCodes.ts`), never
  reason**; `useSubscriptionTransportRecovery` follows every `useSubscription`.

## Session end & token rotation

Mechanism: `docs/session-and-transport.md`.

- **`getDeviceId()` is sync and never mints; `ensureDeviceId()` is the async
  single-flight resolver** (`docs/subscriptions-echo-and-budget.md` § The device identity).
- **Every session-end path clears the push token** (a `registerSessionTeardown`
  step); read `UpdateDeviceResult` on `__typename`.
- **`authService.logout()` is the only sign-out**; `SESSION_SCOPED_STATE` lists
  what it removes — `sessionEndLeavesNoData.test.ts`.
- **A session end STOPS things before clearing**: `runSessionTeardown()` first,
  `completeLogout()` after `performLogoutCleanup()`, `queueManager.onLogout()` only
  on deliberate sign-out, `/health` keeps probing.
- **`AUTH_REFRESH_TOKEN_SUPERSEDED` ≠ `_INVALID`** — never sign out on the first;
  retry only once a different token is stored (`retryWithSuccessorToken`).
- **Only ONE transport presents the refresh token** (`registerRefreshInFlightCheck`).
- **Never send on a dead access token**: await `proactiveTokenRefresh()`; refresh early if expiring.
- **Setting a password uses `newPasswordRule`; signing in uses `passwordRule`**
  (non-empty, 72 cap), each mirroring the server — `auth.test.ts`.
- **A session end DROPS the socket client** (`disposeWebSocket()`), not just
  disposes it; no second reconnect loop; pacing goes in `url()`.

## UI layer

Mechanism, evidence and traps for every rule below: `docs/ui-layer.md`, same headings.

### One mechanism per concern

Each row is solved ONCE; an alternative loses what the canonical path handles. "Held by" is what fails when you reach past it; "—" means no check can express it yet, not that it is optional.

| Concern                                   | Mechanism                                                                                         | Held by                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A list that can grow                      | `FlashList`, with an explicit `renderScrollComponent`                                             | `no-restricted-imports` on `FlatList`/`SectionList` · `flashListScrollComponents.test.ts`                                                |
| A remote image                            | `CachedImage` (`LocalImage` for a file or bundled asset)                                          | `no-restricted-imports` on `react-native-turbo-image`                                                                                    |
| A modal surface                           | `BottomSheetModal` via `useStandardBottomSheet`, or `alertService`                                | `no-restricted-syntax` (`imperativeSheet`, `modalPropsOverride`) · `no-restricted-imports` on gorhom's `BottomSheetModal`                |
| Rendering a date                          | the shared formatters in `src/utils` (`formatters/date`, `dateUtils`)                             | `no-restricted-imports` on `date-fns`'s formatters                                                                                       |
| Rendering a quantity                      | `formatQuantityForDisplay` (`#/utils/formatQuantity`)                                             | `sous-chef/quantity-through-formatter` · `no-restricted-imports` on `fraction.js`                                                        |
| Device storage                            | a persisted slice of the Zustand store                                                            | `no-restricted-imports` on `#storage/mmkv`                                                                                               |
| This device's identity                    | `getDeviceId()` sync, `ensureDeviceId()` async (`#/storage/deviceId`)                             | `singleDeviceIdentity.test.ts`                                                                                                           |
| A screen's chrome                         | `Screen` (`#components/templates/Screen`)                                                         | `screenTopInset.test.tsx` (the double inset); the rest is convention                                                                     |
| A sheet's shell                           | `Sheet` (`#components/templates/Sheet`)                                                           | `bottomSheetShell.test.ts` · `viewSheetScrollableIsBounded.test.ts`                                                                      |
| A list row                                | `commonStyles.rowWrapper` + `rowSurface` + `rowContent`, its text set by `rowType`                | —                                                                                                                                        |
| A loading indicator                       | `Loading` / `LoadingBranded` (`#components/molecules/Loading`)                                    | `no-restricted-imports` on `ActivityIndicator`                                                                                           |
| A toast                                   | `toastService` — in and out of the React tree alike                                               | `no-restricted-syntax` (`toast*`) on its arguments                                                                                       |
| A write's outcome and its failure copy    | `settleMutation`; `appliedPayload` for the success member                                         | `appliedPayload.test.ts` (every result union in the schema) · `settleMutation.test.ts`                                                   |
| Navigating                                | `useAppNavigation`                                                                                | `no-restricted-imports` on `useNavigation`                                                                                               |
| Setting text                              | a typography ROLE (`<Text role="body">`)                                                          | `no-restricted-imports` on RN `Text` · `sous-chef/text-needs-role`                                                                       |
| A text input                              | `ThemedTextInput` / `ThemedBottomSheetTextInput` (`#components/atoms/themedComponents`)           | `no-restricted-imports` on RN `TextInput` and gorhom's `BottomSheetTextInput`                                                            |
| An icon's colour                          | `<Icon tone="X" />` (`#utils/iconUtils`)                                                          | `no-restricted-imports` on `@react-native-vector-icons/ionicons`                                                                         |
| A colour, radius, z-index or spacing step | a `theme.*` token                                                                                 | `sous-chef/no-raw-color` · `sous-chef/no-raw-spacing` · `no-restricted-syntax` (`borderWidthLiteral`); radius and z-index are convention |
| Elevation                                 | a step of `theme.shadows`                                                                         | `no-restricted-syntax` (`legacyShadowProp`); a raw `boxShadow` geometry is convention                                                    |
| Text or an icon on a fill                 | that fill's `on*` token (`onScrim` over a ground the theme does not paint)                        | `onFillTextUsesItsToken.test.ts` · `sous-chef/no-raw-color`                                                                              |
| A duration, spring or curve               | `theme.motion`                                                                                    | —                                                                                                                                        |
| A form's fields                           | react-hook-form + a yup schema beside the form                                                    | `validationMessagesAreRendered.test.ts`                                                                                                  |
| Searching a loaded list                   | `filterByTerm` / `useLocalSearch` (`#hooks/search/useLocalSearch`)                                | `no-restricted-syntax` (`handRolledSearch`)                                                                                              |
| An icon-only control's name               | `accessibilityLabel` (RN names a pressable from its text children)                                | `no-restricted-syntax` (`missingPressableLabel`)                                                                                         |
| Reduce motion                             | nothing — Reanimated applies it itself                                                            | `no-restricted-imports` on `useReducedMotion` · `probe-reanimated-reduce-motion.mjs`                                                     |
| Memoization                               | nothing — the React Compiler does it                                                              | `no-restricted-imports` on `useMemo`/`useCallback` · `check-compiler-bailouts`                                                           |
| A shared actions bag                      | `createActionsContext`                                                                            | —                                                                                                                                        |
| Where a value lives                       | Apollo if the server owns it, else a Zustand slice; a context only for what a subtree passes down | —                                                                                                                                        |

### Screen scaffold and sheet shell

- **A screen's chrome is `Screen`**. It NEVER applies the top inset, because the navigator does; a bare `<SafeAreaView>` (no `edges`) insets all four sides.
- **A sheet's shell is `Sheet`** (`view | form | action | list`). `form` supplies the keyboard offset and the input context. A sheet whose scrollable fills it uses `list`, never `view`.
- **A full-screen form is `FormScreen`**, not a sheet.

### The list row

- **Every row shell uses the same parts**: `commonStyles.rowWrapper` / `rowSurface` / `rowContent`, the `theme.layout.row*` steps, and `rowType` (`title` / `subtitle`) for its text, never a literal. The shells are `BaseItemCard`, `ListItem`, `ItemCard` and `RecipeCardView`.
- **A thumbnail carries no margin**, since `rowContent`'s `gap` spaces it.
- **A skeleton row uses the same primitives.** Its container adds NO gap, and it owns the gutter exactly when it is a standalone sibling list, not when it nests inside the real list's padding.

### Unistyles

- **`StyleSheet.create(theme => …)`** styles RN primitives. `styles.useVariants` carries runtime flags. Merge a caller style as `style={[styles.x, callerStyle]}` (`no-restricted-syntax`: `combinedUnistyles`).
- **`withUnistyles(Component)`** themes a third-party component's props. Add the wrapper to `src/components/atoms/themedComponents.tsx`, not per file. Switches use `BaseSwitch`.
- **Never wrap `Pressable`/`TouchableX` with `withUnistyles`**: it drops a function-style `style`. Verified 2026-08-23 vs `react-native-unistyles@3.3.0` — `docs/verified-library-behaviour.md#unistyles-withunistyles-drops-function-styles`.
- **`useUnistyles()` only for runtime metadata** (`rt.*`), never `theme.*`; a bare call is `no-restricted-syntax`'s `unusedUseUnistyles`. The cross-library exceptions are listed in the doc.
- **Plugin order is Unistyles → `unistyles-scope-crawl` → React Compiler; don't reorder these three.** Any other order skips or silently freezes `useVariants`. Verified vs `react-native-unistyles@3.3.0` + `babel-plugin-react-compiler@1.0.0` — `docs/verified-library-behaviour.md#unistyles-usevariants-rewrite-needs-a-scope-re-crawl-before-the-compiler`.

### Typography roles

- **Text is set by a ROLE, never by size and weight.** The eleven roles are in `src/theme/foundations/type.ts`: `<Text role="caption">`, never `<Text size="sm">`. **Colour is `tone`'s job.** An element that can't take the prop spreads `...theme.type.<role>`.
- **Error copy is `<Text role="error" tone="error">`, kit included; a red label that is not error copy (a destructive action, an expired status) is `tone="danger"`** (`sous-chef/text-needs-role`).
- **`size` / `weight` / `lineHeight` are kit-only escape hatches.** Outside `src/components/**`, every `<Text>` names a role (`sous-chef/text-needs-role`).
- **The font-scale ceiling is global**, applied by `Text` as `theme.maxFontScaleMultiplier` (`no-restricted-syntax`: `maxFontSizeMultiplier`, `allowFontScaling`).

### Elevation & on-fill colour

- **Elevation is `theme.shadows`, and the ramp is PER THEME.** `src/theme/foundations/shadows.ts` is the only place a `boxShadow` geometry is written; the exceptions are shadows whose colour is the point.
- **Text or an icon on a fill reads that fill's `on*` token**, never a hardcoded white. `onScrim` is for a ground the theme doesn't paint, and there is no `colors.white` (`onFillTextUsesItsToken.test.ts`).
- **Light and dark declare the same colour, shadow and motion keys** (`src/theme/__tests__/foundations.test.ts`).

### Motion

- **Durations, springs and curves are `theme.motion`** (`motion.timing.FAST` outside a stylesheet). The scale stops at 300 ms; a loop's longer period stays a literal.
- **Never branch an animation on reduce motion.** Reanimated applies it itself. `useMotionEnabled()` is the ONE read, for what a zero duration can't stop (`no-restricted-imports`). Verified 2026-09-03 vs `react-native-reanimated@4.6.0` — `docs/verified-library-behaviour.md#reanimated-applies-reduce-motion-itself`.

### Pressable & gestures

- **Default `Pressable` comes from `#components/atoms/themedComponents`.** Inside a `Swipeable`, a `GestureDetector` chain or `RectButton`-style coordination, use RNGH's (`no-restricted-syntax`: `rnTouchableInSwipeable`). Use RNGH's `ScrollView` only when RNGH gestures sit inside it.
- **A FlashList whose rows carry RNGH gestures MUST render `renderScrollComponent={SwipeAwareScrollComponent}`.** RNGH v3 handlers survive a plain RN scroll takeover, and no `dragOffset` fixes it (`flashListScrollComponents.test.ts`). Verified 2026-09-12 vs `react-native-gesture-handler@3.3.0` — `docs/verified-library-behaviour.md#rngh-v3-handlers-survive-a-native-scroll-takeover`.
- **That list's pull-to-refresh passes an EXPLICIT `refreshControl={<ThemedRefreshControl … />}`**, never a bare `onRefresh`/`refreshing` pair: FlashList then builds RN's control, which drops RNGH's gesture. A plain RN scrollable host takes `PlainScrollRefreshControl`, so pick by host (same test). Verified 2026-09-12 on device vs `react-native-gesture-handler@3.3.0` + `@shopify/flash-list@2.3.2` + `react-native-unistyles@3.3.0` — `docs/verified-library-behaviour.md#rnghs-scroll-gesture-reaches-only-rnghs-refreshcontrol`.
- **The rule is about the HOST.** A standalone RNGH scroller with pull-to-refresh renders `SwipeAwareScrollComponent` too, never a hand-rolled RNGH `<ScrollView>`, or the Android spinner parks (same test). Its `nestedScrollEnabled={false}` override stays until a real-finger A/B measures it. Verified 2026-09-05 on device — `docs/verified-library-behaviour.md#rngh-ends-the-nested-scroll-its-scrollview-opens`.

### Bottom sheets

- **Always `BottomSheetModal` via `useStandardBottomSheet`, never inline `BottomSheet`**, which conflicts with the global backdrop. Drive it with `visible` + `onDismiss` (`no-restricted-syntax`: `imperativeSheet`, `modalPropsOverride`); design is in `docs/backdrop-lifecycle-design.md`.
- **Every text input inside a sheet resolves to gorhom's `BottomSheetTextInput`**, picked from `useIsBottomSheetInput()` context, because it throws outside a sheet. Verified 2026-08-23 vs `@gorhom/bottom-sheet@5.2.14` — `docs/verified-library-behaviour.md#gorhom-keyboard-handling-requires-bottomsheettextinput`.
- **A sheet sized to its content (`enableDynamicSizing`) takes NO keyboard-aware scrollable**: use `BottomSheetView` and gorhom's `interactive` lift. Verified 2026-09-04 vs `react-native-keyboard-controller@1.22.4` + `@gorhom/bottom-sheet@5.2.14` — `docs/verified-library-behaviour.md#a-keyboard-aware-scrollable-cannot-size-a-sheet`.
- **A sheet with FIXED snap points and inputs uses `BottomSheetFormScrollView`.** The raw scroller lacks the input context and is an import ban. Never hardcode `bottomOffset` or pass it `undefined`, since it defaults to `theme.spacing.md` via a mapping. It measures from the input's bottom edge. Verified 2026-08-24 vs `react-native-keyboard-controller@1.22.4` — `docs/verified-library-behaviour.md#keyboard-controller-bottomoffset-measures-input-bottom`.
- **Never wrap a scrollable in `BottomSheetView`**, which is absolute with no height. Put the list in a `View style={{ flex: 1 }}` (`BottomSheetAutocompleteInput.test.tsx`). Verified 2026-08-23 vs `@gorhom/bottom-sheet@5.2.14` — `docs/verified-library-behaviour.md#gorhom-bottomsheetview-cannot-bound-a-scrollable`.

### Lists (FlashList v2)

- **No `estimatedItemSize`.** It is gone from 2.3.2's props, so it is a type error; don't add a workalike.
- **A FlashList must be given a height by its host.** It is `flexBasis: 0`, so a content-sized container renders no rows (`recyclingListHostIsBounded.test.ts`).
- **Never feed FlashList `data` from `useDeferredValue` or inside `startTransition`**: it causes the production fatal `not enough layouts`. See `docs/flashlist-layout-index-race.md`.
- **Every FlashList using `useFlashListPerformance` passes `perfCallbacks.CellRendererComponent` AND `onCommitLayoutEffect`.** The renderer is per-session sampled, so `undefined` is normal. See `docs/flashlist-performance-analysis.md` § Reading the instrumentation.
- **A skeleton over a mounting FlashList releases on `hasContentLayout`**, never on loading flags or `onLoad`. Its cover exists from the list's FIRST commit, and a settled EMPTY list releases on `rowCount: 0`. Verified 2026-08-26 vs `@shopify/flash-list@2.3.2` — `docs/verified-library-behaviour.md#flashlist-v2-first-layout-opacity-gate`.
- **Never use `InteractionManager`**, a no-op stub in RN 0.86.3; use `requestIdleCallback`. Verified 2026-08-24 — `docs/verified-library-behaviour.md#interactionmanager-is-a-no-op-stub`.

### Autocomplete & dropdowns

- **Autocomplete hooks use `useAutocompleteSearch`** (`src/features/catalog/hooks/`). Set `localFirst: true` only for a complete reference set (units), `!isOnline` for a bounded slice. Stale results are handled centrally; consumers add no relevance check.
- **Pick inline vs modal picker by result set**: `InlineAutocomplete` caps at 6. A stacked picker sets `stackBehavior="push"`.
- **Wrap vertically stacked form content in `DropdownStack`**; never hand-roll zIndex chains. The failure is device-only and invisible to every gate.

### Row actions

- **A swipeable row takes `leftActions` / `rightActions` of `SwipeAction` descriptors**, never named verbs. `key` is also the accessibility action name.
- **Edit and delete builders live in `SwipeableItem/commonActions.ts`**; domain actions belong to their feature. `removesRow` is read by the row renderer, not `SwipeableItem`.

### Dynamic forms

- **`DynamicFormFields` renders a `component` NAME through the registry** that `FieldRendererProvider` supplies in `App.tsx`. Field callbacks travel in `props`. An entry rendering its own message sets `ownsErrorDisplay`.

### Forms & validation

- **A field the user can fix is reported ON the field, never through `alertService.alert`.** Alerts are for submission failures.
- **Validation is a yup schema beside the form**, via `yupResolver`, `Controller` and `handleSubmit(onValid, logValidationErrors)`. The submit hook does not validate.
- **Schema messages resolve LAZILY** (`key => () => t(key)`, `src/utils/validation/common.ts`); never an eager or hardcoded string.
- **A cross-field rule needs an explicit `trigger()`**, or `rules={{ deps }}` where a `Controller` owns the write. A field a rule reads lives IN the form (`validationMessagesAreRendered.test.ts`). Verified on device 2026-08-26.
- **A paged form maps field → page** (`FIELD_PAGE`) and navigates before reporting.
- **`dirtyFields` omits clean fields.** Read it for truthiness, and assert `toBeUndefined()`.

### Quantities

- **A quantity reaches the screen through `formatQuantityForDisplay`** (`sous-chef/quantity-through-formatter`; `no-restricted-imports` on `fraction.js`), at most three decimals (1/8 is 0.125). An editable field is seeded by `formatQuantityForInput` instead: a cooking fraction only where it equals the value to three places, else the number rounded to three places, in the device's decimal separator (`notation: 'decimal'` when the keypad has no `/`).
- **`quantityInput` is re-formatted, never shown verbatim**: the API echoes it as a float string.

### Navigation

- **Navigators default to `inactiveBehavior: 'pause'`; only `HomeTabs` and the root `Home` screen set `'none'`** (`HomeTabs.test.tsx`, `RootNavigator.test.tsx`). Mechanism: `docs/architecture.md` § Navigation.
- **Under `'none'`, a secondary consumer of another tab's query stands its watcher down while blurred.** Use `skip: !isFocused` via `useFocusEffect` (preferred over `useIsFocused`), plus `fetchPolicy: 'cache-first'` (load-bearing), plus `usePreservedConnection`. Reference: `useRecipeDiscovery`.

## React Compiler

- **Never write `useMemo`/`useCallback`** (`no-restricted-imports`; disable comments
  are `eslint-comments/no-use` errors) **or `React.memo`** until a profile shows a
  re-render on unchanged props, noted in a comment. A dependency-array reference is
  a module-scope function (`syncAsAccountDefault`, `useDefaultHome.ts`).
- **Never add `'use no memo'`** — zero bailouts and zero opt-outs are invariants of
  `check-compiler-bailouts`. Needing one means the plugin order or
  `unistyles-scope-crawl` regressed (`check-unistyles-variants` catches the frozen
  variant): run `node scripts/probe-unistyles-compiler-order.mjs`.
- **A `finally` (or catch-less `try`), or a value block (`?.` `??` `&&` `||` ternary)
  inside a `try` body, bails the whole function** — move the conditional after the
  `try`; `src/utils/finallyHelpers.ts` for `finally`. `check-compiler-bailouts` is the
  gate (`react-hooks/todo` sees only `finally`). Verified vs
  `babel-plugin-react-compiler@1.0.0`: `docs/verified-library-behaviour.md#react-compiler-try-shapes`.
- **Never read or write `ref.current` during render** — adjust state during render.
- Hook returns and inline `renderItem`s are already memoized. Memoization skips
  **re-renders**, never a **mount**: `(mount)` rows need fewer elements, not memo.

## Worklets — `scheduleOnRN`

A `scheduleOnRN` (the `runOnJS` replacement) callback is defined in RN scope, never
inline, with only primitive extra args — capture functions by closure.
`no-restricted-syntax` (`scheduleOnRN*`); mechanism: `docs/rules/restricted-syntax.md`.

## i18n

Mechanism for each rule: `docs/i18n-architecture.md`.

- **A feature owns its copy** (`src/features/<name>/locales/`, via `manifest.static.ts`
  and `src/i18n/localeTypes.ts` — `featureLocaleRegistration.test.ts`); `src/i18n/locales/` is shared copy.
- **The product name is `{{appName}}`**, never a literal (`appNameInterpolation.test.ts`).
- `useTranslation()` where a file renders (`sous-chef/no-module-level-t`), module `t`
  (`tGlobal` in a `.tsx`) elsewhere; never `getI18n().t` (`no-restricted-imports`).
- **Keys are typed** (`TranslationKey`, `KeyUnder<'prefix'>`, an enum template
  literal; `isTranslationKey` for server data). Never cast a string to a key.
- **Shared copy has one home** — `errors.*`, `empty.*`, `labels.*` (`canonicalVocabulary.test.ts`).
- **Never concatenate a number with a noun, or append `'s'`** — `t('key', { count })` (`numberNounConcatenation.test.ts`).
- **Plural categories are derived** (`completePluralCategories`); a missing one falls to `fallbackLng` (verified vs `i18next@26.4.0`).
- **Never inflect for the reader's gender** (`addresseeGender.test.ts`); noun agreement lives in per-context keys.
- **An interpolated `{{resource}}`/`{{entity}}` takes a frame nothing agrees with** (`entityLabelAgreement.test.ts`).
- **An enum value renders through its keys** (``t(`ns.${value}`)`` or a `Record<Enum, TranslationKey>`), never raw or re-cased (`sous-chef/no-rendered-enum`).
- **`t` takes no fallback copy** — no string second argument, no `defaultValue` (`sous-chef/no-t-default-value`).
- **Copy passed through a variable, property, setter or return is `t(…)`** (`sous-chef/no-prose-literal`).
- No guard proves completeness: prose under a name none of them reads passes all of them.

## Testing

Patterns and examples: `docs/development.md` § Testing.

- **Render through `renderHookWithApollo`/`renderWithApollo`**, never a `@apollo/client/react`
  mock or bare cache (`no-restricted-syntax`: `apolloReactMock`, `bareInMemoryCache`); `MockedResponse` from the helper.
- Assert a mutation on the **cache**. Drive a failure with a mock carrying `error`, never a stubbed throw.
- **One mocking strategy**: `operationMocks` OR `mocks`/`resolvers`; `operationMocks: []` is not "answer from the schema".
- A mock's `data` is completed from the SDL: state only what you assert on; `partial: true` is the one opt-out.
- `Environment`/`logger` are auto-mocked: override with `mockReturnValue`, never a partial factory.
- Never stub a react-hook-form form with an object: use the real hook, and pair `mockImplementation` with `jest.restoreAllMocks()`.

## Bundled credentials

Classify every credential-shaped `KEYS` var `PUBLIC_BY_DESIGN` (never an infrastructure
credential) or `ACCEPTED_FINDINGS` (`check-bundled-secrets.mjs`). Launch-argument auth is
gated on the signed artifact (`check-launch-arg-auth.mjs`). `docs/bundled-credentials-decision.md`.

## Git & PR conventions

- Conventional Commits (commitlint). Hooks and PR guidance: `docs/development.md` § Git hooks + `CONTRIBUTING.md`.
- The API repo (`sous-chef-api`) is read-only: align the client to it, read it to verify contracts, never edit it.
- **After every codegen, diff `src/graphql/generated/schema.graphql`** and commit it
  on its own — a live server change lands in your branch. Its doc comments are the
  only record of BEHAVIOUR changes, so a doc-only diff can be a contract change.
- Parallel sessions share this checkout — touch only your task's files; no `stash`, `reset --hard`, `checkout .`.

## Performance measurement

Measurement decides what to change. Evidence: `docs/performance-monitoring.md` § Measurement protocol.

- **A mechanism is not a cause** — measure its share first.
- **Read a metric's definition, not its name** (`docs/telemetry-setup.md` § Metric Reference).
- **Numbers from a release build**; debug for attribution only; never mix them.
- **An emulator understates, an iOS simulator overstates** — act on a device; compare iOS to iOS.
- **A startup metric is bounded**: past `STARTUP_WINDOW_MS` read `startup_window_exceeded_total`.
- **A terminating condition reads the un-smoothed signal**, never an anti-flicker hold.
- **State the instrument's resolution**; a difference under one sample is not a result.
- **Run a control** before believing an attribution.
- **Never read a value from `slow_*_total` labels** — read the histogram series.
- **Judge an intermittent mode against a distribution**, per session.
- **Match instrument to symptom**: hitching → commit counts; frame-rate ceiling → device `gfxinfo framestats`.
- **Check the panel's refresh rate** before calling a frame slow.

## Verification

After code changes:

```bash
npm run typecheck && npm run lint && npm test
npm run check:compiler-bailouts && npm run check:unistyles-variants
npm run check:dead-modules && npm run check:import-cycles
```

What each gate holds and where it runs: `docs/development.md` § Quality gates.

## Documentation index

`docs/README.md` is the index. Most used from here:
`docs/architecture.md` (structure, state, navigation) ·
`docs/apollo-client-patterns.md` (the Apollo deep dive) ·
`docs/local-first-architecture.md` (offline queue) ·
`docs/session-and-transport.md` (session end, tokens, WS close codes) ·
`docs/verified-library-behaviour.md` (the probe record) ·
`docs/development.md` (commands, testing, quality gates) ·
`docs/i18n-architecture.md` (translation architecture).
