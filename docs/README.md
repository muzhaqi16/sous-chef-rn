# Sous Chef — Documentation

Developer documentation for the Sous Chef React Native app. For what the app
*does*, start at the [project README](../README.md).

---

## Start here

| Document | What's in it |
| --- | --- |
| **[Architecture](architecture.md)** | How the app is built and organized — feature modules, state ownership, the data layer, offline-first, navigation, and the UI layer. Read this first. |
| **[Development](development.md)** | Setup, environment files, build variants, codegen, testing, quality gates, and the full command reference. |
| **[Contributing](../CONTRIBUTING.md)** | Contribution terms, PR guidelines, git hooks. |
| **[CLAUDE.md](../CLAUDE.md)** | The enforced day-to-day conventions, one rule per line — commands, structure, Apollo, UI, React Compiler, i18n, testing. Backed by lint rules and tests; verified rules link into the probe record below. |
| **[Verified library behaviour](verified-library-behaviour.md)** | The probe record CLAUDE.md's one-line verification stamps link into — each entry pins a rule to the installed package's source, with a re-check command. |

---

## Data & state

| Document | What's in it |
| --- | --- |
| [Apollo client patterns](apollo-client-patterns.md) | The comprehensive Apollo guide: cache update patterns, optimistic responses, fragment composition and masking, error handling and version conflicts, subscriptions, fetch-policy decision trees. |
| [Local-first architecture](local-first-architecture.md) | How writes apply instantly and offline — the mutation queue, replay on reconnect, conflict handling, and what "complete optimistic entity" means in practice. |
| [Session & transport](session-and-transport.md) | How a session ends, how tokens rotate on both transports, and how WebSocket close codes are read — the verdict table and the mechanisms behind it. |
| [Subscriptions — echo, budget, device identity](subscriptions-echo-and-budget.md) | Why echo suppression keys on the DEVICE and not the user, the subscription budget, and where device identity comes from. |

## Features

| Document | What's in it |
| --- | --- |
| [Meal planning](meal-planning.md) | Domain model for plans, meal types, templates, and shopping-list generation. |
| [Push notifications](push-notifications.md) | Delivery architecture, APNs/FCM credentials, and how notification taps route into the app. |

## Language

| Document | What's in it |
| --- | --- |
| [i18n architecture](i18n-architecture.md) | How translation is wired, why five hardcoded-string sweeps each found more, and what each guard can and cannot prove. |

## UI & performance

| Document | What's in it |
| --- | --- |
| [Backdrop lifecycle design](backdrop-lifecycle-design.md) | The global bottom-sheet backdrop system and the leak it was designed to fix. |
| [FlashList performance — current state](flashlist-performance-analysis.md) | How the pantry and shopping-list FlashLists are fed, what a page append costs (measured), why every write used to refetch a page and recompute the hidden Recipes tab (and the fixes), how to read the perf instrumentation, and the disposition of the earlier investigation's issues. |
| [FlashList layout-index race](flashlist-layout-index-race.md) | Resolved `not enough layouts` crash on rapid deletes — FlashList shrinks its layout table during render, so list data must never come through `useDeferredValue`/`startTransition`; mechanism, the rule, validation. |
| [Performance monitoring](performance-monitoring.md) | Render-time, memory, and screen-transition instrumentation behind the in-app Performance Dashboard. |

## Platform & build

| Document | What's in it |
| --- | --- |
| [Android build setup](android-build-setup.md) | Build environments, tag-triggered workflows, keystores, and outputs. |
| [Android multi-device guide](android-devices-readme.md) | How `MODE` / `TARGET` / `DEVICE_ID` drive `scripts/run-android.sh`. |
| [Android ProGuard debugging](android-proguard-debugging.md) | Diagnosing R8/ProGuard-only crashes in release builds. |

## Operations

| Document | What's in it |
| --- | --- |
| [CI/CD](CI_CD.md) | Pipelines, triggers, and the release flow. |
| [GitHub Actions environments](github-actions-environments.md) | The `dev` / `stg` / `prod` environments and their secrets. |
| [Telemetry setup](telemetry-setup.md) | OTLP metrics and logs, endpoints, and credentials. |
| [Bundled credentials — decision record](bundled-credentials-decision.md) | Which credentials ship in the binary, why each is acceptable or accepted as a finding, and the test `check-bundled-secrets` applies. |

---

## Screenshots

`screenshots/` holds the iOS captures used in the project README. Replace them
with fresh simulator captures when the UI changes materially — keep the same
filenames so the README doesn't need editing.
