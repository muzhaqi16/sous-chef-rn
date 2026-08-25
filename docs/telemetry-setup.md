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
| `flashlist_blank_cells_total` | `component` | Blank EPISODES, not evaluations - a transition into "a visible index has no mounted cell". Counts from mounted cells since 2026-08-20; older blank percentages were a 250 ms viewability artifact and are not comparable. |
| `flashlist_data_reference_changes` | `component` | The list's `data` array changed identity. Two trackers feed this per list (raw + sorted), so it counts both. |
| `offline_queue_drain_started_total` | | A queue drain actually began. |
| `offline_queue_drain_skipped_total` | `reason` | A drain was requested and declined - `already_processing`, no authenticated user, API unavailable. Pair with `_started_total` to see whether writes are replaying at all. |
| `offline_queue_conflicts_total` | `operation` | A replayed mutation came back as a conflict. |
| `offline_queue_auth_parked_total` | `operation` | A queued write was parked because the token could not be refreshed. NOT a rejection - the server never saw it; it is revived on the next sign-in. |
| `reconnect_backfill_queries_total` | | Active queries refetched after an outage ended. Incremented by the number refetched, so it is a volume, not an event count. |
| `storage_recovery_instance_used` | | The device key was unavailable and the session fell back to unencrypted recovery storage. Any non-zero value means encrypted data was not readable that launch. |

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
| `screen_mount_duration_ms` | `screen` | Screen mount time |
| `screen_interactive_duration_ms` | `screen` | Time to interactive |
| `screen_transition_duration_ms` | `screen` | Full transition time |
| `component_commit_gap_ms` | `component` | Wall time since the component's previous commit. NOT render cost - it includes idle time. |
| `http_request_duration_ms` | `host` | HTTP request duration |
| `graphql_request_duration_ms` | `name` | GraphQL operation duration |
| `app_content_appeared_ms` | | **First frame.** `nativeLaunchStart` to React Native's own content-appeared signal (`RCTContentDidAppearNotification` on iOS, `ReactMarker.CONTENT_APPEARED` on Android), so it means the same thing on both. This is TTID-shaped: RN's root view is mounted, which says nothing about whether the screen's data has loaded - use `app_fully_drawn_ms` for that. **iOS caveats:** `nativeLaunchStart` there is derived from thread CPU time, not true process start, so the origin is an approximation and iOS/Android absolute values are not comparable - compare each platform against itself. iOS prewarming (15+) can also start the launch long before the user taps, and nothing segments those launches, so treat iOS outliers as suspect rather than signal. |
| `app_fully_drawn_ms` | | **First meaningful paint.** JS-bundle entry to the first list finishing its load — i.e. real content on screen, not just RN's first frame (`app_content_appeared_ms`). On a real device those are ~500 ms apart on the pantry, and that gap is the part users notice. Emitted once per session. SCOPE: a launch that never renders a list (signed out, or straight into a detail screen) does not emit it, so this describes signed-in launches. On Android the same moment is also reported to the OS via `Activity.reportFullyDrawn()`, which feeds Play Console vitals and Macrobenchmark's `timeToFullDisplayMs`. |
| `app_apollo_restore_ms` | `outcome` | Persisted-cache restore at cold start. `outcome` is `restored` or `empty` - an `empty` majority means every launch refetches. |
| `app_js_entry_to_store_ready_ms` | | JS-bundle entry to the Zustand rehydrate callback. NOT hydration cost - the window is dominated by module evaluation; the blob read + parse + rehydrate is ~5 ms of it. Renamed from `app_zustand_hydration_ms`, whose name implied the opposite. |
| `cache_persist_extract_ms` | | `cache.extract()` cost |
| `cache_persist_stringify_ms` | | Cache `JSON.stringify` cost |
| `resort_edges_duration_ms` | | Cost of re-sorting a cached `itemsConnection` after a subscription event |
| `flashlist_initial_load_ms` | `component` | FlashList `onLoad` - mount to first layout complete. Device-sensitive: measured 40 ms on the Pixel_9a emulator and 301-934 ms on an SM-S908U1. Do not read an emulator value as a device value. |
| `flashlist_scroll_coverage_ratio` | `component` | Mounted cells / expected visible cells during scroll, custom bounds. 1.0 is full coverage. |
| `flashlist_session_duration_ms` | `component` | How long a list stayed mounted, emitted on unmount. |
| `offline_queue_oldest_age_ms` | | Age of the oldest PENDING queue entry at drain time. Growing across drains means writes are not syncing. |
| `component_render_duration_ms` | `component` | True render duration. NO PRODUCER TODAY - nothing emits a `component:*:render` measure, because React strips `<Profiler onRender>` from `ReactFabric-prod.js`. The name is kept for what it would carry; use `component_render_count` for churn. |

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

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| No metrics after changing env vars | `react-native-config` needs native rebuild | Run `npx react-native run-android/ios` |
| HTTP 401 on metrics | Wrong instance ID or expired token | Check OTLP instance ID (not Prometheus ID) and regenerate token |
| HTTP 400 "invalid temporality" | Backend expects CUMULATIVE | Ensure `aggregationTemporality: 2` in HttpTransport |
| Dashboards show "No data" | Metrics not ingested or wrong `service_name` label | Query `{service_name="sous-chef-app"}` in Explore to verify |
| Logs not appearing | Logs endpoint not configured or token missing `logs:write` scope | Check `OTLP_LOGS_ENDPOINT` is set and `OTLP_LOGS_AUTH_*` token has the correct scopes |

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
