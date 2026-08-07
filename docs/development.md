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
`__tests__/helpers/apolloMockProvider.tsx` — a schema-backed cache with
type-safe mocks. Mocking `@apollo/client/react` directly is banned by lint: it
couples tests to operation names and bypasses the very cache integration the
tests exist to catch. Helper shortcuts: `recordMock()` to capture the variables
Apollo actually observed, `seedCache()` to pre-write entities that hooks read
with `cache.readFragment`.

Shared auto-mocks live in `__mocks__/` folders next to their modules
(`Environment`, `logger`, MMKV storage, navigation hooks, token scheduler, …) —
override per-suite with `mockReturnValue` rather than replacing the module.

Patterns and gotchas: the "Apollo Test Patterns" section of `CLAUDE.md`.

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

### Git hooks (installed by husky on `npm install`)

| Hook | Runs |
| --- | --- |
| **pre-commit** | `lint-staged` — ESLint + Prettier + related Jest tests on staged files |
| **commit-msg** | commitlint — [Conventional Commits](https://www.conventionalcommits.org/) required |
| **pre-push** | `typecheck`, `i18n:check`, `check:codegen-orphans`, and a codegen drift check |

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
