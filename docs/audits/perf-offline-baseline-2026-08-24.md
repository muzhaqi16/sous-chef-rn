# Performance baseline — 2026-08-24

Device: `emulator-5554` (Pixel_9a, API 36). API: local dev at `localhost:4000`
via `adb reverse`. App: `dev.souschef.app` 4.3.7, 63 pantry items, signed in.

Two builds were used, for different jobs. Numbers are not interchangeable.

## Build-config defect found and fixed during setup

`localRelease` was **not a release build for JS**. It embedded a 10.7 MB
`index.android.bundle` and ignored it, loading dev-mode JS from Metro with
`__DEV__ === true` and DevSupportManager active.

Root cause: `DefaultReactHost.getDefaultReactHost` defaults
`useDevSupport = ReactBuildConfig.DEBUG`
(`node_modules/react-native/.../DefaultReactHost.kt:69`), and `ReactBuildConfig`
reads **`com.facebook.react.BuildConfig.DEBUG`** — the react-android *library's*
flag, not the app's. For build types the library doesn't publish (`localRelease`,
`staging`), AGP resolves the library's debug variant, so dev support turned on
even though the app's own `BuildConfig.DEBUG` was `false`.

Fix: pass `useDevSupport = BuildConfig.DEBUG` explicitly in `MainApplication.kt`,
tying it to the app's build type. Verified after: `getJSBundleLoader()` instead
of `loadJSBundleFromMetro()`, and zero CDP targets.

**Any perf measurement taken on `localRelease` before this fix is invalid.**

## Release-build numbers (embedded bundle, `__DEV__` false)

| Metric | Value | Source |
|---|---|---|
| Cold start, native launch | **183 ms** median (164–194, n=5) | `am start -W` |
| `app_startup_duration_ms` | **134 ms** | Mimir |
| `screen_interactive_duration_ms` (PantryMain) | **574 ms** | Mimir |
| `screen_mount_duration_ms` (PantryMain) | 0 ms | Mimir |
| `flashlist_initial_load_ms` (PantryContent) | **40 ms** | Mimir |
| `flashlist_blank_cells_total` | **0** | Mimir |
| Janked frames, ~11 s continuous scroll | **14**, max 41 ms, mode 17 ms | Perfetto |
| RSS | 701.5 → 741.1 MB (+39.6) | Perfetto |

Debug build for comparison: RSS 974 → 998 MB, worst jank 62 ms. Release is
~273 MB lighter and drops its worst-case frame time by a third.

The 17 ms janks are single dropped frames at 60 Hz — mild. On this emulator
`goldfish_pipe_read_write` occupies ~30% of RenderThread, and 11 of 13 janks in
the debug trace were the main thread *waiting*, not computing. **Emulator frame
numbers understate real-device behaviour; re-measure on hardware before acting
on them.**

## Component attribution (debug build only — release has no CDP)

41 s session, 35 React commits, 2 over 16 ms.

| Component | Renders | Total | Avg | File |
|---|---|---|---|---|
| `Text` | 54 | 5.9 ms | 0.11 ms | `atoms/Text.tsx:59` |
| `FilterTabsItemComponent` | 9 | 5.0 ms | **0.56 ms** | `FilterTabs/FilterTabsItem.tsx:67` |

Both are flagged by the profiler as *"React Compiler should have optimized
this"* — the `styles.useVariants` bailout. `FilterTabsItemComponent` is the
worst per render and also builds `handlePress` and an inline
`{ backgroundColor }` object on every render.

`hermesBuiltinCopyDataProperties` accounted for **28 ms of the 55 ms** worst
commit — object-spread cost, consistent with `{...rest}` in `Text`.

The FlashList scroll itself produced almost no React work and zero network
calls. Virtualization is healthy; `DRAW_DISTANCE` is not implicated.

## Monitoring gap

`slow_component_renders_total` is emitted **only** from `useRenderTime.ts:159`,
which is `__DEV__`-gated (`:85`) and documented as "completely inert in
production builds". The series exists in Mimir but **a release build can never
populate it** — its emptiness proves nothing. There is currently no
release-visible signal for slow component renders, which is exactly the signal
needed to decide whether `Text.tsx` is worth fixing.

By contrast `flashlist_blank_cells_total` (`useFlashListPerformance.ts:215`) is
on the production path, so its zero is a real zero.

## Status of prior findings

| Finding | Status |
|---|---|
| F1a `useDeferredValue` → FlashList, paginated (`useRecipeScreen.tsx:587` → `IngredientSelectorSheet.tsx:129`) | **Confirmed live** — doc claims resolved |
| F1b same via `useItemAutocomplete.ts:93` → `BottomSheetAutocompleteInput.tsx:345` | **Confirmed live** |
| F3 `Text.tsx` compiler bailout | **Confirmed in debug**; release impact unmeasurable (see gap above) |
| F4 stale bailout baseline | **Confirmed** — 8/63 `files` paths stale; 1/4 `isolatedLeaves` guards dead (`HomeInviteCard`) |
| O2 queue never dequeues failures | **Confirmed** — `queueStore.ts` keeps everything not `SUCCESS`; two handlers registered, the winner never removes |
| O11 cache purged on version bump | **Observed live** — the 4.3.6 → 4.3.7 install purged the persisted cache |

## Not yet measured

Offline matrix (scenarios A–E), other screens (Shopping List, Recipes, Meal
Plan, Home, Notifications), F2 subscription refetch storms (needs writes, not
scrolls), and any physical-device run.

---

# Follow-up: the PantryMain interactive time

## Correction to the earlier framing

There is **no "~400 ms gap"**. `app_startup_duration_ms` is
`Date.now() - __APP_START_TIMESTAMP` labelled `js_to_hydrated`
(`useStartupInit.ts:178`); `screen_interactive_duration_ms` is screen **focus →
first rAF after mount** (`useScreenTransition.ts:125`). Different origins; not
subtractable. `screen_mount_duration_ms = 0` is structural — focus-mark and
mount-effect land in the same tick.

The real statement: **~580 ms elapses between PantryMain mounting and the first
frame being produced.**

## What is established

Exact per-run values, read from the `duration` label on
`slow_screen_transitions_total` (fires above 500 ms, not `__DEV__`-gated):

| Screen | focus → interactive |
|---|---|
| **PantryMain** | **574 / 580 / 603 ms** (n=3) |
| ShoppingListMain | 117 ms |
| RecipeMain | 85 ms |
| MealPlanMain | 31 ms |

No screen other than PantryMain has ever crossed the 500 ms threshold.

Supporting facts:

- `flashlist_initial_load_ms` = 40 ms → **the list is not the bottleneck**;
  ~540 ms of the window is something else.
- Apollo HTTP batching is **off** (`GRAPHQL_BATCH_ENABLED` unset,
  `httpLink.ts:76`), so it does not explain the query timing below.
- Cold-start query timeline (Loki, release build): `GetNotificationPreferences`
  +0 ms, `GetUserProfile` +5 ms, `GetHomes` +9 ms, `GetPantry` +113 ms — and
  **all four complete within 13 ms of each other at ~865 ms**, client-measured
  (855/864/857/760 ms). Against a *local* API. Interactive (~650 ms) precedes
  this, so the 580 ms is **not** waiting on data — but the clustering is
  unexplained and worth its own investigation.
- Subscriptions all start at +3032 ms.
- Cold-starting into MealPlan via `souschef://meal-plan` did **not** produce a
  slow transition — so this is not generic startup contamination of whichever
  screen focuses first.
- `HomeTabs` sets `lazy: true` (`HomeTabs.tsx:46`), so non-focused tabs are not
  pre-mounted.

## Retracted

An earlier reading of "PantryMain average 273.7 ms" was derived with
`sum(...) by (screen)` across sessions. That is unreliable here: these are
per-session counters and stale series linger, so the aggregate is computed over
a shifting population. **Only the exact `duration`-label values above should be
trusted.** For the same reason, a `screen_views_total` reading suggesting all
four tabs mount at startup was stale-series noise and is withdrawn —
`lazy: true` contradicts it.

## Telemetry defects found

1. **`slow_component_renders_total` can never fire in release.** Emitted only
   from `useRenderTime.ts:159`, which is `__DEV__`-gated at `:85`. The series
   exists in Mimir and is permanently empty. This is the one signal that would
   settle whether `Text.tsx`'s compiler bailout matters in production.
2. **`slow_screen_transitions_total` puts `duration` in a label**
   (`useScreenTransition.ts:161`). Every distinct millisecond value mints a new
   time series — unbounded cardinality against Mimir. It is why exact per-run
   values were recoverable, but it is a cardinality bomb and should be a
   histogram.
3. **Inconsistent label keys**: `screen_views_total` uses `screen_name`
   (`TelemetryService.ts:314`) while the transition metrics use `screen`. The
   two cannot be joined in PromQL.
4. **Per-session counters with lingering series** make naive cross-session
   aggregation wrong (see Retracted).

## Still unattributed

What occupies the ~540 ms between PantryMain's mount and its first frame.
A Hermes CPU profile armed *before* the mount is needed, and the current
tooling cannot do it: `debugger-reload-metro` tears down the React profiling
session (it rides on the JS-runtime debugger), and arming the profiler by hand
takes longer than the window being measured. Options: a temporary in-app mark
around the suspected work, or a system-wide Perfetto trace started before
launch.

---

# Telemetry fixes applied — and what they exposed

## Fixed

1. **`useRenderTime` now reports in release.** The `if (!__DEV__) return;`
   guards in both effects made the hook inert in production, even though
   `DEFAULT_PERFORMANCE_CONFIG` declares `trackRenders: true // sampled in
   production` and `slowRenderThreshold: __DEV__ ? 500 : 16 // 16ms = 60fps for
   production`. The production path was designed, documented, and unreachable.
   Reporting is now gated by `enabled` + `sampleRate`; console output stays
   dev-only. The module-level `AppState` listener was also un-gated — it guards
   against contaminated samples and was itself dev-only.
2. **`duration` removed as a metric label** on both
   `slow_component_renders_total` (`useRenderTime.ts`) and
   `slow_screen_transitions_total` (`useScreenTransition.ts`). Every distinct
   millisecond minted a new time series. `docs/telemetry-setup.md:175-176`
   already documented these as carrying only `component`/`screen`, so this is
   code catching up to the documented contract. The Grafana panels
   (`infra/grafana/dashboards/sous-chef-performance.json:167,216`) aggregate
   without the label, so they are unaffected.

Three regression tests added, each verified to fail against the original code:
`useRenderTime.test.ts` — "reports in production builds", "does not put duration
in a label"; `useScreenTransition.test.ts` — "reports a slow transition without
putting duration in a label". The pre-existing assertion used
`expect.objectContaining({ component })`, which is why the stray label survived.

Gates after the change: typecheck clean, lint clean, **633 suites / 7,610 tests
pass**, no new compiler bailouts.

## Not changed, deliberately

`screen_views_total` uses `screen_name` while the transition metrics use
`screen`, so the two cannot be joined in PromQL. Both the label and the
dashboard query (`sous-chef-analytics.json:269`, `by (screen_name)`) are the
documented contract. Renaming breaks a working dashboard for a join nobody
currently needs. Left alone on purpose.

## What the fix exposed: the metric is unsound for its production threshold

With reporting live in release, a cold start with **no user interaction** gave:

| Component | commits | avg "duration" | total |
|---|---|---|---|
| RecipeMain | 19 | 346 ms | 6,574 ms |
| SortableShoppingList | 4 | 436 ms | 872 ms |
| PantryContent | 1 | 246 ms | 1,228 ms |

**These are not render costs.** `useRenderTime` measures commit-to-commit
elapsed wall time (`commitTime - prevCommitTime` on a per-instance ref), so the
value is dominated by *idle time between commits*, not CPU. The cross-check is
decisive: `flashlist_initial_load_ms` reports **40 ms** for the same
PantryContent screen. A component that re-renders 300 ms after its last commit
records "300 ms" no matter how cheap the render was.

Consequences:

- `slow_component_renders_total` with a **16 ms** production threshold will fire
  for essentially every re-render that is not in the same frame. As a
  "slow render" signal in production it is close to meaningless. The dev
  threshold of 500 ms accidentally masked this.
- `component_render_duration_ms` is misnamed; it is a re-render *recency* gap,
  not a duration.

What it IS good for, unchanged: **re-render counts**. `RecipeMain` committing
**19 times during a cold start with no interaction** is a real, previously
invisible finding worth chasing on its own.

Deciding between renaming/re-thresholding the metric versus replacing it with
React's `<Profiler onRender>` `actualDuration` (true render cost) is a design
call, not a mechanical fix — flagged, not taken.

---

# Correction: PantryMain interactive time is bimodal, not a stable 580ms

## The error

Earlier this report stated PantryMain focus→interactive was "574 / 580 / 603 ms
(n=3), reproducible within ±5%". **That conclusion was drawn from a censored
sample.** Those values were read from the `duration` label on
`slow_screen_transitions_total`, a counter that only increments when the
duration exceeds 500ms (`useScreenTransition.ts:150`). Every value it can
possibly expose is >500ms. The tight clustering was an artifact of the
threshold, not evidence of stability.

## What the unbiased source shows

Reading `screen_interactive_duration_ms` (the histogram, which records every
sample) across three consecutive clean release cold starts:

| Run | PantryMain focus → interactive |
|---|---|
| 1 | 49.9 ms |
| 2 | 59.9 ms |
| 3 | **572.6 ms** |

The distribution is **bimodal**: roughly 50–65ms typically, with an
intermittent ~575ms mode. It is not a fixed cost that regressed, and it was
never "5× worse than every other screen" as a steady state — the other screens'
figures were single samples from the same censored era and need re-reading from
the histogram too.

**The ~575ms mode is real and worth chasing** — it is a half-second of blocked
JS before first paint, hitting some fraction of cold starts. But it is an
intermittent race, and any fix must be judged against a distribution over many
runs, never a handful of samples.

## Rule for this codebase

Never read a performance value from a `slow_*_total` counter's labels. Those
counters are threshold-gated and structurally incapable of showing the fast
half of the distribution. Use the `_bucket` / `_sum` / `_count` histogram series
(`screen_interactive_duration_ms`, `component_commit_gap_ms`). The slow counters
answer "how often did we exceed the threshold", nothing more.

## Clean release cold-start breakdown (single session, warm cache)

| Metric | Value |
|---|---|
| `app_native_launch_ms` (`native_init`) | 22 ms |
| `app_js_bundle_load_ms` (`hermes_bytecode`) | 256 ms |
| `app_zustand_hydration_ms` | 233 ms |
| `app_startup_duration_ms` (`js_to_hydrated`) | 272 ms |

Zustand hydration at 233ms is most of the 272ms `js_to_hydrated` window and is
the clearest startup target. Earlier averages for these metrics (381 / 753 /
1505 / 1259 ms) mixed debug and release sessions — both label `env=development`,
so they cannot be separated by label. Only per-session reads are trustworthy.

## Confound to be aware of

Another session is editing FlashList tuning in this same checkout
(`pantryDisplay/constants.ts`, `SortableShoppingList/SortableList.tsx`). Their
own A/B is recorded in `constants.ts`: 2× vs 1× `drawDistance`, 3 trials each,
peak React commit 659ms → 469ms, and they did **not** adopt 1×. Builds taken
here may include their in-flight edits, so cross-build comparisons in this
document are not controlled.

---

# Dead-metric audit (2026-08-24)

Method: metric names emitted in `src/` vs `__name__` values present in Mimir
over 7 days vs metric names queried by `infra/grafana/dashboards/*.json`.

## A. Dead because `__DEV__`-gated — wire these (same defect class as the one just fixed)

`src/apollo/offline/ApolloCachePersistence.ts:277-283` — three Telemetry calls
sit **inside an `if (__DEV__)` block** alongside the debug log:

- `cache_persist_extract_ms`
- `cache_persist_stringify_ms`
- `cache_persist_size_kb`

They can never populate from a release build. **These are the most valuable ones
to wire**: persisted-cache size and serialize cost bear directly on cold start
and on the intermittent ~575ms first-paint mode. Fix is the same shape as
`useCommitTracking` — move the Telemetry calls out of the `__DEV__` block, leave
`logger.debug` inside.

## B. Dashboard panels querying metrics nothing emits

Panel 67 "Cache & Store Restore (P95)" has four targets; two reference metrics
with **no emitter anywhere in `src/`**:

- `app_apollo_deferred_restore_ms`
- `app_apollo_legacy_restore_ms`

Those series will never render. Either wire them or drop the targets.

## C. Emitted in code but never observed — need investigation

| Metric | Emitter | Note |
|---|---|---|
| `app_apollo_restore_ms` | `src/apollo/client.ts:61` | Emitted at **module scope** via a lazy `import('#services/telemetry')`. Never seen. Either the `if (persistedCache)` branch does not run (cache never restored) or the lazy emitter never delivers. **Not determinable from a release build** — see D. |
| `apollo_cache_edge_count` | `src/apollo/cache.ts` | Never seen |
| `resort_edges_duration_ms` | `src/hooks/subscriptions/useShoppingListSubscriptions.ts` | Never seen — this is the metric for the known-open `resortEdges` issue, so the issue is currently unmeasurable |

`app_apollo_restore_ms` matters most: if the persisted Apollo cache is not being
restored, every cold start runs on an empty cache, which would explain the four
startup queries and weaken offline reads. **This is a hypothesis, not a
finding** — it could not be confirmed or refuted (see D).

## D. Why release-build introspection failed here

Two independent blind spots, both worth knowing before the next investigation:

1. **`logger` (`src/utils/environment.ts:221-240`) writes to `console` only.** It
   never forwards to Telemetry/Loki. The Loki app stream comes from
   `TelemetryService.log`. So the absence of `logger.info('Apollo: Restoring…')`
   in Loki proves nothing.
2. **Console output is stripped in release** — a cold start produces **zero**
   `ReactNativeJS` logcat lines.

Net effect: anything instrumented only with `logger.*` is invisible in release.
Confirmed by level counts over an hour of app logs in Loki: 367 debug, 26 warn,
7 error, **0 info** — because no `info` ever reaches that transport.

## E. Never-triggered counters (not dead, just no incidents)

`auth_errors_total`, `onboarding_errors_total`, `recipe_detail_errors_total`,
`offline_queue_conflicts_total`, `storage_recovery_instance_used`. These are
error-boundary and conflict counters; absence is good news, not breakage.

`app_memory_warnings_total` / `app_memory_critical_total` are doubly gated:
`DEFAULT_PERFORMANCE_CONFIG.trackMemory: false`, and `MemoryMonitor.start()`
only runs when `!__DEV__` (`useStartupInit.ts:161`).

## F. Live but unwatched — usable today, just needs a panel

- `offline_queue_depth`
- `offline_queue_permanent_failures_total`

Both already report from release and are directly relevant to the offline-first
work. Nothing charts them.

## Recommended order

1. Un-gate the three `cache_persist_*` metrics (mechanical, high value).
2. Resolve `app_apollo_restore_ms` — is the persisted cache actually restored?
   Instrument with `Telemetry`, not `logger`, so the answer is visible in release.
3. Add panels for `offline_queue_depth` and
   `offline_queue_permanent_failures_total`.
4. Fix or drop the two phantom targets in panel 67.

---

# Metric wiring (2026-08-24) — and the bug it exposed

## Wired

Five metrics were trapped inside `if (__DEV__)` blocks and could never report
from a release build. All moved out; the human-readable `logger.debug`
breadcrumbs stayed inside.

| Metric | File | Now |
|---|---|---|
| `cache_persist_extract_ms` | `ApolloCachePersistence.ts` | LIVE |
| `cache_persist_stringify_ms` | `ApolloCachePersistence.ts` | LIVE |
| `cache_persist_size_kb` | `ApolloCachePersistence.ts` | LIVE — **79 KB** |
| `apollo_cache_edge_count` | `apollo/cache.ts` | LIVE — 55 edges |
| `resort_edges_duration_ms` | `useShoppingListSubscriptions.ts` | Wired; path not exercised yet |

`app_apollo_restore_ms` (`apollo/client.ts`) now reports on **both** paths with
an `outcome` label (`restored` / `empty`) instead of only on success — `logger`
is console-only and console is stripped in release, so a metric was the only way
to observe this on a device.

Dashboard (`sous-chef-performance.json`): panel 67's two phantom targets
(`app_apollo_deferred_restore_ms`, `app_apollo_legacy_restore_ms` — no emitter
exists) replaced with `cache_persist_extract_ms` / `cache_persist_stringify_ms`;
new panels 68-72 for offline queue depth, permanent failures, Apollo restore
outcome, and persisted cache size.

New guard: `__tests__/telemetry/noDevGatedMetrics.test.ts` fails if any
`Telemetry.*` metric call sits inside an `if (__DEV__)` block. Verified to fail
against a deliberately re-gated metric.

## The bug this exposed: the persisted Apollo cache is write-only

First cold start after wiring reported:

```
app_apollo_restore_ms{outcome="empty"}   ← nothing restored
cache_persist_size_kb = 79               ← 79 KB written that same session
```

**The cache is saved every session and never restored.** Mechanism:

1. `initializeSecureStorage()` (`src/storage/mmkv.ts:76`) is **async** — it
   awaits `getEncryptionKeyWithRetry()`, a keychain read.
2. `index.js:106` calls it **without awaiting**.
3. `apollo/client.ts:219` runs `initializeClient()` at **module scope**, which
   calls `apolloCachePersistence.load()`.
4. `load()` starts with `if (!isStorageReady()) return null;` and
   `isStorageReady()` is `secureStorageInstance !== null` — still null, because
   step 1 has not resolved.

Consequences:

- Every cold start runs on an **empty** Apollo cache and refetches everything —
  consistent with the four queries observed at startup.
- **Offline reads after an app restart return nothing.** The offline-first
  guarantee holds within a session but not across a relaunch. This is the most
  consequential finding in this document.
- `cache-and-network` masks it whenever the device is online, which is why it
  went unnoticed.

Not fixed here — the fix is an init-ordering change (await storage before
constructing the client, or restore lazily once storage is ready), which is an
architectural decision, not a mechanical one. It should be verified with the
same metric: `outcome` must flip to `restored`.

## Note on a concurrent change

`babel.config.js` was modified by another session at 13:38 today, reversing the
documented plugin order so `babel-plugin-react-compiler` runs **before**
`react-native-unistyles/plugin`. CLAUDE.md states the reverse order is required.
That change takes compiler bailouts from 63 to 0 — `check-compiler-bailouts.mjs`
now reports "63 fewer than baseline". **The baseline was deliberately NOT
ratcheted down**: that result belongs to an in-flight experiment by another
session, not to this work. All release measurements in this document were taken
from APKs built at or before 13:32 and so predate it.

---

# Offline matrix — run 2026-08-24 (release build, RN 0.86.3, Pixel_9a)

Method: airplane mode **and** `adb reverse --remove-all`. `adb reverse` tunnels
over the adb channel to device loopback, so airplane mode alone does not sever
the app from a local API — testing that way is a false pass.

| Scenario | Result |
|---|---|
| **C** — true offline, cold start | **PASS.** 63 items render from the restored cache. Before the restore fix (6d0059b9) this screen was empty. |
| **C** — offline write | **PASS.** Create succeeds, row appears immediately, no error. |
| **D** — recovery | **PASS.** Queue replays; quantity `1` → `1 piece` as the server's canonical unit merges. |
| **E** — killed mid-queue | **PASS** at both 2s and 25s after the write. The queue is durable across process death. |
| RNGH on RN 0.86.3 | **PASS.** Swipe actions work. |

## Harness error worth recording

Scenario E was twice mis-reported here as permanent data loss. It was not: the
`tcp:4000` reverse tunnel had been left down (the `adb-reverse.sh` call was
output-suppressed, so its failure was invisible), so the queued write had no
route to replay. Once the tunnel was restored the write replayed and the item
appeared, server-canonicalized.

**Always assert the tunnel after restoring network** — `adb -s <serial> reverse
--list` must show `tcp:4000` — before concluding anything about queue or
connectivity behaviour. An app correctly reporting "offline" against a severed
tunnel is indistinguishable from an app failing to detect reconnection.

The real effect behind that mistake is milder and still worth fixing: an offline
write killed before cache persistence runs (3s debounce + `requestIdleCallback`)
disappears from the UI until it replays and is refetched. The data is safe; the
row visibly vanishes and returns later.

## Defects found, in priority order

1. **Pantry item detail spins forever offline.** Tap any item with no network →
   infinite `LOADING`, no error, no offline state, no retry; the only escape is
   the back button. Verified still spinning at 30s. This contradicts the earlier
   static finding that "no screen spins forever: every offline branch calls
   `observer.complete()`".
2. **Shopping List is "Not available offline"** while Pantry works. `HomeTabs`
   sets `lazy: true` (`HomeTabs.tsx:46`), so a tab never visited while online
   never ran its query and has nothing cached. The empty state itself is good
   (message + "Try again"), but offline availability silently depends on which
   tabs the user happened to open.
3. **Aggregate counts are stale on every local write.** Creating showed 64 items
   as "63"; deleting showed 65. Corrects only on a full refetch. `Pantry.stats`
   is not updated optimistically (it relies on a `mergeObjects` policy).
4. **No queued/pending affordance** on offline-created rows (O5) — indistinguishable
   from synced rows. `queueStore.getPendingClientIds()` already computes the set.
5. **No offline indicator on detail screens** (O6) — only the four tab headers
   carry `OfflineStatusPill`.
6. **Telemetry carries no device or session identifier.** Both emulators report
   under `service_name="sous-chef-app"` with only `platform` and `env` labels, so
   logs and metrics cannot be attributed to a device or run. This is what made
   several readings in this document ambiguous, and it is why cross-session
   metric aggregation cannot be trusted.

Not yet run: scenarios A and B in isolation (NetInfo signal vs `isApiUnavailable`
breaker), and O1 (recipe → shopping list offline), which needs the Recipes tab
warmed online first.

---

# Addendum — 2026-08-25: hardware measurements, and four rejected hypotheses

This file is now TRACKED (`.gitignore` carries a negation for it). It was
untracked while everything above was written, which is part of why the session
below re-derived what was already here.

## Physical-device baseline (new)

**SM-S908U1 (`R5CT51KPEBM`), Android 36, `localRelease`, 63 pantry items, warm
cache, n=3.** Frame-sampled at ~450 ms via `adb exec-out screencap`.

| Elapsed | State |
|---|---|
| ~70-140 ms | splash |
| ~1.2 s | blank |
| **~1.6-1.8 s** | header + `PantryAlertBar` ("63 items"), **no filter tabs, no rows, no skeletons** |
| ~2.1-2.3 s | populated list |

The header-only frame is real and user-visible. `ListHeaderComponent` is not a
cell, so it paints while row 0 (the sticky tabs), the rows and the footer — all
of which go through FlashList's cell path — have not been laid out.

`flashlist_initial_load_ms` (PantryContent): **301-934 ms on this device** vs the
**40 ms** recorded above on the Pixel_9a emulator. The emulator-based reading
that "the list is not the bottleneck" does not transfer to hardware.

One measurement was accidentally clean: the build points at
`http://localhost:4000/graphql`, which on a phone is the phone. That run had no
API at all and served entirely from the restored cache — and still took ~2.2 s.
**The window contains no network wait.**

## Four hypotheses tested and rejected

Each was proposed from a plausible mechanism, then disproved by measurement.
Recorded so they are not re-proposed.

**1. FlashList `initialDrawBatchSize` (default 2 → 8).** Mechanism is real and
verified in `RecyclerViewManager.renderProgressively()`: each pass mounts
`renderStack.size + initialDrawBatchSize ** ceil(pass/5)` visible indices and
repeats until every visible index is measured. Result: first-populated frame
2593/2264/2238 ms → 2026/2363/2402 ms, and the header-only frame survived. Inside
sampling noise. **Reverted.** Confirming a mechanism exists says nothing about
its share.

**2. Smaller pantry first page (`itemsFirst` 100 → 25).** Emulator, localRelease,
warm cache, time-to-populated median: **1631 ms at 100 vs 1725 ms at 25** (n=5 /
n=3). No improvement. The reason was knowable in advance and was missed:
`INITIAL_RENDER_WINDOW = 24` means the same 24 rows mount either way, so the page
size only changes how much Apollo normalises. **Reverted.**

**3. Shrinking the persisted Zustand payload.** Instrumented phases (debug build):
keychain read 57 ms, MMKV open/decrypt 7 ms, blob read + `JSON.parse` +
rehydrate **5 ms**, blob size **34.9 KB**. There was nothing to shrink.
`app_zustand_hydration_ms` measured JS-entry → rehydrate callback, a
module-evaluation window — it never measured hydration. **Renamed to
`app_js_entry_to_store_ready_ms`.**

**4. Lazy i18n locales.** Built (en eager, the rest via an i18next `BackendModule`
+ `partialBundledLanguages`), all gates green, then measured: `after-i18n` 243/210
ms vs baseline 253/207 ms — **no change**. Splitting the module apart appeared to
show `import 'i18next'` costing 229 ms, with react-i18next, `en.json` (136 KB) and
`init` all ~0 ms. **Then the control:** inserting `@apollo/client` immediately in
front made *it* absorb 197 ms and i18next drop to 0. **Reverted.**

## The debug-bundle first-require artifact

In a debug bundle, the first heavy `require` after a timing mark absorbs ~200 ms
that belongs to no module. It follows POSITION, not identity — move an unrelated
import in front and the cost moves with it. Any per-module attribution taken from
a debug build is therefore unreliable, including the "i18n 253 ms / FCM 149 ms /
`enableScreens` 187 ms" split derived earlier in this session, which is withdrawn.

Corollary: `TurboModuleRegistry.get('RNGestureHandlerModule')` in `index.js`
measured **1 ms**. Its comment implies expense; it is free. Keep it — it prevents
a launch crash — but it is not a cost.

## Instruments that could not resolve the question

- **~450 ms screencap sampling** cannot resolve a ~100 ms difference. Used for
  hypothesis 1, which is why that A/B is "inside noise" rather than answered.
- **The Mimir series had no per-run resolution here.** Four controlled cold starts
  on each of two different builds returned the identical value (672 ms) all eight
  times, while PIDs confirmed the app really was cold-starting. Validate that a
  pipeline can detect a *known-different* input before trusting it on an unknown
  one.

## Still unattributed

What occupies the window between `PantryMain` mounting and its first frame. Four
hypotheses are now excluded. The audit's original recommendation stands: a Hermes
CPU profile armed BEFORE the mount, which the current tooling cannot do. Do not
propose a fifth hypothesis without it.
