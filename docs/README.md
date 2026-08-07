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
| **[CLAUDE.md](../CLAUDE.md)** | The enforced day-to-day conventions — Apollo cache patterns, Unistyles rules, React Compiler constraints, bottom sheets, worklets, testing. Much of it is backed by lint rules and tests. |

---

## Data & state

| Document | What's in it |
| --- | --- |
| [Apollo client patterns](apollo-client-patterns.md) | The comprehensive Apollo guide: cache update patterns, optimistic responses, fragment composition and masking, error handling and version conflicts, subscriptions, fetch-policy decision trees. |
| [Local-first architecture](local-first-architecture.md) | How writes apply instantly and offline — the mutation queue, replay on reconnect, conflict handling, and what "complete optimistic entity" means in practice. |

## Features

| Document | What's in it |
| --- | --- |
| [Meal planning](meal-planning.md) | Domain model for plans, meal types, templates, and shopping-list generation. |
| [Push notifications](push-notifications.md) | Delivery architecture, APNs/FCM credentials, and how notification taps route into the app. |

## UI & performance

| Document | What's in it |
| --- | --- |
| [Backdrop lifecycle design](backdrop-lifecycle-design.md) | The global bottom-sheet backdrop system and the leak it was designed to fix. |
| [FlashList performance analysis](flashlist-performance-analysis.md) | Scroll delay and cross-screen memory investigation, with the resulting rules. |
| [Performance monitoring](performance-monitoring.md) | Render-time, memory, and screen-transition instrumentation behind the in-app Performance Dashboard. |
| [Premium UX overhaul](premium-ux-overhaul.md) | Design-consistency initiative — progress tracker and working rules. |

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

---

## Screenshots

`screenshots/` holds the iOS captures used in the project README. Replace them
with fresh simulator captures when the UI changes materially — keep the same
filenames so the README doesn't need editing.
