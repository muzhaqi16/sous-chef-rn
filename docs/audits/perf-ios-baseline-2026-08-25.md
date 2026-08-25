# iOS performance baseline — 2026-08-25

Companion to `perf-offline-baseline-2026-08-24.md`, which is entirely Android.
That document's rules apply here unchanged; this one records what is different
about iOS, and holds the iOS numbers.

Device: `iPhone 17` simulator (Xcode 26.6, iOS 26.5) on an Apple Silicon Mac.
App: `dev.souschef.app`, Release configuration, embedded bundle, `__DEV__` false.
API: local dev at `localhost:4000`. Collector: Mimir `192.168.1.208:9009`,
Loki `192.168.1.208:3100`.

## SUPERSEDED for `app_fully_drawn_ms` — read before reusing these numbers

Every `app_fully_drawn_ms` figure below was captured **before** the startup
instrumentation was repaired, and does not compare with anything measured after
it. Three defects were in force when these numbers were taken:

- The metric latched on the Pantry's **skeleton** frame, not on content.
  `PantryContent` hands FlashList a one-row sticky-header sentinel while
  loading, which satisfies FlashList's `onLoad` immediately — so the recorded
  interval covers the chrome, not the frame where items appear.
- The origin was recorded **after** `i18n/config`, `apollo/config` and
  `theme/unistyles` had evaluated. Metro's `experimentalImportSupport` hoists
  every `require` above all top-level statements, so `index.js`'s timestamp
  statement ran last, and the metric excluded that module-evaluation work while
  being documented as measuring from JS-bundle entry.
- The capture script read each metric with no freshness guard, so a launch that
  emitted nothing could record the previous launch's carried-forward sample.
  `Math.max` across label sets then made the per-run value non-decreasing.

The other metrics here (`app_content_appeared_ms`, `app_native_launch_ms`,
`app_js_bundle_load_ms`) are unaffected by the first two defects but were read
through the same unguarded query, so treat any single run as suspect and the
run-to-run spread as unreliable.

Re-baseline before comparing a build against this document.

## Read this before comparing anything to the Android numbers

**An iOS simulator is not the counterpart of an Android emulator.** The Android
emulator runs a full guest OS and *understates* real hardware — the audit
measured `flashlist_initial_load_ms` at 40 ms on a Pixel_9a emulator and
301-934 ms on an SM-S908U1. The iOS simulator does not emulate a CPU at all: it
runs arm64 code natively on the Mac's own cores, with the Mac's memory and disk.
It therefore **overstates** what any real iPhone does, in the opposite direction
and by an unknown factor.

So: these numbers are for comparing iOS against iOS, build over build. Putting
one beside an Android figure measures the two host machines, not the two
platforms. The same caution the Android audit applies to its emulator applies
here more strongly, because the error has the opposite sign and is easy to read
as "iOS is faster".

Two further origin caveats, both already in `docs/telemetry-setup.md`:

- `nativeLaunchStart` is derived from elapsed **CPU** time on iOS
  (`clock_gettime(CLOCK_THREAD_CPUTIME_ID)`), exactly as Android derives it from
  `Process.getElapsedCpuTime()`. Time spent descheduled is excluded on both, so
  every `nativeLaunchStart`-based number understates real elapsed time.
- iOS **prewarming** can begin a launch long before the user taps, and nothing
  segments those launches. Treat iOS outliers as suspect rather than signal.

## What iOS has, and what it cannot have

The metric pipeline is platform-agnostic: `NativePerformanceService` is a pure-JS
consumer of marks that `react-native-performance` emits from
`RNPerformanceManager.mm` on iOS exactly as `PerformanceModule.java` does on
Android. Every startup histogram, `screen_*` and `flashlist_*` metric emits on
iOS with no platform branch.

| Capability | iOS | Note |
|---|---|---|
| The startup histograms, `screen_*`, `flashlist_*` | Yes | Same code path as Android |
| Hermes startup CPU profile | Yes, added 2026-08-25 | `ios/SousChef/StartupMarkModule.mm`, verified end to end |
| View-manager probe report | File writes, but **always empty** | The global it wraps does not exist on iOS — see below |
| Frame-timeline capture | Yes, added 2026-08-25 | `scripts/ios-frame-sample.mjs` |
| OS-side fully-drawn marker | **No, and cannot be** | See below — the frame sampler substitutes, and now agrees |

**There is no iOS counterpart to `Activity.reportFullyDrawn()`.** No Apple API
accepts an app-declared "fully drawn" signal. The substitute is an `os_signpost`
interval read back by `XCTOSSignpostMetric`, which needs an XCUITest target to
consume it, and this project has no test target at all.

The consequence is not cosmetic. The Android baseline's confidence in
`app_fully_drawn_ms` rests on **two independent methods agreeing** — the OS
marker in logcat, and a frame-capture loop — which they did to within ±36 ms.
On iOS only the second method exists, so that agreement result **does not carry
over** and has to be re-established against the frame sampler alone.

## Build and capture protocol

iOS needs no `localRelease`-style variant. Android needed one because its release
variant still loaded dev JS from Metro (`perf-offline-baseline-2026-08-24.md:8-26`);
`AppDelegate.swift` picks the embedded bundle under `#if !DEBUG`, so Release is
release for JS. What iOS needs instead is `.env`, for reasons that are all
silent when missing:

- No `.env` → `OTLP_METRICS_ENDPOINT` undefined → `transports.http` false → the
  run emits **zero metrics and no error**.
- No `NODE_ENV` → a Release build resolves to `production` → the app measures
  against the **production API**, and `useStartupInit` stops reading Detox launch
  args, so `E2E_TELEMETRY` and the injected auth tokens are both ignored.

**The startup numbers and the per-screen numbers come from different drivers,
and must not be mixed.** Detox inflates `app_content_appeared_ms` 2.53x — see
"Detox inflates the startup metrics" below for the measurement.

```bash
# 1. Build (first one is cold, ~10-20 min)
npm run test:e2e:build:release

# 2. Sign in and dismiss tutorials ONCE. Both persist for the install; a
#    SpotlightCoachMark mounting inside the measured window inflates
#    app_fully_drawn_ms, and its overlay also blocks every Detox tap.
E2E_TELEMETRY=1 npm run test:e2e:release -- e2e/tests/ui-tour.e2e.ts

# 3. COLD-START numbers — simctl, not Detox. n=5, medians.
node scripts/ios-capture-baseline.mjs --runs 5 --items <count>

# 4. PER-SCREEN numbers — Detox, because it is the only thing that
#    deterministically visits every surface. Record separately from step 3.
E2E_TELEMETRY=1 npm run test:e2e:release -- e2e/tests/ui-tour.e2e.ts

# 5. Frame timeline, as the cross-check on app_fully_drawn_ms
node scripts/ios-frame-sample.mjs --device "iPhone 17" --seconds 10

# 6. Attribution — a SEPARATE run: a profiled pass deliberately emits no
#    app_fully_drawn_ms, so it cannot be combined with step 3.
#    Set HERMES_PROFILE_STARTUP=true in .env, rebuild, launch, then:
xcrun simctl get_app_container booted dev.souschef.app data   # trace in Documents/
```

Four things to check every time, each of which fails quietly:

1. **Token injection, not UI login.** `bootstrapAuthenticatedSession` falls back
   to a UI login if injection fails, which puts a whole login flow inside the
   measured window. The Detox log says which happened; the release artifacts are
   kept on a pass specifically so this is checkable.
2. **`HERMES_PROFILE_STARTUP` took.** Verify by BEHAVIOUR — did a `.cpuprofile`
   appear, and did `app_fully_drawn_ms` get no new sample? Both must hold; either
   alone means the flag half-took. Never verify a flag flip by the build
   succeeding. (Android hit this twice, in two different ways.)
3. **Read per session.** Each cold start is a new process, so `_count` is 1 and
   `sum(...) by (screen)` across launches is meaningless. To tell a fresh write
   from Prometheus carrying the last value forward for five minutes, use
   `timestamp(<metric>_count{platform="ios"})`, never a range query.
4. **Turn `HERMES_PROFILE_STARTUP` back off afterwards**, and confirm THAT by
   behaviour too: no trace written, and `app_fully_drawn_ms` writing again. A
   build left with profiling on silently emits no histogram at all.

### Build gotcha found while wiring the native module

`xcodeproj`'s `group.new_reference('StartupMarkModule.mm')` writes a reference
whose path is relative to the **project directory**, not to the group — and this
project's `SousChef` group has no `path` of its own, so every sibling carries an
explicit `path = SousChef/<file>` with `name = <file>`. The generated reference
therefore pointed at `ios/StartupMarkModule.mm`, and the build failed with
"Build input file cannot be found" while the file sat correctly in
`ios/SousChef/`. The give-away is in the `CompileC` line, which names the path
Xcode actually resolved.

Matching the sibling convention (`name` + `path = SousChef/…`) fixes it. Worth
recording because the failure names a missing file rather than a wrong
reference, which points the investigation at the filesystem instead of at the
pbxproj.

**Record the pantry item count next to every number.** Apollo's
`diffQueryAgainstStore` walks every item in the connection, so a dataset
difference reads as a device difference — the Android audit withdrew a
component-cost comparison over exactly this (`:1110-1148`).

## First iOS session ever recorded — pipeline proof, NOT the baseline

`iPhone 17` simulator, Release, app 4.3.9, signed in, local API up, **n=1**.
Provenance was checked rather than assumed: `app_starts_total{platform="ios"}`
is 1 and the series has a single sample, so every figure below comes from one
launch and no earlier iOS run is mixed in. (It could not be: before this session
there was no `.env`, so no iOS build could ever have exported anything.)

| Metric | Value |
|---|---|
| `app_native_launch_ms` | 221 ms |
| `app_js_bundle_load_ms` | 80 ms |
| `app_content_appeared_ms` | 396 ms |
| `app_js_entry_to_store_ready_ms` | 66 ms |
| `app_startup_duration_ms` | 125 ms |
| `app_apollo_restore_ms` | 0 ms |
| `app_fully_drawn_ms` | **1116 ms** |
| `flashlist_initial_load_ms` (PantryContent) | 35 ms |
| `screen_interactive_duration_ms` (PantryMain) | 50.1 ms |
| `screen_mount_duration_ms` (PantryMain) | 0 ms |

**Do not quote these as the baseline.** Four things are wrong with them as a
baseline, and each is fixable by re-running rather than by changing anything:

1. **n=1.** This project has already been burned by reading a handful of
   samples: PantryMain's interactive time looked like a stable 580 ms and turned
   out to be bimodal at 50/60/573 ms. One sample cannot show that. (A second run
   below promptly halved `app_fully_drawn_ms`.)
2. **Cold Apollo cache.** `app_apollo_restore_ms` is 0 ms and 13 GraphQL
   operations ran during the window, so this launch fetched rather than
   restored. The Android baseline is a WARM-cache launch. This is a different,
   slower condition, and `app_fully_drawn_ms` is the metric it distorts most.
3. **A first-run tutorial overlay was on screen** ("Tap to manage homes"),
   mounting extra UI inside the measured window.
4. **The pantry item count was not recorded**, which this document's own rule
   requires — see the dataset confound below.

What it does establish, which is the point of running it: the whole chain works
on iOS. Release build → OTLP over plaintext HTTP to a private-range host → Mimir,
with `platform="ios"`. ATS permitted the plaintext collector exactly as
`NSAllowsLocalNetworking` predicted, so no TLS is needed for a LAN collector.

Note `device_type="emulator"` on every iOS series: `TelemetryService.ts:57`
derives it from `isEmulatorSync()`, which is true for a simulator, so on iOS the
label reads "emulator" and means "simulator". Not a bug, but it means
`device_type` alone does not distinguish an iOS simulator from an Android
emulator — always pair it with `platform`.

### Second launch, warm cache — the cold-cache caveat above was worth making

A second unprofiled launch on the same install, cache now warm
(`app_apollo_restore_ms` 4 ms and 5 GraphQL operations, against 0 ms and 13):

| Metric | Cold cache (run 1) | Warm cache (run 2) |
|---|---|---|
| `app_native_launch_ms` | 221 ms | 215 ms |
| `app_js_bundle_load_ms` | 80 ms | 61 ms |
| `app_content_appeared_ms` | 396 ms | 333 ms |
| `app_startup_duration_ms` | 125 ms | 90 ms |
| `app_apollo_restore_ms` | 0 ms | 4 ms |
| **`app_fully_drawn_ms`** | **1116 ms** | **554 ms** |
| `flashlist_initial_load_ms` | 35 ms | 54 ms |
| `screen_interactive_duration_ms` (PantryMain) | 50.1 ms | 67.1 ms |

**`app_fully_drawn_ms` halved.** That is the whole reason the run-1 figure was
flagged rather than published: at n=1 it would have entered the record as "iOS
cold start is ~1.1 s", and half of that number was cache state, not the platform.

Still n=2, so still not a baseline — but two things are already visible and
worth carrying into the real capture:

- `app_native_launch_ms` is the stable one (221 / 215 ms). It is also the metric
  that says least, being pre-JS and CPU-time-derived.
- The metrics that move most between runs are exactly the ones downstream of
  data: `app_fully_drawn_ms`, `flashlist_initial_load_ms`, PantryMain's
  interactive time. Note the last two moved the OPPOSITE way to
  `app_fully_drawn_ms` — cache state is not a single dial, and n=2 cannot say
  which direction is real. Equalise the cache AND record the item count before
  reading anything into them.

### Detox inflates the startup metrics — do NOT take cold-start numbers from a Detox run

Third launch, same install, cache warm, but driven by
`E2E_TELEMETRY=1 detox test -c ios.sim.release e2e/tests/ui-tour.e2e.ts`
instead of `xcrun simctl launch`. Same build, same device, same session:

| Metric | `simctl launch` | Detox | ratio |
|---|---|---|---|
| `app_native_launch_ms` | 215 ms | 372 ms | 1.73x |
| `app_js_bundle_load_ms` | 61 ms | 114 ms | 1.87x |
| **`app_content_appeared_ms`** | **333 ms** | **843 ms** | **2.53x** |
| `app_fully_drawn_ms` | 554 ms | 644 ms | 1.16x |
| `flashlist_initial_load_ms` | 54 ms | 116 / 120 ms | ~2.2x |
| `app_startup_duration_ms` | 90 ms | 85 ms | 0.94x |

Detox attaches its own instrumentation to the process and drives launch through
XCUITest, and that cost lands squarely in the pre-JS and first-frame window.
Note `app_startup_duration_ms` is the one metric that does NOT move: it is
measured from JS-bundle entry, downstream of everything Detox adds.

**Consequence for the protocol — this supersedes the "use ui-tour" step above:**

- **Cold-start numbers** (`app_native_launch_ms`, `app_js_bundle_load_ms`,
  `app_content_appeared_ms`, `app_fully_drawn_ms`) come from `xcrun simctl
  launch`. That is also what makes them the closest available analogue to
  Android's `am start -W` figures, which were likewise taken outside any test
  harness.
- **Screen-level metrics** (`screen_interactive_duration_ms` per screen,
  `flashlist_*`) come from Detox, because it is the only thing that
  deterministically visits every surface. The Detox run is what produced
  interactive times for all five screens at once — PantryMain 75.5 ms,
  ShoppingListMain 34.2 ms, RecipeMain 16.0 ms, MealPlanMain 14.6 ms,
  ProfileScreen 10.5 ms — which no hand launch was going to do.
- **Never put the two in one table**, and never compare a Detox iOS number with
  a non-Detox Android one. Two of the three runs recorded here would have been
  read as a regression against the third purely because of how they were driven.

### The Detox release path had never been run, and it failed the first time

`ios.sim.release` was configured but unreferenced by any script or workflow, so
this was its first execution. It failed, and the failure is worth recording
because it does not describe itself:

> Test Failed: View is not hittable at its visible point. Error: Failed to hit
> view with identifier `tab-pantry`

The screenshot shows `tab-pantry` plainly visible. What is not obvious is that a
`SpotlightCoachMark` tutorial was up, and it renders a full-screen dimming
overlay that takes every tap. Detox reports the tap target as unhittable, which
reads as a layout bug rather than an overlay.

Root cause is an exact-match miss: `by.text` matches exactly, and
`SpotlightCoachMark` renders `labels.skipAll` -> **"Skip all"** whenever
`totalSteps > 1`, so a dismissal list containing only `'Skip'` never matched the
multi-step case. Fixed in `e2e/tests/ui-tour.e2e.ts` with a
`dismissTutorialIfPresent()` that tries `'Skip all'`, then `'Skip'`, then the
accessibility label `'Skip tutorial'` (the button has no testID), called before
every tab tap because each surface can raise its own tutorial.

This also explains the tutorial overlay noted in runs 1 and 2: both carried a
coach mark mounting inside the measured window. Tutorial state persists once
dismissed, so runs from here are clean — and that is one more reason those two
`app_fully_drawn_ms` figures are not the baseline.

`.detoxrc.js` also had `keepOnlyFailedTestsArtifacts: true` on this
configuration, so a PASSING measuring run kept nothing. Now false — the log is
where the token-injection vs UI-login path is visible, which is what decides
whether a sample is a clean signed-in cold start.

## Hermes startup profiler on iOS — works, verified in both directions

Run 2026-08-25, `HERMES_PROFILE_STARTUP=true`, Release, signed in. Both halves
of the check hold, and both were needed — either alone would have been
consistent with the flag only half-taking. The flag was then turned back off and
the OFF direction verified the same way: no trace written, and
`app_fully_drawn_ms` wrote a fresh sample 11 s after relaunch.

1. **A trace appeared.** `Documents/startup.cpuprofile`, 822 KB, 2987 stack
   frames, 38 samples over a 557 ms window, symbolicated with source URLs.
   Retrieved with `xcrun simctl get_app_container booted dev.souschef.app data`.
2. **`app_fully_drawn_ms` got no new sample.** Checked with
   `timestamp(app_fully_drawn_ms_count{platform="ios"})`, which returns the
   sample's own write time: 15:33:55, i.e. the PREVIOUS unprofiled session,
   while `app_content_appeared_ms_count`, `app_native_launch_ms_count` and
   `app_starts_total` all wrote at 15:35:42 from the profiled run.

**Use `timestamp()`, not `query_range`, for this check.** A range query appears
to show a fresh `app_fully_drawn_ms` sample because Prometheus carries the last
value forward for five minutes, so the terminated session's value looks live.
That reading says the suppression failed when it did not.

Because `markFullyDrawn()` is the only thing that writes the trace, the trace
existing is also independent proof that the call site fired — so the profile's
window IS `app_fully_drawn_ms`'s window, by construction, exactly as on Android.

The 38 samples over 557 ms (~68 Hz against a 100 Hz nominal rate) are far too
thin to attribute anything. `getEnforcing` — TurboModule lookup — leads self
time at 14 of 38 samples, which is a **lead to test, not a finding**: at n=38 it
is one or two scheduling accidents away from noise.

### The view-manager probe does NOT port to iOS, and cannot

`viewmanagers.json` was written but is empty: `{"totalMs":0,"count":0,"rows":[]}`.
This is not a bug in the probe. `instrumentViewManagerConstants()` wraps
`global.RN$LegacyInterop_UIManager_getConstantsForViewManager`, and on iOS that
global is installed only when
`ReactNativeFeatureFlags::useNativeViewConfigsInBridgelessMode()` is true
(`RCTInstance.mm:457-459`). That flag **defaults to false**
(`ReactNativeFeatureFlagsDefaults.h:354-356`), so the binding is never installed
and the probe's `typeof original !== 'function'` guard bails.

The consequence is a real platform difference, not a tooling gap: **iOS does not
take the code path the Android investigation found to be disproportionately
expensive.** The Android profile's standout was UIManager view-manager constants
at 3.29x the hardware gap, with `react-native-svg` owning 29 of 48 managers —
queried synchronously at module-import time through exactly this legacy-interop
global. On iOS, view configs come from the static native component registry
instead, so that cost has no iOS counterpart to measure. Do not go looking for
it here, and do not read its absence as iOS being faster; it is a different
mechanism, not a faster one.

## Two-method agreement on iOS — established 2026-08-25

Android's confidence in `app_fully_drawn_ms` rests on two independent methods
agreeing (OS marker vs frame capture, +/-36 ms). iOS has no OS marker, so that
result could not carry over and had to be re-established against the frame
sampler alone. It now has been, on a SINGLE launch measured both ways:

| Method | Value |
|---|---|
| `app_fully_drawn_ms` (JS entry -> first list painted) | 490 ms |
| Frame capture (launch anchor -> settled plateau) | 411 ms |
| Difference | 79 ms |
| Sampling resolution that run | 180 ms median |

**79 ms is smaller than one sampling interval, so the two cannot be
distinguished — which is exactly what agreement means here, and no more.** The
clocks do not share an origin (JS entry against the first blank frame), so they
were never going to reconcile exactly; the claim is that they do not disagree at
a resolution this instrument can see. Android's +/-36 ms came from a finer
instrument. n=1 per method.

That is enough to treat `app_fully_drawn_ms` as measuring what it claims on iOS,
which was the open question. It is not enough to treat 490 ms as a baseline.

### Two bugs the sampler had, found by running it

Neither showed up in review; both needed real frames.

1. **The pre-launch frame owned the scale.** The first frames can still show
   what was on screen before the launch, and that frame was the LARGEST of the
   run — 3.21 MB against a 776 KB settled frame. Deriving bands from the run's
   min/max therefore put real settled content in a middle band and classified
   the pre-launch frame as "settled", so the tool reported the load finishing at
   174 ms when the app had not started. Fixed by anchoring to the blankest frame
   (the splash) and dropping everything before it.
2. **Relative bands cannot answer "when did it finish".** The tallest frame is
   always the top band even if the screen was still filling in. What actually
   marks the end of a load is the frame size going FLAT — it held 776,027 bytes
   for seven seconds here. Settle detection is now a plateau test (median of the
   final quarter, first frame within 5% that stays within 5%), not a band.

## THE BASELINE — n=5, 2026-08-25

`iPhone 17` simulator, Release (`__DEV__` false, embedded bundle), app 4.3.9,
signed in, warm cache, tutorials dismissed, local API up, **63 pantry items** —
the same item count as the Android runs, so the dataset confound is controlled.
Driven by `xcrun simctl launch`, NOT Detox. Captured with
`node scripts/ios-capture-baseline.mjs --runs 5 --items 63`.

| Metric | median | min | max | spread |
|---|---|---|---|---|
| `app_native_launch_ms` | **220 ms** | 216 | 228 | ±3% |
| `app_js_bundle_load_ms` | **47 ms** | 46 | 58 | tight |
| `app_content_appeared_ms` | **322 ms** | 315 | 343 | ±4% |
| `app_js_entry_to_store_ready_ms` | **34 ms** | 34 | 44 | tight |
| `app_apollo_restore_ms` | **5 ms** | 5 | 5 | flat |
| `app_startup_duration_ms` | **74 ms** | 72 | 83 | tight |
| `app_fully_drawn_ms` | **450 ms** | 343 | 513 | **±19%** |
| `flashlist_initial_load_ms` | **54 ms** | 50 | 60 | tight |

Per-run values in `e2e/artifacts/ios-baseline.json`.

### What the distribution says

**Seven of the eight metrics are tight; `app_fully_drawn_ms` is not.** Its five
samples were 513 / 343 / 450 / 448 / 472 — a 170 ms range against a 450 ms
median. That is the metric that depends on the network round trip and the list
actually painting, so it is the one carrying real variance rather than
measurement noise. **A build-over-build comparison of `app_fully_drawn_ms` needs
n>=5 and should be read as medians; a single sample cannot see a change smaller
than ~170 ms.** Every other metric here is stable enough to compare directly.

`app_apollo_restore_ms` being flat at 5 ms across all five runs confirms the
cache was genuinely warm and identical each time — the condition the earlier
cold-cache run (0 ms restore, 13 GraphQL ops, `app_fully_drawn_ms` 1116 ms) did
not meet.

### Internal consistency check on the tutorial confound

The two earlier ad-hoc runs are now placeable against this distribution, and
they fall exactly where the tutorial story predicts:

- `app_content_appeared_ms` 333 ms sits INSIDE the baseline range (315-343).
  That metric is RN's first frame, which the tutorial cannot affect — it mounts
  after.
- `app_fully_drawn_ms` 554 ms sits ABOVE the baseline max (513). That metric
  waits for the first list to paint, which is exactly what a coach mark mounting
  in the same window delays.

A confound that moves one metric and not the other, in the direction its
mechanism predicts, is better evidence than either number alone.

## Still to capture

Nothing blocking. The remaining items are optional depth, not gaps:

- A profiled pass for bucket attribution — but see the sample-count caveat
  above; the profiler needs its window checked before it can attribute anything.
- Per-screen metrics for the other four screens come from the Detox run and are
  recorded there, deliberately not merged into the table above.

**Scope: simulator only.** No physical-device leg is planned (decided
2026-08-25). Everything here therefore overstates real iPhone performance by an
unmeasured factor, and is valid ONLY as an iOS-to-iOS, build-over-build series.
The Android investigation's emulator-to-device gap was 1.75x, which is the order
of magnitude to expect but not a number to apply — it was measured on different
hardware, for a different platform.

## Instrument resolution

`scripts/ios-frame-sample.mjs` measured **176 ms median** per screenshot on this
Mac (n=20, min 159, max 351), against 130-160 ms for the Android emulator loop
and ~450 ms for the phone. Usable at the ~2 s scale of a cold start; not usable
below ~200 ms. The script reports the achieved interval per run rather than
trusting this figure. Finer resolution means `xcrun simctl io recordVideo` plus
ffmpeg, which is not a dependency of this repo.
