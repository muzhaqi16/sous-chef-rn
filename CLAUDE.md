# Sous Chef RN — project instructions

React Native 0.86 (New Architecture) · React 19.2 + React Compiler · Apollo
Client 4.1 (`dataMasking` on) + GraphQL codegen · Unistyles 3 · FlashList v2 ·
React Navigation 8 · Zustand · i18next · MMKV. Offline-first: writes land in
the cache immediately and replay through an offline queue.

Rules here are terse on purpose; each links to the doc that carries its
mechanism. A rule marked **Verified** names the installed version it was
checked against; `docs/verified-library-behaviour.md` holds the probe record
and per-rule re-check commands. If you change a verified rule, re-run its
probe and update the entry — a rule without a live check is a hypothesis.

## Commands

```bash
npm start / npm run ios / npm run android    # dev loop
npm run codegen      # re-pull schema + regenerate types (run before lint if schema is stale)
npm run typecheck    # app AND test tsconfig — run after every code change
npm run lint         # ESLint, incl. every .graphql operation vs the pulled schema
npm test             # full Jest suite (~15s) — always run unfiltered
node scripts/check-compiler-bailouts.mjs         # also in pre-push
node scripts/check-unistyles-variant-staleness.mjs   # also in pre-push
node scripts/check-bundled-secrets.mjs --self-test
```

`npm run lint` validates `.graphql` files against
`src/graphql/generated/schema.graphql` (`fields-on-correct-type` and
`no-deprecated` are errors), surfacing API drift at lint time instead of as a
codegen batch failure. Pre-push runs `typecheck`, `i18n:check`,
`check:codegen-orphans`, `check:version-sync`, and a codegen drift check.
Full command reference: `docs/development.md`.

## Repository map & imports

Directory map and module walkthrough: `docs/architecture.md`. The short form:

- `src/features/<name>/` — feature modules (screens, hooks, graphql, context,
  utils) + `registry.ts`. `src/screens/` is auth/onboarding flows only.
- `src/components/` — shared UI in four buckets: `atoms/`, `molecules/`,
  `organisms/`, `templates/` (plus `charts/`, `modals/`, `navigation/`,
  `providers/`, `settings/`). There is no `base/`. Feature-private UI stays in
  `src/features/<name>/components/` (e.g. the pantry form lives in
  `src/features/pantry/components/form/`).
- `src/hooks/` and `src/components/` hold ONLY what more than one feature
  uses; a hook owned by one feature lives in that feature.
- `src/apollo/` client, links, offline queue, cache persistence ·
  `src/store/` Zustand slices + reset manager · `src/i18n/` config + locales ·
  `src/services/`, `src/navigation/`, `src/theme/`, `src/utils/`.

**Import aliases** (`tsconfig.json` `paths`): every top-level `src/` folder has
a `#<name>` alias (`#components`, `#features`, `#hooks`, `#store`, …); the
irregular ones are `#/*` → `src/*`, `#operations` → `src/graphql/operations`
(preferred for operation imports), `#generated` → `src/graphql/generated`, and
`#/test-utils/*` → `__tests__/helpers/*`. Use aliases over relative paths.

**Feature API boundary** — public surface of a feature: `screens/`,
`manifest.ts`, top-level `hooks/` files, and `<feature>Fragments.generated.ts`
type imports. Everything deeper (`graphql/`, `context/`, `hooks/mutations/`,
`utils/`) is internal. Enforced in BOTH directions (feature → feature, shared
layer → feature) by `import/no-restricted-paths` zones in `.eslintrc.js`;
tests are exempt. Canonical table and the deliberate `graphql/` asymmetry:
`docs/architecture.md` § The public API boundary.

## State ownership

**If the server owns it, Apollo owns it; otherwise Zustand owns it** — read
via the named hooks from `#store/useAppStore`, never by subscribing to the
whole store. Table and slice list: `docs/architecture.md` § State.

Notifications are the worked example: feed, read-state and unread count live
ONLY in the Apollo cache, and
`src/features/notifications/utils/notificationCacheWrites.ts` applies every
transition (user acting locally AND the subscription handler); the Zustand
slice keeps only `pendingExpirationLinks`, which the cache cannot hold. **A
local write moves the badge by a delta; a server-delivered event calls
`reseedUnreadCount()`** — Apollo normalizes the event's `node` into the cache
BEFORE `onData` runs, so the payload has already answered "was this unread?".
**`addNotificationToFeed` must scope its write** with
`skipStoreField: skipUnmatchedFilterVariants(...)` — `cache.modify` runs for
every cached `notificationsConnection(filters:…)` variant, and the guard is
what keeps a pantry notification out of the recipes feed. Mechanism:
`docs/apollo-client-patterns.md` § Server events, the unread badge, and write
scoping.

## TypeScript conventions

- Types come from codegen — never hand-write a type the schema already
  defines; run `npm run codegen` after changing any `.graphql`.
- **Never write `as unknown as X`** — fix the data flow or widen the contract.
- `__typename: 'Mutation' as any` is never needed.
- `Unmasked<>` appears ONLY as an `optimisticResponse` callback return type;
  never `@unmask`. HKT registration: `src/types/apollo-masking.d.ts`.

## GraphQL & Apollo

### Fragments & data masking

`dataMasking: true` is global (`src/apollo/client.ts`). Templates and full
mechanism: `docs/apollo-client-patterns.md` § Fragment Composition & Data
Masking.

- A component/hook owns its fragment in a sibling `.graphql` file, named
  `<Consumer>_<entity>`. Screens compose children's fragments by spread;
  queries spread the screen fragment, mutations the hook's.
- Shared fragments live in per-feature `*Fragments.graphql` files, each with a
  consumer-list header — the contract for staying shared. Bar for adding one:
  2+ operations and 1+ hook needing the identical shape. Find the files:
  `ls src/features/*/graphql/*Fragments.graphql src/graphql/operations/*/[a-z]*Fragments.graphql`.
- Generated catalog-fragment names (`ItemFragment*`, `PantryItemDisplay*`, …)
  are banned imports — the authoritative list is the `no-restricted-imports`
  patterns in `.eslintrc.js`. Create a colocated fragment instead.
- Two consumer shapes, picked by blanking tolerance: **strict**
  (`FragmentType<typeof XDoc>` prop, `return null` on `!complete`) for list
  cells; **resilient fallback** (`FragmentType<typeof XDoc> | XFragment`, fall
  back to the source prop) for detail panels and sheets — and guard scalar
  reads when the fallback fires, because on `!complete` the cast lies.
- **Any selection set that spreads a fragment identifying its type must also
  select `id` directly** — masking hides the fragment's fields, key field
  included, and `cache.identify` throws without it. It's free (`id` is already
  fetched inside the fragment). Enforced by
  `__tests__/graphql/maskingIdentity.test.ts`.

### Mutations & cache updates

Pick the cache-update pattern by what the mutation changes
(`docs/apollo-client-patterns.md` has the deep dive):

| Pattern                                       | Use when                                                            | Example                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| No `update` callback (preferred default)      | Mutation returns the entity; Apollo normalizes by `__typename + id` | `useAdjustPantryItemQuantity`                                              |
| `cache.modify` on parent aggregates           | Parent stat fields not in the response                              | `useRecipeReviews` (`Pantry.stats` uses its `mergeObjects` policy instead) |
| `cache.modify` BEFORE firing, revert on error | Optimistic UI without a callback                                    | `useToggleShoppingItem`                                                    |
| `updateEntityFieldsLocalFirst`                | Settings-shaped entity whose field names ARE the setting names      | `useAppSettings`, `useNotificationSettings`                                |
| `cache.modify` on connection edges + counts   | Entity moves between filtered connections                           | `moveShoppingListItemTo*` helpers                                          |
| `writeFragment`                               | Subscription push written through                                   | `usePantrySubscriptions`, `useShoppingListSubscriptions`                   |
| `refetchQueries` (last resort)                | Query shape underivable from the response                           | `CreateHomeScreen`, `useRecipePreload`                                     |

Defaults:

- `errorPolicy: 'all'` — a failing mutation RESOLVES with
  `{ data: undefined, error }`; it does not throw. Put failure handling on the
  resolved result, not only in a `catch`.
- Build optimistic responses from the cache (`cache.readFragment` + spread),
  never from hand-rolled placeholder shapes. Prefer the
  cache.modify-before-mutation + revert pattern when no callback is needed.
- Avoid `refetchQueries` unless `cache.modify` would duplicate server logic.
- **A refusal that names a `field` routes to LOCALIZED copy — never display
  the server's `message`** (it is unlocalizable English by construction).
  `alertRejectedMutation` / `alertIfRejected` already resolve
  `errors.field.<field>` with the caller's copy as fallback; never branch on
  `message` text. Reasoning: `docs/apollo-client-patterns.md` § Localizing
  refusals.
- **Never pair `optimisticResponse` with `context: { localFirst: true }`** —
  Apollo tears the optimistic layer down when the mutation completes, and
  offline that completion is `queueLink`'s null result, so the change reverts
  on screen while queued. Local-first writes the cache permanently first.

### Local-first & optimistic completeness

- **Optimistic entities must be COMPLETE for every query that reads them.**
  One missing field makes the whole cache read incomplete and `useQuery`
  returns nothing — invisible offline for the rest of the session. A field
  added to a list query (or a fragment it spreads) must reach the optimistic
  builder, the create mutation's selection, AND the queue's `Sync*` replay
  fragment. `__tests__/apollo/optimisticEntityCompleteness.test.ts` executes
  the real schema and asserts `cache.diff` completeness for all three writers
  — add a case for any new local-first entity.
- Nested entity references (`unit`, `item`): resolve via `cache.readFragment`
  selecting **every** field the query needs — it returns null on a partially
  cached entity exactly as on a missing one.
- **Cache persistence is raw Apollo state**: `cache.extract()` /
  `cache.restore()` to MMKV (`src/apollo/offline/ApolloCachePersistence.ts`),
  connections and `pageInfo` included, purged on version change. Stale
  pagination self-corrects via `cache-and-network`. New paginated connections:
  `docs/apollo-client-patterns.md` § Adding a new paginated connection.
- Full queue/replay model: `docs/local-first-architecture.md`.

### Queries & fetch policies

`watchQuery` defaults to `cache-and-network` → `cache-first`; one-shot
`query` is `network-only`; everything `errorPolicy: 'all'`
(`src/apollo/client.ts`). `useSuspenseQuery` / `useBackgroundQuery` are
deliberately not adopted — reach for them only when a new screen has 2+
independent parallel queries; rationale and decision trees:
`docs/apollo-client-patterns.md` § Apollo Client 4.x Notes.

### Subscriptions & transport verdicts

- **Event subscriptions whose payload is an envelope + `node { id }` run with
  `fetchPolicy: 'no-cache'`** (`PantryEvents`, `MyShoppingListsEvents`).
  Cached, the envelope re-creates a just-deleted row as a bare `{ id }`, the
  list query goes incomplete, and Apollo refetches the whole page per delete.
  `docs/flashlist-performance-analysis.md` § Refetch after every write.
- WebSocket close codes carry one verdict each — never branch on the reason
  string. The canonical record is `src/apollo/links/wsCloseCodes.ts`, pinned
  against the installed graphql-ws by
  `src/apollo/links/__tests__/wsCloseCodes.library.test.ts`. Library-fatal
  closes error every subscription sink; `useSubscriptionTransportRecovery`
  (placed after every `useSubscription`) is what re-subscribes. Verdict table
  and mechanism: `docs/session-and-transport.md`.

## Session end & token rotation

Mechanism and reasoning: `docs/session-and-transport.md`. The rules:

- **`authService.logout()` is the only sign-out.** `SESSION_SCOPED_STATE`
  (`src/store/resetManager.ts`) is the single list of what a session end
  removes; `src/store/__tests__/sessionEndLeavesNoData.test.ts` makes every
  surviving persisted key be classified on purpose.
- A session end STOPS things before clearing them: `endSession` runs
  `runSessionTeardown()` (`src/store/sessionTeardown.ts`) first.
  `completeLogout()` must run after `performLogoutCleanup()`;
  `queueManager.onLogout()` fires only on deliberate sign-out (a rejected
  refresh token must not delete queued writes); the unauthenticated `/health`
  probe keeps running.
- Both transports rotate tokens. `AUTH_REFRESH_TOKEN_SUPERSEDED` ≠
  `AUTH_REFRESH_TOKEN_INVALID` — never sign out on the first. Retry a lost
  rotation **only once a different token is stored**
  (`retryWithSuccessorToken` in `src/apollo/links/refreshToken.ts`);
  re-presenting a spent token past the ten-second replay window revokes the
  whole lineage.
- A session end must DROP the socket client, not just dispose it — graphql-ws's
  `dispose()` is a one-way latch (`disposeWebSocket()` clears the reference).
  Do not add a second reconnect or backoff loop beside graphql-ws's own;
  pacing goes in `url()`, not `retryWait`.

## UI layer

### Unistyles

- **`StyleSheet.create(theme => …)` for RN primitives** — theme changes push
  straight to native via the ShadowTree, no React re-render.
  `styles.useVariants({ … })` for runtime flags instead of conditional theme
  reads. Merge a caller `style` with the array pattern
  `style={[styles.x, callerStyle]}`.
- **`withUnistyles(Component)` for third-party components** taking
  theme-derived props, so only the wrapper re-renders on a theme tick. Shared
  wrappers live in `src/components/atoms/themedComponents.tsx`
  (`ThemedBottomSheetTextInput`, `ThemedActivityIndicator`,
  `OnPrimaryActivityIndicator`, …) — add new ones there, not per-file. Use
  `BaseSwitch` (`src/components/atoms/BaseSwitch.tsx`) for switches and
  `<Icon tone="X" />` (`src/utils/iconUtils.tsx`) for themed icon colors.
- **Never wrap `Pressable`/`TouchableX` with `withUnistyles`** — the wrapper
  silently discards a function-style `style={({ pressed }) => [...]}`
  callback. Verified 2026-08-23 vs `react-native-unistyles@3.3.0` — re-check:
  `node -e "console.log(Object.assign({}, ({pressed}) => [{padding:12}]))"`
  prints `{}`; mechanism:
  `docs/verified-library-behaviour.md#unistyles-withunistyles-drops-function-styles`.
- **`useUnistyles()` only for runtime metadata** (`rt.colorScheme`,
  `rt.themeName`, `rt.insets`) — reading `theme.*` through it re-renders the
  whole component on every theme change. Deliberate exceptions, each a
  cross-library hand-off: `useTheme`/`ThemedStatusBar`,
  `RootNavigator.Navigation` (React Navigation `Theme`), `TrendLineChart`
  (Skia draw calls), `RecipeMain`/`SortableShoppingList` (theme colors into
  data structures).
- **Plugin order is Unistyles → `unistyles-scope-crawl` → React Compiler**
  (`babel.config.js`), i.e. the documented order plus a crawl wedged between.
  Unistyles' `useVariants` rewrite declares a shadowing binding without calling
  `scope.crawl()`, so without the crawl the compiler cannot lower the function
  and skips it. Running the compiler FIRST also compiles, but it then caches the
  variant-resolved style on the wrong dependencies and the variant freezes at
  its first-render value — memoized, zero bailouts, and silently wrong. Don't
  reorder these three. Verified vs `react-native-unistyles@3.3.0` +
  `babel-plugin-react-compiler@1.0.0` — re-check:
  `node scripts/probe-unistyles-compiler-order.mjs`; mechanism and the measured
  three-way table:
  `docs/verified-library-behaviour.md#unistyles-usevariants-rewrite-needs-a-scope-re-crawl-before-the-compiler`.

### Pressable & gestures

- Default: `Pressable` from `#components/atoms/themedComponents` — RN's
  Pressable re-exported; the babel plugin auto-binds it to the ShadowTree, so
  function-style styles and theme switches work with no wrapper.
- For gesture composition (inside a `Swipeable`, a
  `GestureDetector`/`Gesture.X` chain, or `RectButton`-style coordination),
  import `Pressable` from `react-native-gesture-handler` — RN's Pressable does
  not participate in RNGH's gesture system.
- `ScrollView` from RNGH only when the container has RNGH gesture components
  inside it; plain forms and settings screens use RN's `ScrollView`.
- **A FlashList whose rows carry RNGH gestures MUST render RNGH's `ScrollView`**
  via `renderScrollComponent={SwipeAwareScrollComponent}`
  (`src/components/atoms/SwipeAwareScrollComponent.tsx`). RNGH cancels only v1/v2
  handlers when a native scrollable grabs the touch (`cancelAllLegacyHandlers`), and
  `ReanimatedSwipeable` is on the v3 detectors — so over a plain RN `ScrollView` the
  row's pan survives the takeover, accumulates horizontal drift for the whole drag,
  and opens rows mid-scroll. **No `dragOffset` value fixes this**; the drift is
  unbounded. An RNGH scrollable restores arbitration through the orchestrator.
  `__tests__/gestures/flashListScrollComponents.test.ts` makes EVERY FlashList
  declare a `renderScrollComponent` — RNGH's here, gorhom's `BottomSheetScrollable`
  inside a sheet — or sit on an allowlist with a reason, so a new list cannot ship
  without the decision being made. `SwipeableItem`'s `dragOffset` (16dp) is defence in
  depth only, and takes one positive number because `dragOffsetFromRight` throws in
  `__DEV__` unless non-positive. Verified 2026-08-24 vs
  `react-native-gesture-handler@3.2.1`:
  `docs/verified-library-behaviour.md#rngh-v3-handlers-survive-a-native-scroll-takeover`.
- **That list's pull-to-refresh must pass an EXPLICIT RNGH `RefreshControl`** —
  `refreshControl={<ThemedRefreshControl … />}`, never a bare
  `onRefresh`/`refreshing` pair. RNGH's `ScrollView` hands its scroll gesture to
  whatever control it is given, as
  `cloneElement(refreshControl, { block: scrollGesture })`, and `block` is in
  RNGH's `NativeWrapperProps` — so only a control from `createNativeWrapper`
  (RNGH's own, which `ThemedRefreshControl` wraps) routes it into
  `useNativeGesture`. RN's control takes the prop and drops it.
  **The trap: you get RN's control without ever naming it.** Given only
  `onRefresh`, FlashList builds one itself (`useSecondaryProps.tsx`,
  `else if (onRefresh)`) and the one it builds is React Native's — which is how
  the shopping list shipped an indicator that hung mid-list and would not retract
  until pushed back up by hand, while every list passing an explicit control was
  fine. A plain RN scrollable host takes `PlainScrollRefreshControl` instead;
  pick by host. The `withUnistyles` wrapper is transparent to either (the gesture
  crosses by reference). Verified 2026-08-24 on device vs
  `react-native-gesture-handler@3.2.1` + `@shopify/flash-list@2.3.2` +
  `react-native-unistyles@3.3.0` — re-check:
  `node scripts/probe-withunistyles-prop-passthrough.mjs`; guarded by
  `__tests__/gestures/flashListScrollComponents.test.ts`, which derives its file
  list from the tree so a new list cannot ship the mismatch.

### Bottom sheets

- **Always `BottomSheetModal`, never inline `BottomSheet`** — its backdrop
  conflicts with the global `OverlayBackdropProvider` + `GlobalBackdrop`
  system. Drive it through **`useStandardBottomSheet`**
  (`src/hooks/useStandardBottomSheet.tsx`): a `visible` boolean + `onDismiss`,
  never `present()`/`dismiss()` outside an effect.
- **Every text input inside a sheet must resolve to gorhom's
  `BottomSheetTextInput`** — a plain RN `TextInput` leaves the sheet blind to
  the keyboard. It throws outside a sheet, so shared inputs pick it from
  context — `useIsBottomSheetInput() ? ThemedBottomSheetTextInput :
ThemedTextInput` — as `FormInput`, `FractionInput`, `EditableCounter` and
  `BottomSheetAutocompleteInput` do. Verified 2026-08-23 vs
  `@gorhom/bottom-sheet@5.2.14` — mechanism:
  `docs/verified-library-behaviour.md#gorhom-keyboard-handling-requires-bottomsheettextinput`.
- **Sheets containing inputs use `BottomSheetFormScrollView`** — a
  gorhom-registered `KeyboardAwareScrollView` that also supplies the input
  context above. `bottomOffset` defaults to the density-scaled
  `theme.spacing.md`, applied as a `withUnistyles` mapping in
  `BottomSheetKeyboardAwareScrollView` (sheets) and
  `ThemedKeyboardAwareScrollView` in `themedComponents.tsx` (full-screen
  forms) — never hardcode a pixel offset at a call site; pass the prop only to
  deliberately override, and never pass `undefined` (it clobbers the mapping).
  A sheet still on raw `BottomSheetKeyboardAwareScrollView` gets the offset
  but NOT the input context — its inputs resolve to the plain RN one — so
  convert it to `BottomSheetFormScrollView` when you're already working in it.
  Find the unconverted set:
  `grep -rl BottomSheetKeyboardAwareScrollView src` (the production files
  besides the component and its wrapper). `bottomOffset` measures from the
  input's **bottom edge** — Verified 2026-08-24 vs
  `react-native-keyboard-controller@1.22.4`:
  `docs/verified-library-behaviour.md#keyboard-controller-bottomoffset-measures-input-bottom`.
- **Never wrap a scrollable (`FlashList` via
  `useBottomSheetScrollableCreator`, `BottomSheetScrollView`,
  `BottomSheetFlatList`) in `BottomSheetView`** — it is absolutely positioned
  with no bottom or height, so a list inside it is never height-bounded and
  cannot scroll. Put the list in a plain `View style={{ flex: 1 }}` (as
  `IngredientSelectorSheet` / `AddMealSheet` do); `maxHeight` lists merely get
  away with it. Verified 2026-08-23 vs `@gorhom/bottom-sheet@5.2.14` —
  re-check:
  `cat node_modules/@gorhom/bottom-sheet/src/components/bottomSheetView/styles.ts`;
  guarded by `BottomSheetAutocompleteInput.test.tsx`.

### Lists (FlashList v2)

- `estimatedItemSize` is **removed** in FlashList v2 — the prop no longer
  exists in the installed 2.3.2; don't reintroduce it or a workalike.
- **Never feed FlashList `data` from `useDeferredValue` or inside
  `startTransition`.** FlashList truncates its layout table during render and
  re-indexes cells only at commit; only a transition render can be interrupted
  between the two, and a native `onLayout` landing in that gap is a production
  fatal (`index out of bounds, not enough layouts`).
  `docs/flashlist-layout-index-race.md`.
- **Every FlashList using `useFlashListPerformance` passes
  `perfCallbacks.CellRendererComponent` AND `onCommitLayoutEffect`** — the
  renderer is how blank cells are counted (FlashList's own viewability is
  geometric and 250 ms-lagged), and the commit callback drives the
  `hasContentLayout` latch. The renderer is per-SESSION sampled
  (`flashListInstrumentationSampleRate`: dev 1.0, release 0.05) because the
  per-cell `Animated.View` + layout effect costs ~30–60 ms of the device's
  ~320 ms first-layout window; `undefined` in unsampled sessions is normal.
  `docs/flashlist-performance-analysis.md` § Reading the instrumentation.
- **A skeleton over a mounting FlashList releases on `hasContentLayout`, never
  on data-loading flags** — FlashList v2 holds EVERY cell (sticky sentinel
  rows included) at `opacity: 0` until its progressive first layout commits,
  so "data ready" precedes "rows visible" by 300 ms+ on a mid-range device
  and a loading-flag release exposes a header-only blank frame. And the cover
  itself must exist from the list's FIRST commit: anything whose mount waits
  on a post-commit state update (`onLayout` measurement, a deferred flag) is
  starved behind the row-mount storm it exists to hide — the pantry's cover
  is an absolute flap inside `ListHeaderComponent` for exactly this reason
  (`PantryListSkeletonOverlay.tsx`). `onLoad` cannot stand in for the latch:
  it fires once per mount and a sentinel-only skeleton layout consumes it.
  Verified 2026-08-26 vs `@shopify/flash-list@2.3.2`, on-device evidence:
  `docs/verified-library-behaviour.md#flashlist-v2-first-layout-opacity-gate`
  (the companion `docs/audits/perf-blank-window-2026-08-26.md` was deleted in
  `8a7c8c76`; recover with `git checkout 8a7c8c76^ -- docs/audits/`).
- **Never use `InteractionManager`** — in the installed RN 0.86.3 it is a
  no-op stub (`runAfterInteractions` is `setImmediate`). Use
  `requestIdleCallback` for deferring non-urgent work. Verified 2026-08-24:
  `docs/verified-library-behaviour.md#interactionmanager-is-a-no-op-stub`.

### Autocomplete & dropdowns

- All autocomplete hooks use `useAutocompleteSearch`
  (`src/hooks/ui/useAutocompleteSearch.ts`). `localFirst` short-circuits the
  network on a local match — safe only when the warmed cache is **complete**
  for the dataset. Decision rule: complete reference set → `localFirst: true`
  (units); bounded slice of a larger catalog → `localFirst: !isOnline`
  (stores/brands/categories warm ~100 rows; items keep a seen-items LRU).
  Current assignments: `grep -rn "localFirst" src/hooks/autocomplete`.
- Stale-result display is handled centrally (the `lastFiredTerm` guard) —
  consumer hooks do not implement their own relevance checks.
- Inline vs modal picker inside a sheet: pick by result set, not by host.
  `InlineAutocomplete` caps at 6 suggestions, so inline suits a set the user
  narrows by typing; a catalog needing its own search gets the modal picker. A
  stacked picker must set `stackBehavior="push"` (gorhom's default `'switch'`
  minimizes the host, which reads as a crash) and, where it can, a snap point
  taller than its host — `snapPoint` is a prop; override it per call site.
- **Wrap vertically stacked form content in `DropdownStack`**
  (`src/components/atoms/DropdownStack.tsx`); never hand-roll zIndex chains.
  RN `zIndex` orders siblings only, and Android view flattening prunes
  layout-only wrappers — a missed level paints the dropdown UNDER later
  inputs, on device only, invisible to typecheck/lint/jest.

### Forms & validation

- **A field the user can fix is reported ON the field, never through
  `alertService.alert`.** A modal covers the form, has to be dismissed before
  the field can be corrected, and once dismissed no longer says which field —
  or, in a paged sheet, which page — it meant. Alerts remain correct for
  SUBMISSION failures (a server refusal, a network throw): those are not a
  field the user can edit.
- **Validation lives in a yup schema next to the form**, resolved through
  `yupResolver` on `useForm`; fields render through `Controller` and Save goes
  through `handleSubmit(onValid, logValidationErrors)`. The submit hook does
  not validate — reaching it means the form is already valid. Schemas:
  `shoppingItemFormConfig.ts` (shared by the AddEditItem screen and the
  AddToShoppingList sheet), `addPantryItemFormConfig.ts`,
  `pantryItemFormConfig.ts` (the edit form).
- **Schema messages resolve LAZILY** — `const msg = key => () => t(key)`. A
  schema is built once at module scope, so an eagerly-resolved message freezes
  whichever language was active at import time; yup calls the function when the
  rule fails, which lands after any language change. Never hardcode the
  English string. Pattern: `src/utils/validation/common.ts`.
- **A cross-field rule needs an explicit `trigger()`.**
  `setValue(field, v, { shouldValidate: true })` re-validates THAT field only.
  The all-or-nothing net-weight rule lives on the *unit* while its inputs are
  the weight and the unit id, so without
  `trigger('netWeightUnit')` typing a weight never raised the message and
  picking a unit never cleared it. Verified on device 2026-08-26.
- **A paged form maps field → page** (`FIELD_PAGE` in
  `addPantryItemFormConfig.ts`) and navigates before reporting, so the message
  is on screen instead of behind a tab the user has to find.
- **`dirtyFields` OMITS clean fields** — react-hook-form does not set them
  `false`. Read for truthiness (`if (dirtyFields.itemName)`), and assert
  `toBeUndefined()`, not `toBe(false)`.

### Navigation

- Navigators default to `inactiveBehavior: 'pause'`; **only `HomeTabs` and the
  root `Home` screen set `'none'`** — asserted by `HomeTabs.test.tsx` and
  `RootNavigator.test.tsx`. The trade is one multi-second resume freeze
  against continuous background watcher work; right for four FlashLists,
  wrong almost everywhere else. Mechanism and when to re-measure:
  `docs/architecture.md` § Navigation.
- Under `'none'`, a secondary consumer of another tab's query must stand its
  watcher down while blurred: `skip: !isFocused` driven by `useFocusEffect`
  (the repo's preference over `useIsFocused`) + `fetchPolicy: 'cache-first'`
  (load-bearing — Apollo resets a re-enabled query to its initial policy) +
  `usePreservedConnection` to hold the last result. Reference:
  `useRecipeDiscovery`.

## React Compiler

- **Default to NOT writing `useMemo` / `useCallback` / `React.memo`** — the
  compiler memoizes. A default, not an absolute; manual memoization is right
  for: a value feeding a **dependency array**, and a prop read by something the
  compiler did not compile (a third-party `===` check). The bailout baseline
  (`scripts/check-compiler-bailouts.baseline.json`) is empty — a file appearing
  there is a regression to fix, not a licence to memoize. The
  lint rule is an error so the exception is written down:
  `// eslint-disable-next-line no-restricted-imports` + the reason.
- **Never add `'use no memo'`.** The `noMemoOptOuts` list in
  `scripts/check-compiler-bailouts.baseline.json` is EMPTY and the ratchet only
  lets it shrink, so a new one fails the check. Needing one means the Babel
  plugin order or `scripts/babel/unistyles-scope-crawl.js` has regressed and a
  component's `styles.useVariants(...)` reads are freezing at their
  first-render value — run `node scripts/probe-unistyles-compiler-order.mjs`
  and fix that, rather than opting the component out.
  `node scripts/check-unistyles-variant-staleness.mjs` (baseline empty, runs in
  CI and pre-push) is what catches it.
- **Two `try` shapes bail the compiler out of the whole function**: a
  finalizer (`finally` with or without `catch`; also a catch-less `try`), and
  a value block (`?.`, `??`, `&&`, `||`, ternary) inside the `try` body. A
  plain-statement `try/catch` compiles — move the conditional out:

  ```ts
  // BAILS — `?? null` is a value block inside the try
  let data = null;
  try { data = (await client.query(…)).data ?? null; } catch {}

  // COMPILES — plain assignment in the try; the value block moved out
  let result;
  try { result = await client.query(…); } catch {}
  const data = result?.data ?? null;
  ```

  Verified 2026-08-23 vs `babel-plugin-react-compiler@1.0.0` — re-check:
  `node scripts/probe-compiler-try-forms.mjs`. The react-compiler ESLint rule
  goes silent on unsupported syntax, so
  `node scripts/check-compiler-bailouts.mjs` is the real enforcement; for
  `finally` cases use the helpers in `src/utils/finallyHelpers.ts`. Mechanism:
  `docs/verified-library-behaviour.md#react-compiler-try-shapes`.

- **Never read or write `ref.current` during render** — use the
  adjusting-state-during-render pattern for previous/current comparisons.
- Hook return objects and inline `renderItem`s are auto-memoized in every file
  the compiler reaches. Reach for `React.memo` only once a profile shows a
  specific component re-rendering on unchanged props, and say so in a comment.
- Memoization only skips **re-renders**; it never makes a **mount** cheaper.
  A profile dominated by `(mount)` rows — a list paginating, a screen opening —
  will not improve from `React.memo` or the compiler. Reduce elements per row
  or mount fewer of them instead.

## Worklets — `scheduleOnRN`

Callbacks passed to `scheduleOnRN` (the `runOnJS` replacement) must be
**pre-defined in RN scope** — an inline function crashes on Android — and any
extra arguments must be **primitives only**: a function reference crosses the
worklet boundary as a plain object in release builds. Capture functions by
closure instead:

```ts
const handleDismiss = () => onDismiss(id); // RN scope, captures by closure
const gesture = Gesture.Tap().onEnd(() => {
  scheduleOnRN(handleDismiss);
});

scheduleOnRN(() => onDismiss(id)); // WRONG — inline fn: native crash
scheduleOnRN(dismissEntry, onDismiss, id); // WRONG — fn arg: object in release
```

Two `no-restricted-syntax` rules enforce this (no inline first argument; max 2
arguments).

## i18n

- `useTranslation()` from `#/i18n` in components and hooks; module-scope `t`
  from `#/i18n` in services/utilities. The module-scope `t` does NOT subscribe
  to language changes; lint enforces the hook in `src/**/*.tsx`, and a file
  that genuinely needs the module-scope one imports it as `tGlobal`. Don't
  reintroduce `getI18n().t(...)` — `t` takes i18next's full options
  (`t('key', { count })`, `t('key', 'English fallback')`).
- **Shared copy has one home.** `errors.*`, `empty.*`, `labels.*` are
  canonical; no namespace may redeclare a string another already has
  (`__tests__/i18n/canonicalVocabulary.test.ts`). Recorded non-duplicates:
  runtime-composed key namespaces (`errors.codes.*`, `usagePurpose.*`, …) and
  one-English-word-two-grammatical-roles entries. **Adding a suffix to
  `alertMutationFailure` means adding it to `ALERT_SUFFIXES` in both places.**
- **Never concatenate a number with a translated noun** — use
  `t('key', { count })` with a whole sentence per plural form
  (`numberNounConcatenation.test.ts`; literal `'s'` appends are banned too).
- **Plural categories are derived, not hand-written** —
  `completePluralCategories` (`src/i18n/config.ts`) fills what a locale's JSON
  lacks. Verified 2026-08-23 vs `i18next@26.0.10` — a missing category falls
  through to `fallbackLng`, not the locale's own `_other`:
  `docs/verified-library-behaviour.md#i18next-plural-category-fallback`.
- **Never inflect copy for the reader's gender** — use a construction with no
  gendered slot (`addresseeGender.test.ts`). Noun agreement belongs in
  per-context keys, never in a runtime parameter.
- None of the guards proves completeness — a string reaching JSX through a
  variable is invisible to all of them. Rules' history, guard inventory, and
  the pseudolocalization plan: `docs/i18n-architecture.md`.

## Testing

Full patterns and examples: `docs/development.md` § Testing.

- **Always `renderHookWithApollo` / `renderWithApollo` from
  `#/test-utils/apolloMockProvider`** — a schema-backed cache with type-safe
  mocks. `jest.mock('@apollo/client/react', …)` is lint-banned: it couples
  tests to operation names and bypasses the cache integration the tests exist
  to catch. Import `MockedResponse` from the helper, not
  `@apollo/client/testing`.
- For mutation tests, assert on the **cache** after the mutation, not on the
  mock function.
- A failing mutation RESOLVES (`errorPolicy: 'all'`) — drive failures with an
  operation mock carrying an `error`, never by stubbing a helper to throw.
- `variables: () => true` for complex transformed inputs;
  `waitFor(() => expect(result.current.loading).toBe(false))` as the settling
  primitive; schema-driven `mocks` for deep fragment selections; `__typename`
  on every literal mock entity; subscription hooks keep mocking
  `subscriptionService.register` to capture `customOnData`.
- Helper shortcuts: `recordMock()` (captures every variables payload Apollo
  observed), `seedCache()` (pre-writes entities for `cache.readFragment`).
- `Environment` and `logger` are auto-mocked globally — override per-suite
  with `mockReturnValue`, never replace the module with a partial factory. Its
  `allowsLaunchArgAuth` default is `true`, matching what the REAL function
  returns under Jest (`__DEV__` is true) — a double that inverts the thing it
  stands in for silently disables coverage everywhere.
- **A react-hook-form form cannot be stubbed with a plain object** — fields
  render through `Controller control={control}` and `control` has no
  plain-object equivalent. Delegate to the real hook
  (`jest.requireActual(...)`, seeded via `initialState`) and spy on the writes;
  the test then exercises the real schema, so a case expecting a refusal gets
  one for the real reason. `jest.clearAllMocks()` does NOT reset a spy's
  implementation — a `mockImplementation` in one test leaks its seeded form
  into every test after it, so pair it with `jest.restoreAllMocks()`.

## Bundled credentials

Every credential-shaped var in `scripts/generate-env.js`'s `KEYS` must be
classified in `scripts/check-bundled-secrets.mjs` as `PUBLIC_BY_DESIGN` or
`ACCEPTED_FINDINGS`, or the build fails. The test is what a hostile holder
gains, not whether it can be extracted: `PUBLIC_BY_DESIGN` requires write-only
or identity-only, individually revocable, and rate-limited server-side; an
infrastructure credential never qualifies. Decisions:
`docs/bundled-credentials-decision.md`.

**Launch-argument auth is gated on the ARTIFACT, not the environment.**
`ALLOW_LAUNCH_ARG_AUTH` lets a build take a session from launch arguments, and
`MODE=release npm run android` resolves to a development `NODE_ENV` *and* signs
with the distribution key — so an environment test passes while the APK is one
you could hand to someone. `scripts/check-launch-arg-auth.mjs --platform
android --variant <name>` reads the variant's `signingConfig` out of
`build.gradle` and refuses anything not debug-signed; `run-android.sh` grants
the flag to `debug|localRelease` only, and both run-scripts invoke the gate on
the build path itself, not just in pre-push.

## Git & PR conventions

- Conventional Commits, enforced by commitlint (`commit-msg` hook). Hook
  matrix and PR guidance: `docs/development.md` § Git hooks +
  `CONTRIBUTING.md`.
- The API repo (`sous-chef-api`) is read-only from here: align the client to
  it, read it to verify contract constants, never edit it. After every
  codegen, read `sous-chef-api/docs/api/breaking-changes.md` — BEHAVIOUR
  entries have no SDL diff.
- Parallel sessions may share this checkout — touch only the files your task
  edits; no whole-tree git commands (`stash`, `reset --hard`, `checkout .`).

## Performance measurement

Every rule here was broken in one session (2026-08-25) and cost four reverted
changes. Measurement decides what to change; it is not the confirmation step.

- **A mechanism is not a cause.** Confirming in library source HOW something
  works says nothing about its SHARE of the time. Measure the share first.
- **Read a metric's definition before reasoning from its name.** The contract
  table is `docs/telemetry-setup.md` § Metric Reference, and
  `__tests__/telemetry/metricContracts.test.ts` keeps it complete.
  `app_zustand_hydration_ms` measured JS-entry → rehydrate (a module-evaluation
  window); the real hydration in it is ~5 ms. The name sent a whole pass after
  that 5 ms — it is now `app_js_entry_to_store_ready_ms`.
- **Numbers come from a release build; attribution may come from debug — never
  mix them in one comparison.** A debug build overstates mount/append cost, and
  in a debug bundle the FIRST heavy `require` after a timing mark absorbs
  ~200 ms that belongs to no module: move an unrelated import in front of it and
  the cost follows the position, not the module.
- **Emulator numbers understate hardware. Re-measure on a device before acting.**
  `flashlist_initial_load_ms` for the same screen: 40 ms emulator, 301–934 ms on
  an SM-S908U1.
- **An iOS simulator errs the OTHER way — it OVERSTATES.** It does not emulate a
  CPU; it runs arm64 natively on the Mac's cores. So an iOS-sim number beside an
  Android-device number compares two host machines, not two platforms. Compare
  iOS to iOS, build over build. iOS also has **no OS-side fully-drawn marker**
  (no API accepts an app-declared signal), so the two-method agreement that backs
  `app_fully_drawn_ms` on Android does not carry over —
  `scripts/ios-frame-sample.mjs` is the only cross-check there is.
- **A startup metric is BOUNDED, and the drop is counted.**
  `app_fully_drawn_ms` latches on the first instrumented list showing real
  content, and `HomeTabs` is lazy — only the Pantry tab mounts at cold start,
  so the other two lists can only latch after a navigation. Past
  `STARTUP_WINDOW_MS` (10 s, `startupProfiling.ts`, shared with the profiler's
  own fallback) nothing is emitted and `startup_window_exceeded_total`
  increments instead, so an EXCLUDED launch stays distinguishable from an
  unmeasured one. The bound is not defended by argument: a non-trivial rate on
  that counter is the evidence for changing it.
- **A metric's terminating condition reads the UN-SMOOTHED signal.** The
  pantry's skeletons pass through a 280 ms `useMinimumVisible` anti-flicker
  hold; reading it put that hold under `app_fully_drawn_ms` as a floor, so any
  improvement below 280 ms was structurally unmeasurable — the same defect as
  reading a threshold-gated `slow_*_total`. Measurement takes
  `initialSkeletons`, presentation keeps `showSkeletons`.
- **State the instrument's resolution.** A difference smaller than one sample is
  not a result — 450 ms screenshot sampling cannot resolve a 100 ms change, and a
  series that returns the same value for two different builds is not measuring
  them.
- **Run a control before believing an attribution.** Vary something you do NOT
  believe in. If the cost follows it, the attribution was positional.
- **Never read a performance value from a `slow_*_total` counter's labels.**
  They are threshold-gated and structurally cannot show the fast half of the
  distribution. Use the `_bucket`/`_sum`/`_count` histogram series.
- **Judge an intermittent mode against a distribution, not a handful of samples.**
  Per-session counters plus lingering series also make cross-session aggregation
  (`sum(...) by (screen)`) untrustworthy — read per session.

The protocol, the numbers and the retractions behind these rules lived in
`docs/audits/`, deleted in `8a7c8c76` — recover with
`git checkout 8a7c8c76^ -- docs/audits/` if you need the evidence. The rules
above stand on their own; treat every `app_fully_drawn_ms` figure recorded
before 2026-08-26 as invalid regardless, since it predates both the 280 ms
floor fix and the suppression fix.

## Verification

After code changes:

```bash
npm run typecheck && npm run lint && npm test
npm run check:compiler-bailouts && npm run check:unistyles-variants
```

`check-compiler-bailouts` guards a file COUNT; separately, WHICH function bails
where a variant call was deliberately extracted into a leaf; and separately
again, the `'use no memo'` opt-out list — now EMPTY, which makes it an
invariant rather than a tally: nobody should need the directive, so any entry
is a regression in the Babel plugin ordering.
`check-unistyles-variants` compiles each file to find a style read frozen at its
first-render value — a defect neither ESLint nor tsc can see, because it exists
only in the output of two Babel plugins composed in a particular order. Both run
in `pre-push` now, so neither depends on being remembered.
`check:version-sync` (pre-push) keeps `package.json` / `versionName` /
`MARKETING_VERSION` aligned — a drifted platform silently loses the
version-keyed cache purge and misreports `CLIENT_VERSION`; detail:
`docs/development.md` § Quality gates.

## Documentation index

`docs/README.md` is the index. Most used from here:
`docs/architecture.md` (structure, state, navigation) ·
`docs/apollo-client-patterns.md` (the Apollo deep dive) ·
`docs/local-first-architecture.md` (offline queue) ·
`docs/session-and-transport.md` (session end, tokens, WS close codes) ·
`docs/verified-library-behaviour.md` (the probe record) ·
`docs/development.md` (commands, testing, quality gates) ·
`docs/i18n-architecture.md` (translation architecture).
