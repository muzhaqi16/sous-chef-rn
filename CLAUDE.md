# Sous Chef RN — project instructions

React Native 0.86 (New Architecture) · React 19.2 + React Compiler · Apollo
Client 4.2 (`dataMasking` on) + GraphQL codegen · Unistyles 3 · FlashList v2 ·
React Navigation 8 · Zustand · i18next · MMKV. Offline-first: writes land in
the cache immediately and replay through an offline queue.

## How rules are held

- **Lint and tests carry most rules, and report them where you break them.**
  Every file an agent edits is linted at once and the findings come back as a
  blocking result; a stop runs `typecheck`. `docs/rules/README.md` indexes every
  `sous-chef/*` rule and `docs/rules/restricted-syntax.md` every
  `no-restricted-syntax` entry, each message naming the replacement. This file
  holds what NO gate catches, and names the enforcer where one exists.
- **Loosening a gate is the user's decision.** Lint and TS configs, ratchet
  baselines, git hooks, workflows and `.claude/` hooks are `ask`-gated; a command
  that skips git hooks (`--no-verify`, `-n`, `HUSKY=0`, `core.hooksPath`) is
  refused. A disable comment is an error; a justified exemption is a file-scoped
  override in `eslint/project.js`. Never allowlist a finding — fix it.
- **`Verified: #anchor` points into `docs/verified-library-behaviour.md`**, which
  records the version checked and the probe; change such a rule only by
  re-running that probe.
- **A new rule is a lint entry or a Jest test**, never another check script.

## Commands

```bash
npm start / npm run ios / npm run android    # dev loop
npm run codegen      # re-pull schema + regenerate types (after any .graphql change)
npm run typecheck    # app, test AND e2e tsconfigs
npm run lint         # ESLint incl. every .graphql vs the pulled schema; --max-warnings 0
npm test             # full suite, unfiltered (~830 suites)

# after a change, before pushing
npm run typecheck && npm run lint && npm test
npm run check:compiler-bailouts && npm run check:unistyles-variants
npm run check:dead-modules && npm run check:import-cycles
```

Every other whole-tree gate and which hook or workflow runs it:
`docs/development.md` § Quality gates and § Git hooks.

## Working agreements

- **Parallel sessions share this checkout** — touch only your task's files; no
  `stash`, `reset --hard`, `checkout .`.
- **The API repo (`sous-chef-api`) is read-only**: read it to verify a contract,
  align the client to it, never edit it.
- **After every codegen, diff `src/graphql/generated/schema.graphql`** and commit
  it on its own. Its doc comments are the only record of BEHAVIOUR changes, so a
  doc-only diff can be a contract change.
- Conventional Commits (commitlint); PR guidance in `CONTRIBUTING.md`.
- **Measurement decides what to change.** Numbers from a release build, acted on
  from a device (an emulator understates, an iOS simulator overstates), with a
  control run first. The full protocol: `docs/performance-monitoring.md`
  § Measurement protocol.

## Structure & boundaries

Map and reasoning: `docs/architecture.md`.

- `src/features/<name>/` holds all twelve features, auth and onboarding included;
  `src/screens/` holds only `SplashScreen` and `NotFoundScreen`. Feature shape:
  `manifest.ts` (`id` = dir name), `screens/` (+ `registration.ts`), `hooks/`,
  `components/`, colocated `.graphql`.
- **The registry split is load-bearing.** Navigation iterates `registry.ts`;
  launch-path code reads `registry.static.ts` (i18n, push routes) and
  `registry.cache.ts` (type policies). Shell wiring goes in `manifest.static.ts`,
  never an import of `registry.ts` — § Three registries.
- **Feature API boundary** (`boundaries/dependencies`): a feature's `context/`,
  `utils/`, `components/`, `hooks/mutations/`, `offline/` and `graphql/` are
  internal; everything else — `screens/`, top-level `hooks/`, `ui/`, `testIDs.ts`,
  `*Fragments.generated.ts` types — is importable. `catalog/` owns the grocery `Item`,
  pickers and storage locations; its `ui/` is the shared grocery-item UI. Tests are exempt.
- **Kit** (`src/hooks/`, `src/components/`): only what 2+ features use, no
  `#features/*` import, no `.graphql`. `src/components/` has six tiers (atoms,
  molecules, organisms, templates, providers, performance), placed by what a
  component RENDERS (`atoms/README.md`). Review holds "no domain-named kit file" and "no kernel
  module named after a feature" (navigation stacks exempt).
- `src/domain/` is logic 2+ features share; `src/app/` is the composition root.
- **Aliases** are added ONLY in `tsconfig.json` `paths`. Each top-level `src/`
  folder is `#<name>`; irregular: `#/*` → `src/*`, `#operations`,
  `#generated`, `#/test-utils/*` → `__tests__/helpers/*`.
- **A `src/` module or export needs a PRODUCTION importer** (`check:dead-modules`):
  a test or `jest.mock()` does not count, so dead code goes with its test; a
  deliberate test seam is tagged `@internal`.
- **Every member a hook returns is read by production code**
  (`hookMembersAreConsumed.test.ts`). An unread one is a gap to wire or code to
  delete, never an allowlist entry.

## State ownership

- **Server owns it → Apollo; else Zustand** via `#store/useAppStore`'s named
  hooks, never a whole-store subscription; a context only for what a subtree
  passes down.
- **A feature store calls `registerSessionScopedStore(name, reset)`**
  (`sessionEndLeavesNoData.test.ts`).
- **Notifications live in the cache** (`notificationCacheWrites.ts`): a local
  write moves the badge by a delta, a server event reseeds the unread count,
  `addNotificationToFeed` scopes with `skipUnmatchedFilterVariants` —
  `docs/apollo-client-patterns.md` § Server events, the unread badge, and write scoping.

## TypeScript & comments

- **Types come from codegen**, never hand-written.
- **A condition the types say cannot matter is an error** (`no-unnecessary-condition`,
  all production `src/`). **Never delete a runtime guard to satisfy it**: delete a
  dead branch, or widen the type where DECLARED — annotate the receiving variable
  (not a destructured binding, which CFA re-narrows), or `switch` + `default` over
  a closed enum. `docs/architecture.md` § Type-level gates.
- **`noUncheckedIndexedAccess` is on**: bind and guard
  (`const [first] = xs; if (!first) return;`); `!` only in tests. A lookup table
  is keyed by its real key type (`sous-chef/no-string-keyed-lookup`).
- **A comment says only what code cannot** — a library gotcha, an invariant an
  edit would silently break. Present tense; one to three lines, no run over six;
  under half the code in a 60+ line file; no `@param` echoing the signature.
  Rationale goes in the PR or `docs/`, history in git — `docs/architecture.md`
  § Comments.

## GraphQL & Apollo

Deep dive: `docs/apollo-client-patterns.md`; offline model:
`docs/local-first-architecture.md`.

- **What renders gets data from its feature's `hooks/`**, as plain values and
  callbacks. The `src/apollo` import zone and `sous-chef/hook-returns-no-library-type`
  hold part of it; a screen or component calling `useQuery`/`useMutation`/the
  client directly is caught only by review. `useFragment` and masking types stay allowed.
- **Fragments**: a component or hook owns a sibling `<Consumer>_<entity>`
  fragment; screens spread children's, queries the screen's, mutations the
  hook's. A shared `*Fragments.graphql` has a consumer-list header, 2+ operations
  and 1+ hook. List cells are **strict** (`null` on `!complete`); detail panels and
  sheets **resilient** with guarded scalar reads.
- **A selection that spreads a fragment on a type with an `id` selects `id`
  directly** — masking hides the spread's `id` and `cache.identify` throws
  (`sous-chef/selects-key-field-directly`).
- **`Unmasked<>` only where Apollo's signature carries it**: an
  `optimisticResponse` return, or data a cache writer round-trips through
  `readFragment`/`writeFragment`. Never a prop, state or render-facing return;
  never `@unmask`.
- **`errorPolicy: 'all'` is the default: a failed mutation RESOLVES
  `{ data: undefined, error }`** — handle failure on the result, not only in a `catch`.
- **Settle a write with `settleMutation`** (`applied | queued | failed`; queued
  is never a failure) and narrow with `appliedPayload(data)`
  (`writesSettleThroughOneMechanism.test.ts`).
- **Pick a mutation pattern from `docs/apollo-client-patterns.md` § Choosing a pattern** (no `update` callback by
  default, `refetchQueries` last); build optimistic responses from
  `cache.readFragment` + spread, never hand-rolled shapes.
- **A field with a write-time invariant goes through its ONE writer** —
  `cache.writeFragment` (`writePurchaseInfo`), never `cache.modify`; the
  restoration pass uses `src/apollo/utils/fieldWriters.ts`.
- **An optimistic entity is COMPLETE for every query reading it**: a new read
  field reaches every connection writer (builder, create, `Sync*` replay,
  move/restock, subscription read-back) — `optimisticEntityCompleteness.test.ts`.
- **Suspense hooks are not adopted** (`docs/apollo-client-patterns.md`
  § Apollo Client 4.x Notes).
- **Gate a screen on `loading && !data`, NEVER `loading`** — it is true on every
  mount, warm cache or not. A defaults-filling hook returns a flag
  (`hasLoadedSettings`); the loading branch stays inside the header wrapper.
- **`returnPartialData: false`: `!data` means the read was INCOMPLETE**, so every
  writer writes the full shape its reader selects (`userProfileCompleteness.test.ts`). Verified: `#apollo-reports-loading-true-on-every-mount-warm-cache-or-not`.
- **Envelope + `node { id }` event subscriptions run `fetchPolicy: 'no-cache'`**
  (`eventSubscriptionFetchPolicy.test.ts`); **every `useSubscription` is followed
  by `useSubscriptionTransportRecovery`** (`transportRecoveryCoverage.test.ts`);
  **a WebSocket close is judged by code** (`src/apollo/links/wsCloseCodes.ts`),
  never reason.

## Session end & token rotation

Mechanism: `docs/session-and-transport.md`. No gate holds these.

- **`authService.logout()` is the only sign-out**; `SESSION_SCOPED_STATE` lists
  what it removes (`sessionEndLeavesNoData.test.ts`).
- **A session end STOPS things before clearing**: `runSessionTeardown()` first,
  the sign-out gate is one counted `whileSessionEnds` scope held through the
  store reset, `queueManager.onLogout()` only on deliberate sign-out, `/health`
  keeps probing.
- **A session end mints nothing**: `setTokens` refuses a pair inside the scope,
  and a refresh that outlives its session is discarded (`refreshToken.ts`) —
  `/revoke` retires the whole token family, its successor included.
- **Push delivery follows the session**: every session end revokes its refresh
  token (`POST /revoke`, parked in the keychain until the API answers), never
  the push token. `login`/`register` await `ensureDeviceId()` or the session is
  bound to no device.
- **A session end DROPS the socket client** (`disposeWebSocket()`), not just
  disposes it; no second reconnect loop; reconnect pacing goes in `url()`.
- **`AUTH_REFRESH_TOKEN_SUPERSEDED` ≠ `_INVALID`** — never sign out on the first;
  retry only once a different token is stored (`retryWithSuccessorToken`).
- **Only ONE transport presents the refresh token** (`registerRefreshInFlightCheck`);
  **never send on a dead access token** — await `proactiveTokenRefresh()`.
- **`getDeviceId()` is sync and never mints; `ensureDeviceId()` is the async
  single-flight resolver** (`singleDeviceIdentity.test.ts`).
- **Setting a password uses `newPasswordRule`; signing in uses `passwordRule`**,
  each mirroring the server (`auth.test.ts`).

## UI layer

Mechanism, evidence and traps for everything below: `docs/ui-layer.md`.

### One mechanism per concern

Each concern is solved once; an import ban or `sous-chef/*` rule names the
replacement when you reach past it — a growing list (`FlashList`), an image
(`CachedImage`), a modal (`useStandardBottomSheet` / `alertService`), a date or
quantity (`src/utils` formatters), device storage (a Zustand slice), loading
(`Loading`), a toast (`toastService`), navigation (`useAppNavigation`), text
(`<Text role>` + `tone`), inputs (`ThemedTextInput`), icons (`<Icon tone>`),
colour and spacing (`theme.*`), elevation (`theme.shadows`), text on a fill (its
`on*` token), local search (`useLocalSearch`), and nothing for reduce motion or
memoization. A screen is `Screen` or a preset over it (`SubScreen` for a pushed
screen, `FormScreen`, `DetailTemplate`, …) and never assembles its own header,
back control, gutter or safe area (`screenUsesTheScaffold.test.ts`,
`headerGeometry.test.tsx`). No gate holds these:

- **A sheet is `Sheet`; a full-screen form is `FormScreen`.**
- **A list row is `commonStyles.rowWrapper` + `rowSurface` + `rowContent`**, the
  `theme.layout.row*` steps, and `rowType` for its text.
- **Radius and z-index are `theme.*` tokens; a duration, spring or curve is
  `theme.motion`.**
- **A shared actions bag is `createActionsContext`**; a value read while
  rendering is `createValueContext`.
- **A form is react-hook-form + a yup schema beside it**; a write's outcome is
  `settleMutation`.

### Screens, sheets, rows

- **`Screen` never applies the top inset** — the navigator does. A bare
  `<SafeAreaView>` (no `edges`) insets all four sides.
- **A sheet's shell is `Sheet`** (`view | form | action | list`); `form` supplies
  the keyboard offset and input context. A sheet whose scrollable fills it is
  `list`, never `view`.
- **A row thumbnail carries no margin** (`rowContent`'s `gap` spaces it). **A
  skeleton row uses the same primitives; its container adds NO gap**, and owns
  the gutter only when it is a standalone sibling list.

### Unistyles

- **`StyleSheet.create(theme => …)`** styles RN primitives; `styles.useVariants`
  carries runtime flags; a per-element value is a dynamic function style. Merge a
  caller style as `style={[styles.x, callerStyle]}`. An element that can't take a
  typography `role` spreads `...theme.type.<role>`. Switches use `BaseSwitch`.
- **`withUnistyles(Component)`** themes a third-party component's props. A wrapper
  2+ files use lives in `src/components/atoms/themedComponents.tsx`; a single-use
  one stays beside its user.
- **Never wrap `Pressable`/`TouchableX` with `withUnistyles`**: it drops a
  function-style `style`. Verified: `#unistyles-withunistyles-drops-function-styles`.
- **`useUnistyles()` only for runtime metadata** (`rt.*`); a `theme.*` read
  re-renders on every theme change. The cross-library exceptions are listed in
  `docs/ui-layer.md`.
- **Plugin order is Unistyles → `unistyles-scope-crawl` → React Compiler.** Any
  other order skips or silently freezes `useVariants` (`check:unistyles-variants`). Verified: `#unistyles-usevariants-rewrite-needs-a-scope-re-crawl-before-the-compiler`.

### Theme: elevation, colour, motion

- **The shadow ramp is PER THEME**; `src/theme/foundations/shadows.ts` is the only
  place a `boxShadow` geometry is written, except a shadow whose colour is the point.
- **The motion scale stops at 300 ms**; a loop's longer period stays a literal.
- **Never branch an animation on reduce motion** — Reanimated applies it.
  `useMotionEnabled()` is the ONE read, for what a zero duration can't stop. Verified: `#reanimated-applies-reduce-motion-itself`.

### Gestures & scroll hosts

- **The default `Pressable` comes from `#components/atoms/themedComponents`.** Inside a
  `Swipeable`, a `GestureDetector` chain or `RectButton`-style coordination, use
  RNGH's. Use RNGH's `ScrollView` only when RNGH gestures sit inside it.
- **A FlashList whose rows carry RNGH gestures renders
  `renderScrollComponent={SwipeAwareScrollComponent}`**: RNGH v3 handlers survive a
  plain RN scroll takeover. A list with no RNGH rows may be exempted in
  `eslint/project.js` (`sous-chef/flashlist-declares-scroll-component`). Verified: `#rngh-v3-handlers-survive-a-native-scroll-takeover`.
- **Pull-to-refresh matches its host** (`sous-chef/rngh-refresh-control-matches-host`):
  an RNGH host takes an explicit `refreshControl={<ThemedRefreshControl … />}`
  (a bare `onRefresh` builds RN's control, which drops RNGH's gesture); a plain
  RN host takes `PlainScrollRefreshControl`; a standalone RNGH scroller renders
  `SwipeAwareScrollComponent`, never a hand-rolled RNGH `<ScrollView>`, or the
  Android spinner parks. Verified: `#rnghs-scroll-gesture-reaches-only-rnghs-refreshcontrol`.
- **`SwipeAwareScrollComponent`'s `nestedScrollEnabled={false}` stays** until a
  real-finger A/B measures it. Verified: `#rngh-ends-the-nested-scroll-its-scrollview-opens`.

### Bottom sheets

Design: `docs/backdrop-lifecycle-design.md`.

- **Drive a sheet with `visible` + `onDismiss`**; never inline `BottomSheet`,
  which conflicts with the global backdrop.
- **Every text input inside a sheet resolves to gorhom's `BottomSheetTextInput`**
  via `useIsBottomSheetInput()` — it throws outside a sheet. Verified: `#gorhom-keyboard-handling-requires-bottomsheettextinput`.
- **A content-sized sheet (`enableDynamicSizing`) takes NO keyboard-aware
  scrollable**: `BottomSheetView` and gorhom's `interactive` lift. Verified: `#a-keyboard-aware-scrollable-cannot-size-a-sheet`.
- **A fixed-snap sheet with inputs uses `BottomSheetFormScrollView`.** Never
  hardcode `bottomOffset` or pass it `undefined` (it defaults to
  `theme.spacing.md`); it measures from the input's bottom edge. Verified: `#keyboard-controller-bottomoffset-measures-input-bottom`.
- **A scrollable in a sheet sits in a `View style={{ flex: 1 }}`, never in
  `BottomSheetView`**, which is absolute with no height
  (`sous-chef/no-scrollable-in-bottom-sheet-view`). Verified: `#gorhom-bottomsheetview-cannot-bound-a-scrollable`.

### Lists (FlashList v2)

- **A FlashList is `flexBasis: 0`, so its host gives it a height**
  (`sous-chef/recycling-list-host-is-bounded`). No `estimatedItemSize` workalike.
- **Never feed FlashList `data` from `useDeferredValue` or inside
  `startTransition`**: production fatal `not enough layouts` —
  `docs/flashlist-layout-index-race.md`.
- **A list using `useFlashListPerformance` passes `perfCallbacks.CellRendererComponent`
  AND `onCommitLayoutEffect`**; the renderer is per-session sampled, so
  `undefined` is normal — `docs/flashlist-performance-analysis.md`.
- **A skeleton over a mounting FlashList releases on `hasContentLayout`**, never
  on loading flags or `onLoad`; its cover exists from the list's FIRST commit,
  and a settled EMPTY list releases on `rowCount: 0`. Verified: `#flashlist-v2-first-layout-opacity-gate`.
- **`InteractionManager` is a no-op stub in RN 0.86.3**; use `requestIdleCallback`. Verified: `#interactionmanager-is-a-no-op-stub`.

### Pickers, row actions, forms

- **Autocomplete hooks use `useAutocompleteSearch`** (`src/features/catalog/hooks/`):
  `localFirst: true` only for a complete reference set (units), `!isOnline` for a
  bounded slice; staleness is handled centrally. `InlineAutocomplete` caps at 6,
  else a modal picker; a stacked picker sets `stackBehavior="push"`.
- **Wrap vertically stacked form content in `DropdownStack`**; never hand-roll
  zIndex chains — the failure is device-only.
- **A swipeable row takes `leftActions` / `rightActions` of `SwipeAction`
  descriptors**; `key` is also the accessibility action name. Edit and delete
  builders live in `SwipeableItem/commonActions.ts`; `removesRow` is read by the
  row renderer.
- **`DynamicFormFields` renders a `component` NAME through the registry** that
  `FieldRendererProvider` supplies in `App.tsx`; callbacks travel in `props`; an
  entry rendering its own message sets `ownsErrorDisplay`.
- **A field the user can fix is reported ON the field**; alerts are for
  submission failures.
- **Validation is a yup schema beside the form** via `yupResolver`, `Controller`
  and `handleSubmit(onValid, logValidationErrors)`; the submit hook does not
  validate. Messages resolve LAZILY (`key => () => t(key)`,
  `src/utils/validation/common.ts`).
- **A cross-field rule needs an explicit `trigger()`**, or `rules={{ deps }}` where
  a `Controller` owns the write; a field a rule reads lives IN the form
  (`validationMessagesAreRendered.test.ts`). A paged form maps field → page
  (`FIELD_PAGE`) and navigates before reporting.
- **`dirtyFields` omits clean fields**: read it for truthiness, assert `toBeUndefined()`.
- **An editable quantity is seeded by `formatQuantityForInput`**: a cooking
  fraction only where it equals the value to three places, else the number
  rounded to three, in the device's decimal separator (`notation: 'decimal'` when
  the keypad has no `/`). Display rounds to at most three decimals (1/8 is 0.125).
  **`quantityInput` is re-formatted, never shown verbatim** — the API echoes it as a float string.

### Navigation

- **Navigators default to `inactiveBehavior: 'pause'`; only `HomeTabs` and the
  root `Home` screen set `'none'`** (`HomeTabs.test.tsx`, `RootNavigator.test.tsx`).
- **Under `'none'`, a secondary consumer of another tab's query stands its watcher
  down while blurred**: `skip: !isFocused` via `useFocusEffect`, plus
  `fetchPolicy: 'cache-first'` (load-bearing), plus `usePreservedConnection`.
  Reference: `useRecipeDiscovery`.

## React Compiler & worklets

- **No `useMemo`/`useCallback`/`React.memo`** until a profile shows a re-render
  on unchanged props, noted in a comment. Hook returns and inline `renderItem`s
  are already memoized; a dependency-array reference is a module-scope function
  (`syncAsAccountDefault`, `useDefaultHome.ts`). Memoization skips re-renders,
  never a mount: a slow `(mount)` needs fewer elements.
- **`check-compiler-bailouts` holds production `src` to zero bailouts and zero
  `'use no memo'`.** Needing one means the plugin order or
  `unistyles-scope-crawl` regressed: `node scripts/probe-unistyles-compiler-order.mjs`.
- **A `finally` (or catch-less `try`), or a value block (`?.` `??` `&&` `||`
  ternary) inside a `try` body, bails the whole function** — move the conditional
  after the `try`; `src/utils/finallyHelpers.ts` for `finally`. Verified: `#react-compiler-try-shapes`.
- **Never read or write `ref.current` during render** — adjust state during render.
- **A `scheduleOnRN` callback is defined in RN scope with only primitive extra
  args** (capture functions by closure) — `docs/rules/restricted-syntax.md`.

## i18n

Mechanism: `docs/i18n-architecture.md`. Lint holds the module-level `t`, `t`
defaults, prose literals, rendered enums, number–noun concatenation, and server
`message` text reaching the screen.

- **A feature owns its copy** (`src/features/<name>/locales/`, registered via
  `manifest.static.ts` and `src/i18n/localeTypes.ts` —
  `featureLocaleRegistration.test.ts`); `src/i18n/locales/` is shared copy, whose
  `errors.*`, `empty.*`, `labels.*` are the one home (`canonicalVocabulary.test.ts`).
- **The product name is `{{appName}}`** (`appNameInterpolation.test.ts`).
- **Keys are typed** (`TranslationKey`, `KeyUnder<'prefix'>`; `isTranslationKey`
  for server data). Never cast a string to a key.
- **Plural categories are derived** (`completePluralCategories`); a missing one
  falls to `fallbackLng`. Verified: `#i18next-plural-category-fallback`.
- **Never inflect for the reader's gender** (`addresseeGender.test.ts`); an
  interpolated `{{resource}}`/`{{entity}}` takes a frame nothing agrees with
  (`entityLabelAgreement.test.ts`).
- No guard proves completeness: prose under a name none of them reads passes all of them.

## Testing

Patterns: `docs/development.md` § Testing.

- Assert a mutation on the **cache**; drive a failure with a mock carrying
  `error`, never a stubbed throw.
- A mock's `data` is completed from the SDL: state only what you assert on;
  `partial: true` opts out. `operationMocks: []` is not "answer from the schema".
- **`Environment` and `Telemetry` are auto-mocked** (`jest.setup.js`): override
  with `mockReturnValue`, never a partial `jest.mock` factory.
- Never stub a react-hook-form form with an object: use the real hook, and pair
  `mockImplementation` with `jest.restoreAllMocks()`.

## Bundled credentials

Classify every credential-shaped `KEYS` var `PUBLIC_BY_DESIGN` (never an
infrastructure credential) or `ACCEPTED_FINDINGS` (`check-bundled-secrets.mjs`).
Launch-argument auth is gated on the signed artifact (`check-launch-arg-auth.mjs`).
`docs/bundled-credentials-decision.md`.

## Documentation

`docs/README.md` indexes every doc. Most used: `docs/architecture.md` ·
`docs/apollo-client-patterns.md` · `docs/local-first-architecture.md` ·
`docs/session-and-transport.md` · `docs/ui-layer.md` ·
`docs/verified-library-behaviour.md` · `docs/development.md` ·
`docs/i18n-architecture.md` · `docs/rules/README.md`.
