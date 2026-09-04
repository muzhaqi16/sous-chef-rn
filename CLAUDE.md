# Sous Chef RN — project instructions

React Native 0.86 (New Architecture) · React 19.2 + React Compiler · Apollo
Client 4.2 (`dataMasking` on) + GraphQL codegen · Unistyles 3 · FlashList v2 ·
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
npm test             # full Jest suite — 668 files, 8060 tests, ~80s, ~3.3GB peak
                     # Workers are capped in jest.config.js; uncapped, nine of
                     # them exhaust 16GB of RAM. Run it unfiltered.
node scripts/check-compiler-bailouts.mjs         # also in pre-push
node scripts/check-unistyles-variant-staleness.mjs   # also in pre-push
node scripts/check-layer-purity.mjs              # also in pre-commit
node scripts/check-feature-shape.mjs             # also in pre-commit
node scripts/check-dead-modules.mjs              # also in pre-commit
node scripts/check-comment-budget.mjs            # also in pre-commit
node scripts/check-data-layer-boundary.mjs       # also in pre-commit
node scripts/check-hook-return-types.mjs         # also in pre-push
node scripts/check-import-cycles.mjs             # also in pre-push
node scripts/check-single-consumer.mjs           # also in pre-commit
node scripts/check-form-state.mjs                # also in pre-commit
node scripts/check-feature-enumeration.mjs       # also in pre-commit
node scripts/check-canonical-mechanisms.mjs      # also in pre-commit
node scripts/check-design-tokens.mjs             # also in pre-commit
node scripts/check-typography-roles.mjs          # also in pre-commit
node scripts/check-component-tier.mjs            # also in pre-commit
node scripts/check-screen-scaffold.mjs           # also in pre-commit
node scripts/check-a11y-names.mjs                # also in pre-commit
node scripts/check-dependency-audit.mjs          # also in PR checks + weekly
node scripts/check-bundled-secrets.mjs --self-test
```

Each of the twelve boundary gates takes `--list` (every finding), `--update`
(re-baseline) and `--self-test` (prove it can still fail). A NON-EMPTY baseline
is a debt list that may only shrink; an EMPTY one is an invariant, and any
finding there is a regression to fix:

| Gate | Holds | Baseline |
| --- | --- | --- |
| `check-data-layer-boundary` | a screen, sheet or cell may not run an operation, hold the client, or write the cache | 0 |
| `check-hook-return-types` | a feature hook's return type may not name the data library — its companion, since the screen imports nothing | 0 |
| `check-import-cycles` | no new LOAD-TIME import cycle; `import type` and `await import()` edges do not count | 0 |
| `check-single-consumer` | a module in `components`/`hooks`/`context`/`utils`/`constants` used by exactly one feature belongs to that feature | hard rule |
| `check-form-state` | a form holds its fields in react-hook-form, not `useState` | 70 |
| `check-feature-enumeration` | a feature id in a string outside its feature is a place the feature list has to be remembered | 0 |
| `check-canonical-mechanisms` | one mechanism per concern — the list primitive, the image component, the modal surface, the date formatter, device storage. The full concern table, gates included, is § One mechanism per concern | 0 |
| `check-design-tokens` | a visual property is a token, not a literal; a kit concept is not restyled in a feature | 0 failing / 9 colour + 162 icon-size tracked |
| `check-typography-roles` | text is set by a named role, not by size and weight | 21 |
| `check-component-tier` | a kit component sits in the tier its composition puts it in | 0 |
| `check-screen-scaffold` | a screen's chrome comes from `Screen`, and nobody applies the top inset twice | 4 chrome / 0 double-inset |
| `check-a11y-names` | a control with an `onPress` and no text child carries an `accessibilityLabel` | 0 |

When one reaches zero, promote it to a hard `import/no-restricted-paths` zone
and delete the baseline — the same promotion the kit half of
`check-layer-purity` already got.

`npm run lint` validates `.graphql` files against
`src/graphql/generated/schema.graphql` (`fields-on-correct-type` and
`no-deprecated` are errors), surfacing API drift at lint time instead of as a
codegen batch failure. The schema reaches the parser as
`parserOptions.graphQLConfig` — graphql-eslint@4 removed the flat `schema`
option and errors at PARSE time if it is still there, which reads as every
document failing rather than as a config problem. Pre-commit runs `lint-staged`
plus the five sub-second whole-tree checks; pre-push runs `typecheck`,
`check:compiler-bailouts`, `check:unistyles-variants`, `check:hook-return-types`
and `check:import-cycles` concurrently, then a codegen drift check — and skips
all of it for a tag-only push, which carries no new commits.
Full command reference: `docs/development.md`.

## Repository map & imports

Directory map and module walkthrough: `docs/architecture.md`. The short form:

- `src/features/<name>/` — the TWELVE feature modules (screens, hooks, graphql,
  context, utils) + `manifest.ts`. Auth and onboarding are features like any
  other; `src/screens/` holds only the two screens that belong to no feature
  (`SplashScreen`, `NotFoundScreen`).
- **Two registries, and the split is load-bearing.** `registry.ts` is the
  screen-bearing one navigation iterates; `registry.static.ts` is every feature
  as the APP SHELL sees it — i18n init, the cache, the offline queue — and it
  exists because those run on the LAUNCH path and importing the screen-bearing
  registry there pulls the whole component graph in with them. A feature that
  needs shell wiring adds a `manifest.static.ts`, not an import.
- `src/components/` — shared UI in four TIERS: `atoms/`, `molecules/`,
  `organisms/`, `templates/`, plus `providers/` and `performance/`. There is no
  `base/`, `charts/`, `modals/`, `navigation/` or `settings/`. A component's
  tier is computed from what it RENDERS, not chosen —
  `node scripts/check-component-tier.mjs` holds it, and
  `src/components/atoms/README.md` states the rule. Feature-private UI stays in
  `src/features/<name>/components/` (e.g. the pantry form lives in
  `src/features/pantry/components/form/`).
- `src/hooks/` and `src/components/` hold ONLY what more than one feature
  uses; a hook owned by one feature lives in that feature. Together they are
  the **kit** — the layer a sibling app reuses wholesale, so it must not import
  `#features/*`, own a `.graphql` document, or carry a file named after a
  domain. `node scripts/check-layer-purity.mjs` holds it: the baseline is EMPTY,
  which makes it an invariant rather than a debt — it went 76 → 0, so any entry
  is a regression to fix. Schema-type imports are counted, not failed. The same
  script also scans the **kernel** (`src/apollo/`, `src/store/`, `src/utils/`, …)
  for modules NAMED after a feature; that concern is at zero too. Only the name
  test runs there: the kernel's feature imports are load-bearing (offline queue,
  i18n bundling, the subscription layer) and are governed by the `.eslintrc.js`
  zone instead. Per-feature nav stacks are exempt by design.
- `src/features/catalog/` — the grocery `Item`, its pickers, and storage
  locations. The one feature with a PUBLIC component directory (`ui/`): its
  pickers are domain UI that two features consume, so they belong in neither a
  domain-free kit nor in one consumer. `components/` there is private as
  usual.
- `src/app/` — the composition root: the modules that exist to know the feature
  list (the provider mounting every feature's subscriptions, the offline tab
  preloader). Not kit, not reusable, and exempt from the rule above by design.
- `src/domain/` — domain logic SEVERAL features share: `dietary`, `nutrition`,
  `recipeTransform`, `pantryItemDuplicate`. The kit must stay domain-free and a
  feature's internals are closed to its siblings, so a module named after a
  domain concept and imported by three features had nowhere to live; it sat in
  `utils/` and `constants/` reading as kernel. Same reasoning as `catalog/ui/`,
  one level up. Admission is by CONSUMER COUNT: two or more features, or it
  belongs in the one that uses it.
- `src/components/templates/` — the page-level scaffolding every screen is
  built from: `Screen` (chrome, scroll mode, gutter, state), `Sheet` (the bottom
  sheet shell) and `FormScreen`. A screen does not assemble its own header, and
  `node scripts/check-screen-scaffold.mjs` holds that.
- `src/apollo/` client, links, offline queue, cache persistence ·
  `src/store/` Zustand slices + reset manager · `src/i18n/` config + locales ·
  `src/services/`, `src/navigation/`, `src/theme/`, `src/utils/`.

**Import aliases** — `tsconfig.json` `paths` is the SINGLE source. `babel.config.js`
and `jest.config.js` derive theirs from it through `scripts/lib/aliases.js`, and
ESLint reads it via `import/resolver.typescript`. There used to be three
hand-maintained lists with three different matching semantics (32 / 25 / 19
entries) and nothing checking them against each other, so an alias added to
`tsconfig` type-checked but failed to resolve at runtime. Add an alias in ONE
place. Every top-level `src/` folder has
a `#<name>` alias (`#components`, `#features`, `#hooks`, `#store`, …); the
irregular ones are `#/*` → `src/*`, `#operations` → `src/graphql/operations`
(preferred for operation imports), `#generated` → `src/graphql/generated`, and
`#/test-utils/*` → `__tests__/helpers/*`. Use aliases over relative paths.

**No dead modules.** A module under `src/` with no PRODUCTION importer fails
`node scripts/check-dead-modules.mjs`. An import inside a test does not count,
and neither does a `jest.mock()` — a test for dead code is dead with it, so
delete both. The baseline is empty and stays empty. A module reached some other
way (Detox reaches components by testID string, never by import) is covered by
`__tests__/harness/e2eTestIdsExist.test.ts`.

**Feature shape** — every feature has `manifest.ts` (its `id` equals the
directory name), `screens/`, `hooks/` and `components/`, and one with more than
one screen declares `screens/registration.ts`. Ratcheted by
`node scripts/check-feature-shape.mjs`, whose baseline is also EMPTY — every
feature has the same shape. A `.graphql` document beside its consumer is the
convention, NOT a deviation.

**Feature API boundary** — public surface of a feature: `screens/`,
`manifest.ts`, top-level `hooks/` files, and `<feature>Fragments.generated.ts`
type imports. Everything deeper (`graphql/`, `context/`, `hooks/mutations/`,
`utils/`) is internal. Enforced in BOTH directions (feature → feature, shared
layer → feature) by `import/no-restricted-paths` zones in `.eslintrc.js`;
tests are exempt. Canonical table and the deliberate `graphql/` asymmetry:
`docs/architecture.md` § The public API boundary.

## State ownership

**A feature may own its own store.** `src/features/notifications/store/` is the
worked example: state nothing else reads lives with its feature rather than as a
root slice. The catch is that `SESSION_SCOPED_STATE` only reaches the ROOT store,
so a feature store MUST call `registerSessionScopedStore(name, reset)` — that is
how `recipe-search-cache` and `recipe-suggestions-cache` came to survive a
sign-out unnoticed. `sessionEndLeavesNoData.test.ts` asserts a populated feature
store is emptied by `LOGOUT`.

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

## Comments

A comment earns its place only when the code cannot say it: a library gotcha,
an invariant a future edit would silently break, a "this looks wrong and is
deliberate" note. That fits in **one to three lines**. Rationale, evidence and
alternatives-considered belong in the PR or `docs/`; what the code used to do
belongs in git.

- **Present tense, current behaviour only.** No "previously", "used to", "old
  behavior", "was tried", "regressed", "formerly", "no longer". A comment
  narrating a fix outlives the fix and then lies — a sweep found 37 wrong ones,
  including a block describing the exact bug the code beneath it had removed.
  This is a LINT ERROR (`no-warning-comments`), so your editor catches it. In a
  TEST, keep the defect the case pins — just state it in the present: "the chips
  used to size to their labels" becomes "a chip sizes to the row, not its
  label".
- **No comment run longer than six lines.** A `/** … */` counts its `/**` and
  `*/`, and an internal blank ` *` line does not split the run, so that is four
  lines of prose.
- **No file whose comments exceed half its code** (files of 60+ code lines).
- Don't restate the identifier (`/** Props for the FooCard component */`), and
  don't write `@param`/`@returns` that repeat the TypeScript signature. No
  `@example` blocks for internal helpers.
- **Attach a doc to the thing it documents.** Eleven orphaned JSDoc blocks were
  found stacked above a *different* declaration than the one they described,
  one of them 350 lines away. Use `{@link other}` instead of "the function
  above/below", which goes stale on a reorder.

Two enforcers, split by what they can see. **Vocabulary** is
`no-warning-comments` in `.eslintrc.js` — an error, so it lands in the editor —
covering `src/**` and `__tests__/**`, tests included. **Volume** is
`node scripts/check-comment-budget.mjs` (pre-commit and CI) over production
`src` only, since a test comment explaining why a case exists is worth its
length; its baseline is EMPTY, so any finding is a regression. Tool directives —
`@ts-expect-error`, generated-file banners, `@deprecated`, `@internal` — are
never counted and never removed. `scripts/`, the root config files and
`.graphql` are outside the vocabulary rule: each has a phrase it would flag
wrongly.

## GraphQL & Apollo

### The data layer stays out of what renders

**A screen, sheet or list cell gets its data from a hook in its feature's
`hooks/`.** It does not import `#/apollo/*`, hold the client, or write the
cache. Two invariants hold the seam and neither can see what the other does:
`import/no-restricted-paths` bans the `src/apollo/**` import (with
`alertRejectedMutation` exempt — it lives there by location but resolves
localized refusal copy, which is presentation), and
`node scripts/check-hook-return-types.mjs` reads what a hook HANDS BACK, since
a leaked `ApolloError` or `NetworkStatus` couples a screen that imports
nothing. A mutate wrapper returns `MutationOutcome<TData>`
(`src/utils/errors/mutationOutcome.ts`), never Apollo's own result generic.

A hook returns plain values and callbacks: `loading` as a boolean, an outcome
the caller branches on, named functions. `useFragment` and the masking types
stay allowed in a cell — with `dataMasking` on, a cell subscribing to one
entity is the documented pattern.

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
| `refetchQueries` (last resort)                | Query shape underivable from the response                           | `useHomeSubscriptions`, `usePantryItemDetailActions`                      |

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
- **Pass the caller's copy INTO `localizedErrorMessage`, never after it.**
  `localizedErrorMessage(err) || t('…')` type-checks and reads as a fallback,
  and is unreachable: the resolver is total. It also disables the resolver's own
  escape hatch, which yields to the caller's copy on a TRANSPORT code — so a
  write that never left the device got reported with the read-oriented offline
  sentence. Guarded by
  `__tests__/i18n/callerFallbackReachesResolver.test.ts`.
- **A field with a write-time invariant is written through the ONE path that
  runs it.** `cache.modify` does not run type-policy merges and cannot introduce
  a field the cached record lacks, so a record whose rules live in a merge policy
  (`ShoppingListItem.purchaseInfo`) must go through `cache.writeFragment` —
  `writePurchaseInfo` is the worked example, and it carries the cached record
  forward so the policy's clear-on-flip has nothing to clear on a LOCAL write.
  A second writer of such a field (the offline restoration pass) routes through
  `src/apollo/utils/fieldWriters.ts` rather than merging blind.
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

- **Gate a screen on "is there anything to show", NEVER on `loading` alone.**
  Under that default `loading` is `true` on the FIRST result whatever the cache
  holds — Apollo hard-codes it for `cache-and-network` — and `nextFetchPolicy`
  lives on the ObservableQuery, which `useQuery` rebuilds per mount, so it never
  survives a navigation and every visit is a fresh network leg.
  `notifyOnNetworkStatusChange: false` changes neither. So `if (loading)` blanks
  the screen for the whole request on every visit, which against a stalled API
  is httpLink's 10s abort (`Environment.getApiConfig().timeout`) and up to ~30s
  across `retryLink`'s three attempts. Write `loading && !data`, as
  `ProfileScreen` does. When the hook's value is always defined because it fills
  in defaults (`useAppSettings`, `useNotificationSettings`) it cannot answer the
  question — return a separate `hasLoadedSettings` / `hasPreferences` flag.
  And keep the loading branch INSIDE the screen's header wrapper: rendered
  outside `ProfileScreenWrapper` it has no back button, so the screen cannot be
  left while it waits.
- **`returnPartialData: false` makes `!data` mean "the cache read was
  INCOMPLETE"** — one missing field of the selection yields no data at all, not
  a partial object. Hence the completeness invariant: every writer of an entity
  writes the full shape the reading query selects. `GetUserProfile` reads 12
  profile fields and `LoginUser` / `PartialUser` / `UserEvents` each write the
  same 12; `__tests__/apollo/userProfileCompleteness.test.ts` fails if one
  drifts. Verified 2026-08-30 vs `@apollo/client@4.2.12` — re-check:
  `node scripts/probe-apollo-loading-on-mount.mjs`; mechanism:
  `docs/verified-library-behaviour.md#apollo-reports-loading-true-on-every-mount-warm-cache-or-not`.

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
- Both transports can rotate tokens. `AUTH_REFRESH_TOKEN_SUPERSEDED` ≠
  `AUTH_REFRESH_TOKEN_INVALID` — never sign out on the first. Retry a lost
  rotation **only once a different token is stored**
  (`retryWithSuccessorToken` in `src/apollo/links/refreshToken.ts`);
  re-presenting a spent token past the ten-second replay window revokes the
  whole lineage.
- **Only ONE transport presents the refresh token at a time.** The socket's
  `connectionParams` withholds it while an HTTP refresh is in flight
  (`registerRefreshInFlightCheck`); the losing rotation is recoverable but costs
  a round trip and a superseded rotation in the server's log every time.
- **Never send a request on an access token that has already expired.**
  `isTokenExpiringSoon(token, 5min)` is true both for a token with four minutes
  left and for one that died an hour ago; `authLink` must separate them —
  refresh AHEAD for the first, `await proactiveTokenRefresh()` for the second.
  Collapsing them is how six concurrent operations came to present the same dead
  JWT and draw six rotations between them. The refresh is single-flight
  (`refreshState` + `refreshQueue`); the REQUESTS have to be gated on it too.
- **A password being SET goes through `newPasswordRule`, not `passwordRule`**
  (`src/utils/validation/common.ts`), and each rule mirrors the server exactly.
  SETTING one (register, reset, change) is 8–72 characters with a lowercase
  letter, an uppercase letter and a digit — worth checking locally, since a
  doomed round trip spends the rate budget and comes back as an unlocalizable
  English `message`. SIGNING IN reads back a password the account ALREADY has,
  and the server asserts only that it is non-empty, so `passwordRule` asserts
  only that too: any extra rule there refuses a real password, and the reset
  flow needs the account it cannot reach. `auth.test.ts` § "the password policy
  for a password being SET" pins both halves.
- A session end must DROP the socket client, not just dispose it — graphql-ws's
  `dispose()` is a one-way latch (`disposeWebSocket()` clears the reference).
  Do not add a second reconnect or backoff loop beside graphql-ws's own;
  pacing goes in `url()`, not `retryWait`.

## UI layer

### One mechanism per concern

Each row is a concern the app solved ONCE. An alternative is not a style
difference — it loses what the canonical path already handles (a theme that
follows the colour scheme, a locale that follows the language, a scroll
container that arbitrates gestures, a key the session reset can find). The
"Held by" column is what fails when you reach past it; a rule with no gate is
one nobody has been able to express yet, not one that is optional.

| Concern | Mechanism | Held by |
| --- | --- | --- |
| A list that can grow | `FlashList`, with an explicit `renderScrollComponent` | `check-canonical-mechanisms` · `flashListScrollComponents.test.ts` |
| A remote image | `CachedImage` (`LocalImage` for a file or bundled asset) | `check-canonical-mechanisms` |
| A modal surface | `BottomSheetModal` via `useStandardBottomSheet`, or `alertService` | `check-canonical-mechanisms` · `no-restricted-syntax` bans `present()`/`dismiss()` |
| Rendering a date | the shared formatters in `src/utils` (`formatters/date`, `dateUtils`) | `check-canonical-mechanisms` |
| Device storage | a persisted slice of the Zustand store | `check-canonical-mechanisms` · `no-restricted-imports` on `#storage/mmkv` |
| A screen's chrome | `Screen` (`#components/templates/Screen`) | `check-screen-scaffold` |
| A sheet's shell | `Sheet` (`#components/templates/Sheet`) | `bottomSheetShell.test.ts` |
| A loading indicator | `Loading` / `LoadingBranded` (`#components/molecules/Loading`) | `check-canonical-mechanisms` |
| A toast | `toastService` — in and out of the React tree alike | `no-restricted-syntax` on its arguments |
| Navigating | `useAppNavigation` | `no-restricted-imports` on `useNavigation` |
| Setting text | a typography ROLE (`<Text role="body">`) | `check-typography-roles` |
| A colour, radius, z-index or spacing step | a `theme.*` token | `check-design-tokens` |
| Elevation | a step of `theme.shadows` | `check-design-tokens` |
| A duration, spring or curve | `theme.motion` | `check-design-tokens` (at or below the 300 ms scale ceiling; above it is a loop's own period) |
| A form's fields | react-hook-form + a yup schema beside the form | `check-form-state` |
| Searching a loaded list | `filterByTerm` / `useLocalSearch` (`#hooks/search/useLocalSearch`) | `check-canonical-mechanisms` |
| Reduce motion | nothing — Reanimated applies it itself | `no-restricted-imports` on `useReducedMotion` · `probe-reanimated-reduce-motion.mjs` |
| Memoization | nothing — the React Compiler does it | `check-compiler-bailouts` |
| A shared actions bag | `createActionsContext` | — (no gate: a context holding callbacks is not distinguishable from any other context by shape) |
| Where a value lives | Apollo if the server owns it, else a Zustand slice; a context only for what a subtree passes down | — (no gate: the choice is not visible at any one call site — `check-single-consumer` catches a context only one feature reaches, which is a different question) |

When a gate's baseline reaches zero, promote it to an
`import/no-restricted-paths` or `no-restricted-imports` zone and delete the
baseline — the same promotion the kit half of `check-layer-purity` already got.

### Screen scaffold and sheet shell

- **A screen's chrome is `Screen`** (`src/components/templates/Screen.tsx`):
  `header` (`standard | tab | collapsing | none`, plus title, actions, back,
  close, offline pill), `scroll` (`none | scroll | form | list`), `gutter`,
  `refresh` and `state`. It NEVER applies the top inset — the navigator does,
  and a screen adding its own is the `double-inset` half of
  `node scripts/check-screen-scaffold.mjs`. A bare `<SafeAreaView>` (no `edges`)
  insets all four sides and is the usual way that happens.
- **A sheet's shell is `Sheet`** (`src/components/templates/Sheet.tsx`):
  `view | form | action | list`. `form` supplies both the keyboard offset and
  the input context, so inputs inside resolve to gorhom's
  `BottomSheetTextInput`. **A sheet holding a scrollable that fills its parent
  uses `list`**, which hands the child to the modal: `BottomSheetView` (what
  `view` renders) is absolutely positioned with no height, so a `flex: 1` list
  inside it sizes to its own content and never scrolls.
  `__tests__/ui/viewSheetScrollableIsBounded.test.ts` holds that.
- **A full-screen form is `FormScreen`, not a sheet.** It is a screen with a
  form's chrome; the name is the only thing it shares with a modal.

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

### Typography roles

- **Text is set by a ROLE, never by size and weight.** The nine roles live in
  `src/theme/foundations/type.ts` (`display`, `title`, `subheading`, `heading`,
  `body`, `bodyStrong`, `caption`, `label`, `error`) and each carries size,
  weight, leading and tracking together — and only those: **colour is `tone`'s
  job**, so `role="error"` pairs with `tone="error"`. `<Text role="caption">`,
  never `<Text size="sm">`. An element that cannot take the prop (a
  `TextInput`, a shared style module) spreads `...theme.type.<role>`.
  `role` shadows RN's ARIA-style `role`; `accessibilityRole` is the spelling
  this tree uses.
- `size`, `weight` and `lineHeight` remain on `Text` as **kit-only escape
  hatches** — a breakpoint-mapped label, a 13px inset header. Outside
  `src/components/**` they are a second definition of a role that exists.
- **The font-scale ceiling is global.** The OS text size multiplies on top of
  the app's own 0.9–1.3 preference, which is already baked into the theme's
  numbers, so `theme.maxFontScaleMultiplier` is the remainder of `MAX_FONT_SCALE`
  and the `Text` atom applies it. `maxFontSizeMultiplier` and
  `allowFontScaling={false}` are `no-restricted-syntax` errors.
- `node scripts/check-typography-roles.mjs` holds both halves. `off-role-text`
  is at ZERO — every `<Text>` outside the kit names a role, so any finding is a
  regression. `stylesheet-type` is a shrinking baseline of 21: the blocks whose
  type no role expresses (a responsive size map, a 10px badge, a Skia draw
  call).

### Elevation & on-fill colour

- **Elevation is `theme.shadows`, and the ramp is PER THEME** — the geometry is
  shared, the ink is not: a 4%-black shadow is invisible on charcoal, so
  `darkShadows` keeps the offsets and deepens the opacity. `src/theme/foundations/shadows.ts`
  is the only place a `boxShadow` geometry is written; a call site spreads a step
  (`...theme.shadows.md`). The exceptions are shadows whose COLOUR is the point —
  the FAB's brand glow, the scanner's scan-line glow, `commonStyles.shadow`'s
  primary tint — which no neutral step can express.
- **Text or an icon on a fill reads that fill's `on*` token**, never a
  hardcoded white: the fill is user-overridable and the foreground follows its
  luminance. `onScrim` is the role for a ground the theme does NOT paint — over
  a photo, a camera preview, a dark overlay — and stays light in both
  appearances. There is no `colors.white`.
  `__tests__/ui/onFillTextUsesItsToken.test.ts` catches a raw literal, an `on*`
  token over a fill it does not name, and a locally overridden shared fill.
- `src/theme/__tests__/foundations.test.ts` asserts light and dark declare the
  same colour, shadow and motion keys — a token defined in one theme only is
  invisible until someone switches appearance, and then the style silently
  drops.

### Motion

- **Durations, springs and curves are `theme.motion`** — the foundation is
  `src/theme/foundations/motion.ts`, read as `theme.motion.timing.FAST` in a
  stylesheet and as `motion.timing.FAST` from the module elsewhere. The scale
  stops at 300 ms; a longer number is a LOOP's own period (a 1500 ms shimmer, a
  1200 ms bob) and stays a literal at its call site rather than becoming a token
  one animation uses.
- **Never branch an animation on reduce motion.** `withTiming`, `withSpring`,
  `withRepeat` and the entering/exiting builders already collapse under the OS
  setting with no config. `useMotionEnabled()`
  (`src/hooks/animations/useMotionEnabled.ts`) is the ONE `useReducedMotion`
  read, and only for what a zero duration cannot stop — a loop's resting state,
  an ambient illustration. A `no-restricted-imports` entry holds that, with
  `useMotionEnabled` as its single exemption; the theme carries no zeroed
  motion twin, because the library needs none. Verified 2026-09-03 vs
  `react-native-reanimated@4.6.0` — re-check:
  `node scripts/probe-reanimated-reduce-motion.mjs`; mechanism:
  `docs/verified-library-behaviour.md#reanimated-applies-reduce-motion-itself`.

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
  **A settled EMPTY list releases on `rowCount: 0`, not on a commit**: FlashList
  commits once for data that goes empty to empty, that commit lands while the
  skeletons are still up, and the placeholder guard discards it — so the list
  with no rows to reveal was the one that waited forever.
  Verified 2026-08-26 vs `@shopify/flash-list@2.3.2`, on-device evidence:
  `docs/verified-library-behaviour.md#flashlist-v2-first-layout-opacity-gate`.
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
  Current assignments: `grep -rn "localFirst" src/features/catalog/hooks`.
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

### Row actions

- **A swipeable row takes `leftActions` / `rightActions`, never named verbs.**
  `SwipeAction` (`src/components/molecules/SwipeableItem/types.ts`) is
  `{ key, icon, labelKey, onPress, haptic?, removesRow? }`; the same descriptors
  flow through `BaseItemCard`, `ItemCard` and `ItemList`. `key` doubles as the
  accessibility action name, so a swipe action and its VoiceOver/TalkBack
  equivalent cannot drift apart, and `testID` defaults to
  `${testIDPrefix}-${key}`.
- Edit and delete are the only universal verbs and have builders in
  `SwipeableItem/commonActions.ts`. Anything domain-flavoured belongs to its
  feature — see `src/features/pantry/components/pantrySwipeActions.ts`.
- `removesRow: true` tells the row renderer to slide out and to call
  FlashList's `prepareForLayoutAnimationRender()` first. `SwipeableItem` itself
  ignores it — the swipe molecule has no opinion about the list around it.

### Dynamic forms

- **`DynamicFormFields` renders a `component` NAME through a registry**, not a
  closed union. The app supplies the registry once at the composition root
  (`FieldRendererProvider` in `App.tsx`, fed by
  `src/features/catalog/ui/catalogFieldRenderers.tsx`); field-specific callbacks
  travel in the field's `props` bag, which the form forwards without reading.
  An entry sets `ownsErrorDisplay` when it renders its own validation message.

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

- **Never write `useMemo` / `useCallback` / `React.memo`** — the compiler
  memoizes, the lint rule is an error, and there is no way to opt out:
  `eslint-comments/no-use` bans every `eslint-disable` directive repo-wide, so a
  disable comment is itself an error. The bailout baseline
  (`scripts/check-compiler-bailouts.baseline.json`) is empty — a file appearing
  there is a regression to fix, not a licence to memoize.
  Where a stable reference is genuinely needed for a **dependency array**, hoist
  the function to module scope and pass what it needs as arguments — see
  `syncAsAccountDefault` in `src/features/home/hooks/useDefaultHome.ts`.
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

- **A feature owns its copy.** `src/features/<name>/locales/{en,es,it,sq}.json`
  holds that feature's namespaces; `src/i18n/locales/` holds only what is shared
  (`errors`, `labels`, `empty`, `auth`, `navigation`, …). They are merged at
  init by `src/i18n/featureLocales.ts`, which imports the JSON DIRECTLY rather
  than through `FEATURE_REGISTRY` — the registry pulls in every screen, and
  `i18n/config` is imported near the top of `index.js`. Adding a feature's
  locales means one entry there; `scripts/check-i18n.mjs` and
  `#/test-utils/mergedLocales` walk the merged tree, so a gate that read only
  the core file would silently check a third of the copy.
- **The product name is `{{appName}}`, never typed into a translation** — fed by
  `interpolation.defaultVariables` from `appConfig.identity.displayName`. It was
  literal in six strings per locale, so a rebrand meant editing all four files
  and hoping none was missed. `__tests__/i18n/appNameInterpolation.test.ts`
  fails on a re-introduced literal AND on a `{{appName}}` that renders raw.
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
  lacks. Verified 2026-08-30 vs `i18next@26.4.0` — a missing category falls
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
  `#/test-utils/apolloMockProvider`** — the PRODUCTION cache (`makeCache()`,
  so type policies and `possibleTypes` are loaded) plus schema-driven network
  mocks and type-safe mocks. `jest.mock('@apollo/client/react', …)` is
  lint-banned: it couples tests to operation names and bypasses the cache
  integration the tests exist to catch. Import `MockedResponse` from the
  helper, not `@apollo/client/testing`.
- For mutation tests, assert on the **cache** after the mutation, not on the
  mock function.
- A failing mutation RESOLVES (`errorPolicy: 'all'`) — drive failures with an
  operation mock carrying an `error`, never by stubbing a helper to throw.
- **Pick ONE mocking strategy**: `operationMocks` OR `mocks`/`resolvers`, never
  both — they are mutually exclusive by type, and combining them used to
  discard the second silently. `operationMocks: []` means "no per-operation
  mocks", not "answer everything from the schema".
- A per-operation mock's `data` is COMPLETED from the real SDL before it is
  served, so state only what you assert on. A field you write as `undefined` is
  served ABSENT, and a field the operation does not select is an error — a
  fixture the schema cannot produce is a test of a system that does not exist.
  The one opt-out is `partial: true` on the mock, which excuses exactly the
  fields that payload omits.
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
  it, read it to verify contract constants, never edit it.
- **After every codegen, diff `src/graphql/generated/schema.graphql`.** It is
  tracked, `npm run codegen` re-pulls the live SDL, and the pre-push check
  refuses a stale one — so a server change lands in YOUR branch, mixed into
  whatever you were doing. Read it before committing and give it its own
  commit; a removed field or a narrowed meaning is the client's problem to
  find. This instruction used to name `sous-chef-api/docs/api/breaking-changes.md`
  as the place to check instead. That file is GONE — the API deleted the log,
  its `.schema-breaking-allow` and the `schema-breaking-changes.mjs` linter
  together — so there is no longer a published record of BEHAVIOUR changes,
  the ones that never show up as an SDL diff at all. The doc comments in the
  SDL are what remain: they are prose, they do change, and a diff that looks
  like documentation can be a contract change (`summary.skipped` was
  redefined that way on 2026-08-29 with no signature change).
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
- **Match the instrument to the symptom, or you will fix the wrong thing.**
  HITCHING (occasional long frames) is a re-render problem — read React commit
  counts, or `flashlist_data_reference_changes`. A FRAME-RATE CEILING (every
  frame uniformly over budget) is not; read
  `adb shell dumpsys gfxinfo <pkg> framestats` on a DEVICE and decompose per
  phase. On the pantry the UI thread — where per-row view count and Yoga layout
  live — is 1.5 ms of a 17 ms frame, so "reduce views per row" measured out
  false while React-render reasoning pointed the same wrong way. Emulator frame
  stats cannot be used at all: its software GPU alone takes 16-20 ms per frame.
- **Check the panel's refresh rate before calling a frame slow.**
  `dumpsys display | grep mActiveModeId` → the mode's `vsyncRate`. The
  SM-S908U1 runs at 96 Hz, so the budget is 10.4 ms, not 16.7 ms.

Audit write-ups are scratch and untracked (`.gitignore`), so each rule above
carries its own number and stands on its own. Treat every `app_fully_drawn_ms`
figure recorded before 2026-08-26 as invalid: it predates both the 280 ms floor
fix and the suppression fix.

## Verification

After code changes:

```bash
npm run typecheck && npm run lint && npm test
npm run check:compiler-bailouts && npm run check:unistyles-variants
npm run check:layer-purity && npm run check:feature-shape
npm run check:dead-modules
npm run check:comment-budget
npm run check:data-layer-boundary && npm run check:hook-return-types
npm run check:import-cycles
npm run check:single-consumer
npm run check:form-state && npm run check:feature-enumeration
npm run check:canonical-mechanisms && npm run check:design-tokens
npm run check:typography-roles
npm run check:component-tier && npm run check:screen-scaffold
npm run check:a11y-names
npm run check:dependency-audit
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
