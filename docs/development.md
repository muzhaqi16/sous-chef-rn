# Development

Setup, commands, build variants, and the quality gates. For contribution terms
and PR etiquette see [`CONTRIBUTING.md`](../CONTRIBUTING.md); for how the code is
organized see [`architecture.md`](architecture.md).

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment files](#environment-files)
- [Running the app](#running-the-app)
- [GraphQL codegen](#graphql-codegen)
- [Testing](#testing)
- [Quality gates](#quality-gates)
- [Releases](#releases)
- [Command reference](#command-reference)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js `>= 22.11.0`**
- A working React Native environment for
  [Android](https://reactnative.dev/docs/set-up-your-environment?platform=android)
  and/or [iOS](https://reactnative.dev/docs/set-up-your-environment?platform=ios)
  (iOS requires macOS with Xcode and CocoaPods)
- A running Sous Chef GraphQL API for anything beyond building. Without a
  backend you can still install, build, typecheck, lint, and run the unit tests.

## Setup

```bash
git clone https://github.com/muzhaqi16/sous-chef-rn.git
cd sous-chef-rn
npm install            # runs patch-package + generates src/config/env.generated.ts
cp .env.example .env   # fill in your values
npm run codegen        # generate GraphQL types from the schema
```

`postinstall` runs `patch-package` and `scripts/generate-env.js`, which turns
your `.env` into `src/config/env.generated.ts`. If you edit `.env`, re-run:

```bash
npm run genenv
```

---

## Environment files

`.env.example` documents every variable. The essentials:

| Variable | Purpose |
| --- | --- |
| `API_URL` | GraphQL HTTP endpoint (default local: `http://localhost:4000/graphql`) |
| `WEB_SOCKET_URL` | GraphQL WebSocket endpoint for subscriptions |
| `API_KEY` | Backend API key |
| `NODE_ENV` | `development` · `staging` · `production` |
| `WEB_APP_URL` | Used for deep links and redirects |
| `SPOONACULAR_API_KEY` | Recipe search and nutrition data |
| `OTLP_METRICS_*`, `OTLP_LOGS_*` | Optional telemetry — see [`telemetry-setup.md`](telemetry-setup.md) |

Per-variant files (`.env`, `.env.staging`, `.env.production`) are selected by
the build scripts. Never commit a file with real credentials.

---

## Running the app

```bash
npm start          # Metro bundler
npm run ios        # iOS simulator
npm run android    # Android device or emulator
```

### iOS variants

```bash
npm run ios        # SousChefRN                (uses .env)
npm run ios:stg    # SousChefRN (Staging)      (uses .env.staging)
npm run ios:prod   # SousChefRN (Production)   (uses .env.production)
```

### Android variants

Android builds go through `scripts/run-android.sh`, driven by two environment
variables:

- **`MODE`** — `debug` (default) · `staging` · `production` · `release` ·
  `localRelease`. `staging` and `production` select `.env.staging` /
  `.env.production` automatically; the rest fall through to `.env`. An `ENVFILE`
  you set yourself always wins.
- **`TARGET`** / **`DEVICE_ID`** — which device(s) to install to (see
  `scripts/android-target.sh`).

```bash
npm run android                  # MODE=debug
npm run android:stg              # MODE=staging
npm run android:prod             # MODE=production
npm run android:release          # MODE=release
npm run android:local-release    # MODE=localRelease
npm run android:all              # TARGET=all — every connected device
npm run android:emulator
npm run android:phone
```

Any combination works directly:

```bash
MODE=staging TARGET=all npm run android
MODE=release DEVICE_ID=emulator-5554 npm run android
```

The script sets up an `adb reverse tcp:4000 tcp:4000` tunnel before launching,
so a debug build reaches an API running on your machine.

**`release` and `staging` are built by CI, not locally.** They are produced by
`build-android.yml`, which writes the signing key and the env file from repository
secrets. Locally you build `debug`, `staging`/`production` (debug builds against a
deployed API), or `localRelease`.

**`localRelease` is the release-shaped local build.** Minified, Hermes bytecode,
`initWith release`, and debug-signed on purpose — which is what lets it build
with no upload key, and what earns it `ALLOW_LAUNCH_ARG_AUTH`
(`scripts/check-launch-arg-auth.mjs` enforces both halves). Use it for any
measurement or profiling run.

**Signing fails closed.** `release` and `staging` need all four of
`MYAPP_UPLOAD_STORE_FILE`, `MYAPP_UPLOAD_STORE_PASSWORD`, `MYAPP_UPLOAD_KEY_ALIAS`
and `MYAPP_UPLOAD_KEY_PASSWORD`; without them the Gradle build **fails** instead
of falling back to the committed `debug.keystore`. Since those variants only ever
build in CI, the case this guards is a CI one: a secret that is renamed, rotated
away, or missing from a newly added environment would otherwise produce a
debug-signed artifact that looks like a release and is updatable by anyone
holding the public debug key. It fails the workflow instead.

### Android device helpers

```bash
npm run adb:devices      # list connected devices
npm run adb:gql          # set up the adb reverse tunnel manually
npm run adb:gql:clear    # tear it down
npm run adb:log          # ReactNative / ReactNativeJS logcat
npm run adb:log:app      # crashes and errors only
npm run adb:kill         # restart the adb server
```

More detail: [`android-build-setup.md`](android-build-setup.md),
[`android-devices-readme.md`](android-devices-readme.md).

---

## GraphQL codegen

Run after **any** `.graphql` change and whenever the backend schema moves:

```bash
npm run codegen
```

Three steps run in order:

1. `codegen:schema` — pulls the schema into `src/graphql/generated/schema.graphql`
2. `graphql-codegen` — emits `*.generated.ts` next to each operation file
3. `codegen:manifest` — regenerates `persisted-query-manifest.json`

Generated files are **committed**. The pre-push hook re-runs codegen and fails
if your committed copies are stale.

```bash
npm run codegen:watch          # regenerate on change while developing
npm run check:codegen-orphans  # find .generated.ts files with no source .graphql
npm run audit:fragments        # report fragment inlining
```

`npm run lint` validates every `.graphql` operation against the pulled schema
(`fields-on-correct-type` and `no-deprecated` are both errors), which surfaces
API drift one file at a time instead of as a surprise codegen batch failure. It
reads the checked-in schema, so run `codegen` first if yours is stale.

---

## Testing

### Unit and integration

```bash
npm test                                    # full Jest suite
npm run test:changed                        # only what changed vs main
npx jest --findRelatedTests path/to/File.ts # what a specific file affects
```

Apollo-touching tests must use `renderHookWithApollo` / `renderWithApollo` from
`__tests__/helpers/apolloMockProvider.tsx`. Two layers, and a description has
to say which is which — crediting one's fidelity to the other is how a bare
cache went unnoticed under 143 files. The NETWORK is schema-driven: an
executable schema built from the real SDL, mocked by `addMocksToSchema`. The
CACHE is the production one — `makeCache()`, so type policies, merge and read
functions and `possibleTypes` are all loaded, and a test reads through the same
rules the app does. Mocking `@apollo/client/react` directly is banned by lint:
it couples tests to operation names and bypasses the very cache integration the
tests exist to catch. Helper shortcuts: `recordMock()` to capture the variables
Apollo actually observed, `seedCache()` to pre-write entities that hooks read
with `cache.readFragment`.

The default is kept by `node scripts/check-test-cache-fidelity.mjs` (pre-commit),
not by a test. It identifies its subjects by IMPORT rather than by grepping for
two helper names, enumerates files the way Jest's `testMatch` does, and fails
when its own scan matches nothing — the three ways the previous in-suite check
could have been silently vacuous. Only the two behavioural assertions remain in
`__tests__/apollo/testCacheIsTheProductionCache.test.ts`.

Shared auto-mocks live in `__mocks__/` folders next to their modules
(`Environment`, `logger`, MMKV storage, navigation hooks, token scheduler, …) —
override per-suite with `mockReturnValue` rather than replacing the module.

### Apollo testing patterns

The rules are summarized in CLAUDE.md § Testing; this is the full pattern set.

```ts
// ✅ Correct — production cache + schema-driven network mocks, type-safe
//
// Import `MockedResponse` from the helper, NOT from '@apollo/client/testing'
// (the flat import there is deprecated; the helper re-exports the canonical
// MockLink.MockedResponse type).
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';

const operationMocks: MockedResponse[] = [
  {
    request: { query: GetItemDoc, variables: { id: '1' } },
    result: { data: { item: { __typename: 'Item', id: '1', name: 'A' } } },
  },
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

- **`operationMocks: MockedResponse[]`** — explicit per-operation
  request/response pairs (preferred for assertions on exact data flow)
- **`mocks` + `resolvers`** — schema-driven auto-mocks via
  `@graphql-tools/mock` (preferred for setup-heavy tests where exact shapes
  don't matter)

For mutation tests: assert on the cache after the mutation, not on the mock
function. The whole point is exercising the cache update path the production
code relies on.

**Gotchas:**

1. **A failing mutation RESOLVES; it does not throw.** Both production
   (`src/apollo/client.ts`) and the shared `apolloMockProvider` set
   `mutate: { errorPolicy: 'all' }`, so a GraphQL or network failure arrives
   as `{ data: undefined, error }`. A `catch` around a mutation therefore only
   sees a link-level throw (e.g. `authLink` cancelling during logout).

   Drive a failure with an operation mock that carries an `error` and assert
   the hook's real behaviour:

   ```ts
   const failing = recordMock(SomeDocument, {
     error: new Error('network down'),
   });
   renderHookWithApollo(() => useThing(), { operationMocks: [failing.mock] });
   ```

   Do NOT stub a helper to fake the throw — that tests a path the app barely
   takes. This was previously documented as a workaround around
   `executeMutation`; removing that wrapper surfaced five hooks that keyed
   success off "the call returned" and so reported a failed write as a
   success. **Put the failure handling where the failure arrives: on the
   resolved result**, not only in the `catch`.

2. **Use `variables: () => true` for complex transformed inputs.** When a
   mutation's `input` is built from a non-trivial transform (Spoonacular →
   CreateRecipeInput, device-info → register payload), don't mirror the
   transform in the test — use Apollo's `VariableMatcher` shape:
   `{ request: { query, variables: () => true }, result: { data: ... } }`.

3. **`waitFor(() => expect(result.current.loading).toBe(false))` is the right
   settling primitive.** A bare `await Promise.resolve()` doesn't flush
   Apollo's microtask chain reliably.

4. **Schema-driven `mocks` for deep selections.** Queries with 3-4 levels of
   fragment spreads (`GetPantry`, etc.) are impractical to mock literally —
   use `{ mocks: { Query: () => ({ pantry: { id: 'p1' } }) } }` and let
   `@graphql-tools/mock` fill the rest.

5. **The mock provider doesn't auto-flatten connections.** If a query selects
   `pantriesConnection` but the hook reads `home.pantries` (a flat array via a
   normalizer), the test must either (a) reshape inside the test's mock
   `normalize*` helper, or (b) update the production hook to read the
   connection edges directly.

6. **Subscription hooks with `customOnData`.** When a hook delegates to
   `subscriptionService.register({ customOnData })`, keep mocking
   `subscriptionService.register` to capture and invoke `customOnData`
   directly. Driving a real subscription event through `MockedProvider` is
   brittle and not what the cache-update assertion is testing.

7. **`__typename` on every entity in `operationMocks`.** Without it, Apollo
   can't normalize/cache the entity. The schema-driven path adds it
   automatically; literal `operationMocks` must include it explicitly. Use the
   generated TypeScript types as a structural reference.

**Helper shortcuts (`#/test-utils/apolloMockProvider`):**

- **`recordMock(query, { data, error?, delay?, maxUsageCount? })`** — replaces
  the legacy variables-spy pattern. Returns `{ mock, fired }`: `mock` goes
  into `operationMocks`; `fired` is an array of every variables payload Apollo
  observed for that operation, in order. Assert via
  `expect(fired).toContainEqual({ … })`.
- **`seedCache(entries)`** — pre-writes entities into a fresh PRODUCTION cache
  (`makeCache()`, not a bare `InMemoryCache`) so hooks that call
  `useApolloClient().cache.readFragment(…)` find them, and find them through the
  same policies the app reads with. Each
  entry needs `__typename` + `id` and any fields the hook reads. Pass the
  returned cache as `{ cache }` to `renderHookWithApollo`.
  A nested collection of identified entities is stored as its own records and
  referenced, so a later write to a child reaches every reader of the parent.
  **Prefer the checked form** — `seedCache([{ fragment: SomeDoc, data }])` —
  which holds the seed to a REAL selection; the derived form builds its
  selection from the fixture's own keys, so it can never be incomplete and
  therefore cannot hold the seed to anything. The count of files still using it
  is ratcheted by `check-test-cache-fidelity` and may only shrink.
- **Pick ONE mocking strategy.** `operationMocks` and `mocks`/`resolvers` are
  mutually exclusive by type. Passing both used to discard the second in
  silence — one live suite ran its hook on defaults with all sixteen tests
  passing. `operationMocks: []` means "no per-operation mocks", not "answer
  everything from the schema".
- **`partial: true` on a `recordMock`** is the only opt-out from schema
  completion, and it excuses exactly the `(type, field)` pairs that mock's
  payload omits. Use it only when the omission IS the subject.

### The `Environment` auto-mock

`Environment` (`src/utils/environment.ts`) is auto-mocked globally for every
test via `jest.setup.js` + `src/utils/__mocks__/environment.ts`: a complete
`jest.fn()` surface with sensible defaults (dev mode, analytics off, loggers
as no-op spies).

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
// ❌ Don't — a partial factory defeats the shared mock and reintroduces
//    per-test "missing method" fragility:
jest.mock('#/utils/environment', () => ({
  Environment: { isDevelopment: jest.fn() }, // missing all other methods
}));
```

The same pattern applies to `logger` (no-op `jest.fn()` per method) — assert
on `logger.error` etc. directly without redefining the mock.

### End-to-end (Detox)

```bash
npm run test:e2e:build          # build the iOS sim app
npm run test:e2e                # run against iOS simulator

npm run test:e2e:build:android  # build for Android emulator
npm run test:e2e:android

npm run test:e2e:build:android:device
npm run test:e2e:android:device
```

If the framework cache misbehaves: `npm run test:e2e:rebuild` or
`npm run test:e2e:clean`.

---

## Quality gates

Run all three before opening a PR — CI runs the same:

```bash
npm run typecheck   # tsc for the app AND the test project
npm run lint        # ESLint, including .graphql schema validation
npm test
```

`npm run lint:fix` and `npm run format` auto-fix what they can.

Two checks are not part of those, and nothing runs them for you:

```bash
node scripts/check-compiler-bailouts.mjs   # no new React Compiler bailouts,
                                           # and no extracted leaf re-absorbed
node scripts/check-bundled-secrets.mjs --self-test
```

`check-compiler-bailouts` guards a file COUNT and, separately, WHICH function
bails in the files where a variant call was deliberately extracted into a
leaf — moving it back into the composite keeps the count unchanged and would
otherwise pass.

**Why `check:version-sync` is a pre-push hook and not a habit:** it compares
`package.json`, `versionName`, and **each** `MARKETING_VERSION` in the
pbxproj. A mismatched platform would ship reporting a version it is not:
`getVersion()` is native, so the version-keyed Apollo cache purge
(`src/apollo/offline/ApolloCachePersistence.ts`) never fires there and
`CLIENT_VERSION` reaches the server's minimum-version gate wrong — with
nothing else failing to warn you. iOS `CURRENT_PROJECT_VERSION` and Android
`versionCode` are deliberately NOT compared: they are per-platform build
counters on independent sequences, read by `getBuildNumber()`.

### The boundary ratchets

Six checks hold boundaries that names and imports cannot see. Each keeps a
JSON baseline beside it that may only SHRINK — the baseline is the worklist,
and a new entry fails at the commit that added it.

| Check | What it holds | Baseline |
| --- | --- | --- |
| `check-data-layer-boundary` | A screen, sheet or cell does not run an operation, hold the client, or write the cache. It reads data through a hook in its feature's `hooks/`. `useFragment` and the masking types are NOT flagged — with `dataMasking` on, a cell subscribing to one entity is the documented pattern. `alertRejectedMutation` is not flagged either: it sits under `src/apollo/` but turns a refusal into localized copy. Generated operation types and colocated `.graphql` documents are TRACKED, not failed. The `src/apollo/**` half is also an `import/no-restricted-paths` zone, so the editor reports it; the name-aware `@apollo/client` half stays here, because an override covering these globs would REPLACE the narrower `no-restricted-imports` eight kit files already carry. | 0 (invariant) |
| `check-import-cycles` | No new LOAD-TIME import cycle. `import type` is skipped (TypeScript erases it) and so is `await import(...)` (it runs after both modules initialize) — writing a type-only import as a value import is what put 40 of the original 48 cycles in the tree. The eight recorded are the auth/link/store core: every link that reads session state imports the store singleton, and the store's reset path imports the links it has to stop. Breaking them means inverting that behind a registration seam like `store/sessionTeardown.ts`. | 8 |
| `check-hook-return-types` | The other half of the same seam: a feature hook must not HAND a screen a library type. The boundary check cannot see it, because the screen imports nothing. Every exported hook's return type is resolved through the TypeScript checker — the type and each property one level down, which is where a leak shows (`error: ApolloError`). A mutate wrapper declares `MutationOutcome<TData>` instead of the library's result generic. Runs in pre-push, beside typecheck, because it builds its own TS program. | 0 (invariant) |
| `check-single-consumer` | A module in `components`, `hooks`, `context`, `utils` or `constants` that exactly one feature reaches belongs to that feature. Reach is transitive, and `src/screens/auth` and `src/screens/onBoarding` counted as features until they became ones. | 101 |
| `check-form-state` | A form-shaped file with 3+ `useState` and no `useForm` is a hand-rolled form. Three is the threshold because two flags beside a real form are ordinary. | 51 |
| `check-feature-enumeration` | A feature id as a string literal outside its feature is a place that must be remembered when the feature list changes. Comments, import paths and index accesses are stripped; `home`, `profile` and `notifications` are excluded as generic words. | 1 |
| `check-canonical-mechanisms` | Five concerns with one documented mechanism each — the list primitive, the image component, the modal surface, the date formatter, device storage. The module that IS the canonical mechanism is never a finding. Six more concerns started here and reached zero; each is now a `no-restricted-imports` ban instead, which is where every one of these ends up. | 50 |
| `check-design-tokens` | A visual property written as a literal rather than a token, and a kit concept (section header, empty state, divider) restyled outside the kit. Two concerns are waiting on scales that do not exist yet — border width, and the missing spacing steps — which is what their numbers are for. | 207 |

Every one takes `--list` (print each finding), `--update` (re-baseline, refused
when it would write an empty record over a non-empty one) and `--self-test`
(prove the check can still fail — a scanner that finds nothing looks exactly
like a clean tree).

When a baseline reaches zero, promote the rule to an `import/no-restricted-paths`
zone in `.eslintrc.js` and delete the baseline file, the way the kit half of
`check-layer-purity` was promoted.

### Bans promoted out of the ratchet

Six concerns started as ratchet entries, were refactored to zero, and are now
hard `no-restricted-imports` bans — the promotion path the ratchet exists to
feed. Each names the module that IS the canonical mechanism as its only
exemption:

| Banned import | Use instead | Exempt |
| --- | --- | --- |
| `useNavigation` from React Navigation | `useAppNavigation`, whose `navigation` field is the escape hatch for `dispatch` and `addListener` | the two navigation wrappers |
| `getI18n` from `#/i18n/config` | `t` from `#/i18n` (`tGlobal` in a `.tsx`), or `useTranslation()` | `src/i18n`, and the four modules that need the instance to read or change the language |
| RN `ActivityIndicator` | a themed spinner from `themedComponents` | `themedComponents`, and `Loading` for its caller-supplied colour |
| `react-native-permissions` | `PermissionService` | the service |
| `react-native-turbo-image` | `CachedImage` | `CachedImage`, and `RecipeHeroImage` for its shared-transition wrapper |
| `@react-native-vector-icons/ionicons` | `Icon` with a `tone`; `type IconName` for a name | `iconUtils`, and `Toast` for a runtime nested-theme lookup |

### Dependency vulnerabilities

`check-dependency-audit` fails a PR on a known vulnerability in a PRODUCTION
dependency at `high` or above, and `dependency-audit.yml` runs the same check
weekly, opening or updating one `security`-labelled issue. An advisory that
cannot be fixed goes in `scripts/accepted-advisories.json` with a reason and a
revisit date, and is reported on every run.

Dependabot proposes upgrades; it fails nothing, and its
`open-pull-requests-limit: 0` on the actions ecosystem stops version-update PRs
only. Detection does not depend on either.

### Git hooks (installed by husky on `npm install`)

| Hook | Runs |
| --- | --- |
| **pre-commit** | `lint-staged` — ESLint + Prettier + related Jest tests on staged files — then the whole-tree checks that cost ~0.2s together: `check-i18n`, `check-codegen-orphans`, `check-version-sync`, `check-startup-origin`, `check-launch-arg-auth`, plus the structural ratchets `check-layer-purity`, `check-feature-shape`, `check-dead-modules`, `check-data-layer-boundary`, `check-single-consumer`, `check-form-state`, `check-feature-enumeration`, `check-test-cache-fidelity`, `check-comment-budget` |
| **commit-msg** | commitlint — [Conventional Commits](https://www.conventionalcommits.org/) required |
| **pre-push** | `typecheck`, `check:compiler-bailouts`, `check:unistyles-variants`, `check:hook-return-types` and `check:import-cycles` **concurrently**, then a codegen drift check |

The split is by cost. The five sub-second checks run per commit so a broken
locale key or a version drift surfaces at the commit that caused it. The five
expensive ones are independent, so pre-push runs them at the same time — ~22s
instead of the ~1m they cost in sequence — each into its own log so the output
does not interleave.

**A tag-only push skips the code gates entirely.** Git names every ref being
pushed on the hook's stdin; when they are all `refs/tags/*` there are no new
commits to check, and the gates would only be judging the working tree.
`npm run tag:*` pushes twice — delete, then create — so this was previously the
whole suite twice over, for an operation that ships no code.

The codegen drift check is skipped when the working tree is dirty, so it never
blocks a push mid-edit.

### i18n

```bash
npm run i18n:check
```

`en`, `es`, `it`, and `sq` must stay structurally identical. This also runs on
pre-push.

---

## Releases

Tags drive the release pipelines:

```bash
npm run tag:dev
npm run tag:stg
npm run tag:prod
npm run tag:playstore
npm run tag:android:prod   # Android only
npm run tag:ios            # iOS only
```

Pipelines, environments, and secrets: [`CI_CD.md`](CI_CD.md) and
[`github-actions-environments.md`](github-actions-environments.md).

---

## Command reference

<details>
<summary><strong>All npm scripts</strong></summary>

**Run**

| Command | Description |
| --- | --- |
| `start` | Metro bundler |
| `reset:cache` | Metro with a cleared cache |
| `ios` / `ios:stg` / `ios:prod` | iOS simulator, per scheme |
| `android` + `MODE`/`TARGET` | Android build + install |
| `android:stg` / `:prod` / `:release` / `:local-release` | Android variant shortcuts |
| `android:all` / `:emulator` / `:phone` | Target shortcuts |

**Codegen**

| Command | Description |
| --- | --- |
| `codegen` | Schema pull + types + persisted query manifest |
| `codegen:schema` | Schema pull only |
| `codegen:manifest` | Persisted query manifest only |
| `codegen:watch` | Regenerate on change |
| `check:codegen-orphans` | Orphaned `.generated.ts` files |
| `audit:fragments` | Fragment inlining report |
| `genenv` | Regenerate `src/config/env.generated.ts` from `.env` |

**Quality**

| Command | Description |
| --- | --- |
| `typecheck` | `tsc --noEmit` for app and tests |
| `lint` / `lint:fix` | ESLint (cached) |
| `format` | Prettier |
| `i18n:check` | Locale parity |
| `test` / `test:changed` | Jest |
| `test:e2e*` | Detox |

**Performance measurement**

| Command | Description |
| --- | --- |
| `perf` / `perf:baseline` / `perf:stability` | Reassure render-time benchmarks |
| `perf:ios:baseline` | n `simctl` cold launches, one metric set each, read back from Mimir into `e2e/artifacts/ios-baseline.json`. Drives the app directly rather than through Detox, which inflates the pre-JS window |
| `perf:ios:frames` | Samples the simulator screen from launch and classifies frames by PNG size to time first real content. iOS has no OS-side fully-drawn marker, so this is the only cross-check available there |

Both iOS tools need a release build installed and signed in, tutorials
dismissed, and the local API plus OTLP collector up. Numbers from an iOS
simulator OVERSTATE (it runs arm64 natively on the Mac's cores), so compare
iOS to iOS, build over build — never against an Android device figure.

**Build & analysis**

| Command | Description |
| --- | --- |
| `android:build` | Release APK |
| `android:build:bundle` | Release AAB |
| `android:clean` | `gradlew clean` |
| `ios:clean` | Clear `ios/build` and re-run `pod install` |
| `bundle:ios` / `bundle:android` | Produce a production JS bundle + sourcemap |
| `bundle:analyze` | `source-map-explorer` over the bundle |

**Housekeeping**

| Command | Description |
| --- | --- |
| `npm:clean` | Nuke `node_modules` and the npm cache |
| `watchman` | Reset watchman |
| `adb:*` | Android device helpers |
| `tag:*` | Create release tags |

</details>

---

## Troubleshooting

**Metro serving stale code** — `npm run reset:cache`, and `npm run watchman` if
file watching itself is confused.

**Android clean build**

```bash
npm run android:clean
npx react-native clean
rm -rf android/app/build android/app/.cxx
```

**iOS clean build** — `npm run ios:clean` (clears `ios/build`, re-runs
`pod install`).

**"codegen produced changes — your committed generated files are stale"** — run
`npm run codegen`, commit the result, push again.

**ProGuard/R8 issues in release builds** —
[`android-proguard-debugging.md`](android-proguard-debugging.md).

**Frame drops or slow lists** —
[`performance-monitoring.md`](performance-monitoring.md) and
[`flashlist-performance-analysis.md`](flashlist-performance-analysis.md). The
in-app Performance Dashboard (admin accounts) shows live FPS, startup timings,
and the slowest components and screen transitions.
