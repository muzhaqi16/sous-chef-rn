# Telemetry & Monitoring Setup

## Architecture

The app sends both metrics and logs using **OTLP (OpenTelemetry Protocol)** over HTTP. Each has its own endpoint and auth, making it easy to swap backends without code changes.

```
React Native App
  |
  |-- OTLP /v1/metrics --> [Metrics Backend] --> Grafana
  |                         (Mimir / Prometheus)
  |
  |-- OTLP /v1/logs ----> [Logs Backend] -----> Grafana
                           (Loki)
```

**Key design decision:** Both metrics and logs use OTLP format, not vendor-specific APIs. This means you can point them at any OTLP-compatible receiver (Grafana Cloud, Grafana Alloy, self-hosted Mimir, OpenTelemetry Collector, etc.) by changing env vars alone.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OTLP_METRICS_ENDPOINT` | Base URL for the metrics OTLP receiver (Prometheus / Mimir). App appends `/v1/metrics`. |
| `OTLP_METRICS_AUTH_USERNAME` | Basic auth username for the metrics endpoint (instance ID for Grafana Cloud). Leave empty for no auth. |
| `OTLP_METRICS_AUTH_PASSWORD` | Basic auth password for the metrics endpoint (API token for Grafana Cloud). |
| `OTLP_LOGS_ENDPOINT` | Base URL for the logs OTLP receiver (Loki). App appends `/v1/logs`. |
| `OTLP_LOGS_AUTH_USERNAME` | Basic auth username for the logs endpoint. |
| `OTLP_LOGS_AUTH_PASSWORD` | Basic auth password for the logs endpoint. |
| `GRAPHQL_TELEMETRY_SAMPLE_RATE` | Fraction (0-1] of GraphQL operations that carry telemetry. Currently `1.0` in every environment. See § GraphQL sampling below. |

Auth is **credential-presence-based**: if username + password are set, Basic auth headers are sent. If either is empty, no auth header is attached. This works for both cloud (auth required) and self-hosted (auth often not needed) setups.

Prometheus and Loki on Grafana Cloud are separate stacks with their own **numeric instance IDs and `glc_` tokens** — set `OTLP_METRICS_AUTH_*` and `OTLP_LOGS_AUTH_*` independently. Self-hosted deployments behind a single OTLP collector can reuse the same credential pair on both sides.

**Important:** `react-native-config` bakes env vars into the native binary at build time. After changing any `OTLP_*` variable, you must do a **full native rebuild** (`npx react-native run-android` / `run-ios`). A Metro reload alone will not pick up the changes.

## Grafana Cloud Setup

### 1. Find your OTLP endpoint and instance ID

Go to **Grafana Cloud > Your Stack > OpenTelemetry (OTLP)** connection details page.

- **Endpoint:** `https://otlp-gateway-prod-us-east-2.grafana.net/otlp` (your region may differ)
- **Instance ID:** numeric value shown on the page (e.g., `1564351`)

### 2. Create an API token

Go to **Grafana Cloud > Access Policies**:

1. Create a new access policy (or edit an existing one)
2. Add scopes: **`metrics:write`** and **`logs:write`**
3. Set the realm to your stack name
4. Generate a token under this policy (starts with `glc_`)

### 3. Configure env vars

Each stack (Prometheus / Loki) has its own OTLP receiver, instance ID, and token:

```bash
# .env — Prometheus / Mimir stack
OTLP_METRICS_ENDPOINT=https://prometheus-prod-XX-prod-us-east-2.grafana.net/api/prom
OTLP_METRICS_AUTH_USERNAME=1564351            # Prometheus stack instance ID
OTLP_METRICS_AUTH_PASSWORD=glc_prom_token_here

# .env — Loki stack (separate instance + token)
OTLP_LOGS_ENDPOINT=https://logs-prod-036.grafana.net
OTLP_LOGS_AUTH_USERNAME=1522140               # Loki stack instance ID
OTLP_LOGS_AUTH_PASSWORD=glc_loki_token_here
```

If you instead use the **shared OTLP gateway** (`https://otlp-gateway-prod-us-east-2.grafana.net/otlp`) with a single composite token, point both endpoints at the gateway and set the same `OTLP_*_AUTH_USERNAME` / `OTLP_*_AUTH_PASSWORD` on both sides.

### 4. Import dashboards

In Grafana Cloud:

1. Go to **Dashboards > Import**
2. Upload each JSON file from `infra/grafana/dashboards/`:
   - `sous-chef-overview.json` - App health overview
   - `sous-chef-api.json` - GraphQL API performance
   - `sous-chef-performance.json` - Render times, memory, startup
   - `sous-chef-analytics.json` - User engagement and events
3. When prompted, select your Prometheus (Mimir) datasource for `DS_PROMETHEUS`
4. For dashboards with log panels, also select your Loki datasource for `DS_LOKI`

## Self-Hosted Setup

To switch from Grafana Cloud to self-hosted infrastructure, only env vars need to change:

### Option A: Grafana Alloy (recommended for self-hosted)

Alloy acts as an OTLP receiver and forwards to Mimir + Loki:

```bash
OTLP_METRICS_ENDPOINT=https://alloy.your-infra.com/otlp
OTLP_METRICS_AUTH_USERNAME=
OTLP_METRICS_AUTH_PASSWORD=

OTLP_LOGS_ENDPOINT=https://alloy.your-infra.com/otlp
OTLP_LOGS_AUTH_USERNAME=
OTLP_LOGS_AUTH_PASSWORD=
```

### Option B: Direct to Mimir + Loki

Point each endpoint at its own backend with its own credential pair:

```bash
OTLP_METRICS_ENDPOINT=https://mimir.your-infra.com/otlp
OTLP_METRICS_AUTH_USERNAME=mimir-user
OTLP_METRICS_AUTH_PASSWORD=mimir-token

OTLP_LOGS_ENDPOINT=https://loki.your-infra.com/otlp
OTLP_LOGS_AUTH_USERNAME=loki-user
OTLP_LOGS_AUTH_PASSWORD=loki-token
```

Mimir supports OTLP ingestion natively. For Loki, ensure you're running Loki 3.0+ which supports the OTLP `/v1/logs` endpoint.

### Option C: OpenTelemetry Collector

Any standard OTel Collector with `otlpreceiver` can accept the app's telemetry:

```bash
OTLP_METRICS_ENDPOINT=https://otel-collector.your-infra.com
OTLP_LOGS_ENDPOINT=https://otel-collector.your-infra.com
```

**No code changes needed for any of these options.**

## Verifying the Pipeline

### Test script (without the app)

```bash
# Send a test metric directly via curl:
source .env
AUTH_PASSWORD=$OTLP_METRICS_AUTH_PASSWORD \
AUTH_USERNAME=$OTLP_METRICS_AUTH_USERNAME \
./infra/grafana/test-otlp.sh
```

Then query in Grafana Explore (Prometheus datasource):
```
{__name__="test_otlp_ping_total", service_name="sous-chef-app"}
```

### From the running app

After a native rebuild, watch Metro logs for:
- `Metrics sent via OTLP (N metrics)` - metrics are flowing
- `Logs sent via OTLP (N entries)` - logs are flowing
- `Failed to send metrics via OTLP: { status: 401 ... }` - auth issue

In Grafana Explore, query:
- Metrics: `{service_name="sous-chef-app", env="development"}`
- Logs: `{service_name="sous-chef-app"}`

## Metric Reference

### Labels every metric carries

`TelemetryService` attaches these to EVERY counter, gauge and histogram, on top
of whatever the call site passes. A call-site label of the same name wins.

(Deliberately not a table — the metric-contract test scrapes backticked first
columns as metric names, and these are labels, not metrics.)

- **platform** — `ios` / `android`. Two values.
- **env** — the configured environment. A handful of values.
- **version** — the build's version string, bounded by release cadence. Without
  it NOTHING on a metric said which build produced it: the only version-bearing
  dimension was `service.instance.id`, and every startup panel collapsed it with
  `sum(...) by (le)`, so a regression could not be attributed to a release even
  in principle.
- **device_type** — `emulator` / `physical`. Exactly two values. Measured
  2026-08-25 the two disagree by 1.4-2x on startup marks and by **10-20x** on
  `flashlist_initial_load_ms`; without this label they are the SAME series,
  because `instance` is only `android_<version>`. The dashboard exposes it as
  the `$device_type` variable and splits the startup panels by it — **a label
  nothing filters on is not a separation**, which is how it shipped the first
  time.

**The commit SHA is deliberately NOT a metric label.** Every unique label
combination is a Prometheus series, multiplied again by histogram buckets, and a
SHA is unbounded — the textbook cardinality bomb. It travels on LOGS instead, as
the `git_sha` body field (searchable with `| json | git_sha="..."`), which is
where per-run identity already lives.
`src/services/telemetry/__tests__/TelemetryService.test.ts` holds that line from
both sides.

### Counters

| Metric | Labels | Description |
|--------|--------|-------------|
| `app_events_total` | `event_name`, `method` | User events (login, add_item, etc.) |
| `app_errors_total` | `component`, `operation`, `is_fatal` | Application errors |
| `app_starts_total` | | App launch count |
| `screen_views_total` | `screen_name` | Screen navigation |
| `unhandled_promise_rejections_total` | | Unhandled promise rejections |
| `app_memory_warnings_total` | | Memory > 80% threshold |
| `app_memory_critical_total` | | Memory > 95% threshold |
| `graphql_requests_total` | `name`, `type` | GraphQL operations |
| `graphql_errors_total` | `name` | GraphQL errors |
| `graphql_network_errors_total` | | Network-level GraphQL failures |
| `graphql_slow_queries_total` | | Queries > 1s |
| `component_render_count` | `component` | Commits per component (re-render churn) |
| `slow_screen_transitions_total` | `screen` | Transitions > 500ms. Threshold-gated: read durations from `screen_interactive_duration_ms`, never from this counter's labels. |
| `offline_queue_permanent_failures_total` | | Queued writes the client gave up on |
| `apollo_client_errors_total` | `operation`, `type` | Apollo error surfaced to a hook. `type` is `cache` or `graphql`. |
| `app_level_errors_total` | | Error caught by the outermost `AppErrorBoundary`. |
| `auth_errors_total` | | Error caught by the auth-screen error boundary. |
| `navigation_errors_total` | | Error caught by the navigation error boundary. |
| `onboarding_errors_total` | | Error caught by the onboarding error boundary. |
| `pantry_errors_total` | | Error caught by the pantry error boundary. |
| `recipe_detail_errors_total` | | Error caught by the recipe-detail error boundary. |
| `shopping_list_errors_total` | | Error caught by the shopping-list error boundary. |
| `app_unhandled_exceptions_total` | `fatal` | Global JS exception handler. `fatal` is `"true"`/`"false"` as a string. |
| `flashlist_blank_cells_total` | `component` | Blank EPISODES, not evaluations - a transition into "a visible index has no mounted cell". Counts from mounted cells since 2026-08-20; older blank percentages were a 250 ms viewability artifact and are not comparable. Since 2026-08-26, emitted only by the ~5% of release sessions whose per-cell instrumentation sampling armed (`flashListInstrumentationSampleRate`) - the per-cell wrapper costs real mount time on the initial paint path. |
| `flashlist_data_reference_changes` | `component` | The list's `data` array changed identity. Two trackers feed this per list (raw + sorted), so it counts both. |
| `offline_queue_drain_started_total` | | A queue drain actually began. |
| `offline_queue_drain_skipped_total` | `reason` | A drain was requested and declined - `already_processing`, no authenticated user, API unavailable. Pair with `_started_total` to see whether writes are replaying at all. |
| `offline_queue_conflicts_total` | `operation` | A replayed mutation came back as a conflict. |
| `offline_queue_auth_parked_total` | `operation` | A queued write was parked because the token could not be refreshed. NOT a rejection - the server never saw it; it is revived on the next sign-in. |
| `reconnect_backfill_queries_total` | | Active queries refetched after an outage ended. Incremented by the number refetched, so it is a volume, not an event count. |
| `storage_recovery_instance_used` | | The device key was unavailable and the session fell back to unencrypted recovery storage. Any non-zero value means encrypted data was not readable that launch. |
| `offline_reads_served_total` | `operation` | A query was answered entirely from cache because the network leg was unwanted or doomed (offline mode, device offline, or the reachability breaker open). The offline promise working. |
| `offline_reads_probed_total` | `operation` | Cache miss while the breaker was open but the device is online, so the request was forwarded as an organic probe rather than blocked. |
| `offline_reads_blocked_total` | `operation` | Cache miss with no network leg — the user saw *"This isn't available offline yet"*. **The one that means the offline promise failed.** A rising rate names the operation whose cached shape is incomplete for the screen reading it, which is what the optimistic-completeness invariant exists to prevent. Until these existed the whole offline READ path was invisible in release: `offlineModeLink` logged with `logger`, which is console-only. |

### Gauges

| Metric | Labels | Description |
|--------|--------|-------------|
| `app_memory_used_bytes` | `source` | Current memory usage |
| `app_memory_limit_bytes` | | Device memory limit |
| `app_memory_usage_percent` | | Memory usage percentage |
| `cache_persist_size_kb` | | Serialized Apollo cache size written to MMKV |
| `apollo_cache_edge_count` | `field` | Edges held by a cached connection after merge |
| `offline_queue_depth` | | Writes waiting to replay |

### Histograms

| Metric | Labels | Description |
|--------|--------|-------------|
| `app_startup_duration_ms` | | Full app startup time |
| `app_native_launch_ms` | | Native platform init time |
| `app_js_bundle_load_ms` | | Hermes bytecode load time |
| `screen_interactive_duration_ms` | `screen` | Navigation focus -> one frame after the screen's effects run. The ONLY screen-timing metric; its floor is a frame, so an already-mounted screen reads ~15-20 ms and only real mount work rises above that. `screen_mount_duration_ms` and `screen_transition_duration_ms` were removed: the first timed two effects in the same commit and read ~0 on every screen, the second was measured from the identical marks as this one. |
| `component_commit_gap_ms` | `component` | Wall time since the component's previous commit. NOT render cost - it includes idle time. |
| `http_request_duration_ms` | `host` | HTTP request duration |
| `graphql_request_duration_ms` | `name` | GraphQL operation duration |
| `app_content_appeared_ms` | | **First frame.** `nativeLaunchStart` to React Native's own content-appeared signal (`RCTContentDidAppearNotification` on iOS, `ReactMarker.CONTENT_APPEARED` on Android), so it means the same thing on both. This is TTID-shaped: RN's root view is mounted, which says nothing about whether the screen's data has loaded - use `app_fully_drawn_ms` for that. **Origin caveat, BOTH platforms:** `nativeLaunchStart` is derived from elapsed CPU time, not wall clock - `clock_gettime(CLOCK_THREAD_CPUTIME_ID)` on iOS, `endTime - Process.getElapsedCpuTime()` in Android's `StartTimeProvider`. Time the process spent descheduled or blocked is therefore NOT in it, so the origin sits later than true process start and this number understates real time-to-first-frame. Do not reconcile it against wall-clock figures such as logcat's `ActivityTaskManager: Fully drawn` - measured on the Pixel_9a emulator the two differ by roughly a second. Compare each platform against itself, across builds, and nothing else. **iOS also:** prewarming (15+) can start the launch long before the user taps, and nothing segments those launches, so treat iOS outliers as suspect rather than signal. |
| `app_fully_drawn_ms` | | **First meaningful paint.** JS-bundle entry to the first instrumented list finishing layout **with real content in it** - not just RN's first frame (`app_content_appeared_ms`). On a real device those are ~500 ms apart on the pantry, and that gap is the part users notice. Emitted at most once per process. **Content, not chrome:** FlashList reports `onLoad` as soon as every VISIBLE index is measured, which a one-row sticky-header sentinel satisfies while the body is still skeletons - so each instrumented list passes an explicit `hasRealContent` predicate and the latch waits for the first commit where both are true. A settled EMPTY result counts as content; "still waiting" does not. **The predicate reads the UN-SMOOTHED readiness signal.** PantryContent's skeletons pass through a 280 ms `useMinimumVisible` anti-flicker hold; reading that put the hold under this metric as a floor, so a warm-cache launch resolving at 150 ms reported ~280 ms and any improvement below the hold was unmeasurable. Measurement takes `initialSkeletons`, presentation keeps `showSkeletons`. **SCOPE, four ways it does not emit:** (1) the launch stopped for user input - sign-in, email verification, onboarding, biometric setup - because that window contains however long the person took, not how long the app took. Decided from the target THIS launch resolved, never from the rehydrated `navigationState` of the previous session; (2) the launch never rendered one of the three instrumented lists (PantryContent, SortableShoppingList, ItemList), e.g. straight into a detail screen; (3) first meaningful paint landed outside `STARTUP_WINDOW_MS` (10 s). `HomeTabs` is lazy, so only the Pantry tab mounts at cold start - the other two lists can only latch after a navigation, which would otherwise put arbitrary session time in this series. A launch dropped this way increments `startup_window_exceeded_total`; (4) the Hermes startup profiler actually ARMED, since sampling inflates the very interval being measured and one poisoned point in a build-over-build series is worse than a gap. Case (4) applies on **both platforms** - `startProfiling` is exported by the iOS native module as well, so a flagged iOS build suppresses this metric and produces a trace instead. Setting `HERMES_PROFILE_STARTUP` is still not by itself enough: suppression keys off whether sampling actually started. On Android the same moment is also reported to the OS via `Activity.reportFullyDrawn()` (Play Console vitals, Macrobenchmark `timeToFullDisplayMs`), which fires in every case above - it is the marker, not the measurement. |
| `startup_window_exceeded_total` | | Launches whose first meaningful paint landed outside `STARTUP_WINDOW_MS`, so `app_fully_drawn_ms` was not emitted for them. Exists so an EXCLUDED launch is distinguishable from an unmeasured one - the two read identically on a panel otherwise. A non-trivial rate here is the evidence that the 10 s bound is set wrong; the bound is not defended by argument. |
| `app_apollo_restore_ms` | `outcome` | Persisted-cache restore at cold start. `outcome` is `restored` or `empty` - an `empty` majority means every launch refetches. |
| `app_js_entry_to_store_ready_ms` | | JS-bundle entry to the Zustand rehydrate callback. NOT hydration cost - the window is dominated by module evaluation; the blob read + parse + rehydrate is ~5 ms of it. Renamed from `app_zustand_hydration_ms`, whose name implied the opposite. |
| `cache_persist_extract_ms` | | `cache.extract()` cost |
| `cache_persist_stringify_ms` | | Cache `JSON.stringify` cost |
| `resort_edges_duration_ms` | | Cost of re-sorting a cached `itemsConnection` after a subscription event |
| `flashlist_initial_load_ms` | `component` | FlashList `onLoad` - mount to first layout complete, measured to the rAF after layout settles. Device-sensitive: measured 40 ms on the Pixel_9a emulator and 301-934 ms on an SM-S908U1. Do not read an emulator value as a device value. Since 2026-08-26 the tail of the window also contains the skeleton-overlay teardown that the first-content-layout latch schedules at exactly that boundary (SortableShoppingList ~200 → ~300 ms from this alone) - compare within eras, not across them (`perf-blank-window-2026-08-26.md`). |
| `flashlist_scroll_coverage_ratio` | `component` | Mounted cells / expected visible cells during scroll, custom bounds. 1.0 is full coverage. Since 2026-08-26, emitted only by sampled sessions - see `flashlist_blank_cells_total`. |
| `flashlist_session_duration_ms` | `component` | How long a list stayed mounted, emitted on unmount. |
| `offline_queue_oldest_age_ms` | | Age of the oldest PENDING queue entry at drain time. Growing across drains means writes are not syncing. |
| `component_render_duration_ms` | `component` | True render duration. NO PRODUCER TODAY - nothing emits a `component:*:render` measure, because React strips `<Profiler onRender>` from `ReactFabric-prod.js`. The name is kept for what it would carry; use `component_render_count` for churn. | **No producer** - nothing emits a `component:*:render` measure, because React strips `<Profiler onRender>` from ReactFabric-prod. Never appears in Mimir; do not dashboard it. `component_commit_gap_ms` is the weaker stand-in that is actually emitted.

All metrics automatically include `env` (environment), `platform` (ios/android)
and `version` (the app version) labels.

**`version` is the attribution dimension, and it is deliberately the only one.**
Every unique label combination is a Prometheus series, multiplied again by
histogram buckets, so the commit SHA must never become a metric label - it is
unbounded. The SHA travels on LOGS instead, as the `git_sha` body field
alongside `device_id` and `session_id` (searchable with
`| json | git_sha="..."`). `TelemetryService.test.ts` asserts both halves: that
metrics carry `version`, and that they do NOT carry `git_sha`.

Before this existed, nothing on a metric said which build produced it: the only
version-bearing dimension was `service.instance.id`, and every Grafana startup
panel collapsed it with `sum(...) by (le)`. A regression could not be attributed
to a release even in principle.

**Never emit a metric from inside `if (__DEV__)`.** It is dead-code-eliminated
in release, so the series exists and is permanently empty - which reads as
"no problem" rather than "not measured". Dev-only breadcrumbs belong in
`logger.debug`; gate reporting volume with `enabled` / `sampleRate` instead.
Enforced by `__tests__/telemetry/noDevGatedMetrics.test.ts`.

**Every log carries `device_id` and `session_id`** as BODY fields, not Loki
stream labels — query them with `| json | device_id="..."`. A label per device or
per run would multiply the stream count. Metrics deliberately carry NEITHER: a
per-device metric label is unbounded cardinality, the same defect as putting a
duration in a label. Attribute a metric by correlating it with logs from the same
`session_id`, not by labelling the metric.

**Do not instrument with `logger.*` when the answer must be visible in
release.** `logger` (`src/utils/environment.ts`) writes to `console` only and
never reaches Loki, and console output is stripped from release builds. Use
`Telemetry.*`.

Histogram bucket boundaries: `[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]` ms.

### GraphQL sampling

`telemetryLink` captures a `GRAPHQL_TELEMETRY_SAMPLE_RATE` share of operations
outside development and weights every counter it emits by `1/rate`, so
`graphql_requests_total`, `graphql_errors_total`,
`graphql_network_errors_total` and `graphql_slow_queries_total` estimate true
volume at any rate. **`graphql_request_duration_ms` is deliberately NOT
weighted** — quantiles are scale-invariant — so its `_count`/`_sum` reflect only
observed operations. Never divide one family by the other.

The rate is **1.0** today: the fleet is small enough that full capture costs
nothing, and 10% sampling was leaving the duration histogram on a tenth of the
sample its neighbouring request-rate panel implied. Lower it (e.g. `0.1`) when
volume makes full capture costly; it is a build-time env var, so the change
needs a native rebuild, not a code edit.

**Counters recorded before 2026-08-28 are ×10 estimates** taken at a rate of
0.1; after it they are exact counts. A panel spanning that boundary shows an
apparent 10× drop that is an artefact of the rate change, not a traffic change.
Compare within eras.

Sampling that exists to limit VOLUME (this one) can go to 1.0 when volume is
small. Sampling that exists because the instrument perturbs what it measures —
`flashListInstrumentationSampleRate` (0.05) and the commit-tracking `sampleRate`
(0.2) in `src/services/performance/types.ts` — must not, at any fleet size:
the per-cell FlashList wrapper costs ~30-60 ms of a ~320 ms first-layout window,
and nothing labels a session as instrumented, so raising it would contaminate
`app_fully_drawn_ms` and `flashlist_initial_load_ms` with no way to separate
clean sessions from perturbed ones. If denser blank-cell data is ever needed,
add a `cell_instrumented` label FIRST, then raise the rate.

### Querying logs in Loki

Only three labels are indexed as **stream selectors**: `service_name`,
`deployment_environment_name` and `environment`. Everything else the log record
carries is either structured metadata or a body field, and putting it inside
`{...}` silently matches nothing:

```logql
{service_name="sous-chef-app", level="error"}    # WRONG — returns zero rows
{service_name="sous-chef-app"} | level="error"   # right — structured metadata
{service_name="sous-chef-app"} | json | device_id="device_..."   # body field
```

`{job="sous-chef-app"}` matches nothing at all — `job` is a METRIC label, not a
log one. Structured metadata: `level`, `detected_level`, `platform`, `os_type`,
`severity_text`, `severity_number`, `scope_name`, `scope_version`,
`exception_type`. Body fields (need `| json`): `message`, `env`, `device_id`,
`session_id`, `git_sha`, plus whatever the call site passed in `extra`.

**Production and staging never emit `debug`, and production never emits
`info`** — `minLogLevel` (`src/services/telemetry/index.ts`) drops them before
the buffer. A panel charting those levels outside development is charting a
line that is flat by construction. A breadcrumb that must be visible in release
has to be `warn` or `error`; if it is high-frequency, carry the volume on a
counter and keep the log for the anomalous branch, as
`src/apollo/offlineQueue/queueManager.ts` does for queue drains.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| No metrics after changing env vars | Env is baked into the bundle at build time by `scripts/generate-env.js` | Rebuild: `npm run android` / `npm run ios` (or `npm run ios:release`) |
| HTTP 401 on metrics | Wrong instance ID or expired token | Check OTLP instance ID (not Prometheus ID) and regenerate token |
| HTTP 400 "invalid temporality" | Backend expects CUMULATIVE | Ensure `aggregationTemporality: 2` in HttpTransport |
| Dashboards show "No data" | Metrics not ingested or wrong `service_name` label | Query `{service_name="sous-chef-app"}` in Explore to verify |
| Logs not appearing | Logs endpoint not configured or token missing `logs:write` scope | Check `OTLP_LOGS_ENDPOINT` is set and `OTLP_LOGS_AUTH_*` token has the correct scopes |
| A whole run emits nothing, with no error | No `.env`, so `OTLP_METRICS_ENDPOINT` is `undefined` and `transports.http` resolves false | Create `.env`; verify with `npm run genenv && grep OTLP src/config/env.generated.ts` — the values must be strings |
| A Detox run emits nothing, but a hand-run build works | `e2e/init.ts` sets `detoxDisableBackgroundServices`, which switches telemetry off | Prefix the run with `E2E_TELEMETRY=1`, which adds `detoxEnableTelemetry` |
| A Detox **release** run ignores `E2E_TELEMETRY` and the injected auth tokens | `useStartupInit` reads launch args only when `Environment.allowsLaunchArgAuth()`, which is a named, default-off build flag | Build through `scripts/run-ios.sh` / `scripts/run-android.sh`, which export `ALLOW_LAUNCH_ARG_AUTH=true` for `debug`/`release`/`localRelease`. Never set it in a committed env file: `scripts/check-launch-arg-auth.mjs` fails any CI or production/staging build that has it |
| 404 on `/v1/metrics/v1/metrics` | `OTLP_*_ENDPOINT` was given a full path | The transport appends `/v1/metrics` and `/v1/logs` itself, so configure the BASE path only |
| iOS emits nothing against a plaintext collector | App Transport Security | `NSAllowsLocalNetworking` permits plaintext to private-range and `.local` hosts; any other plaintext host is blocked on iOS and needs TLS |

## Code Structure

```
src/services/telemetry/
  TelemetryService.ts        # Buffering, flushing, metric/log API
  types.ts                   # TelemetryConfig, MetricEntry, LogEntry
  index.ts                   # Config factory, env var mapping, exported API
  transports/
    HttpTransport.ts         # OTLP payload building, HTTP sending
    ConsoleTransport.ts      # Dev console logging

src/services/performance/
  NativePerformanceService.ts  # PerformanceObserver for native timing
  MemoryMonitor.ts             # Periodic memory sampling

infra/grafana/
  dashboards/                # Grafana dashboard JSON exports
  test-otlp.sh               # Pipeline verification script
```
