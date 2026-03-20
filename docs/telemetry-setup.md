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
| `OTLP_METRICS_ENDPOINT` | Base URL for the metrics OTLP receiver. App appends `/v1/metrics`. |
| `OTLP_METRICS_AUTH_USERNAME` | Basic auth username (instance ID for Grafana Cloud). Leave empty for no auth. |
| `OTLP_METRICS_AUTH_PASSWORD` | Basic auth password (API token for Grafana Cloud). |
| `OTLP_LOGS_ENDPOINT` | Base URL for the logs OTLP receiver. App appends `/v1/logs`. |
| `OTLP_LOGS_AUTH_USERNAME` | Basic auth username for logs endpoint. |
| `OTLP_LOGS_AUTH_PASSWORD` | Basic auth password for logs endpoint. |

Auth is **credential-presence-based**: if username + password are set, Basic auth headers are sent. If either is empty, no auth header is attached. This works for both cloud (auth required) and self-hosted (auth often not needed) setups.

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

Both metrics and logs go through the same OTLP gateway:

```bash
# .env
OTLP_METRICS_ENDPOINT=https://otlp-gateway-prod-us-east-2.grafana.net/otlp
OTLP_METRICS_AUTH_USERNAME=1564351
OTLP_METRICS_AUTH_PASSWORD=glc_your_token_here

OTLP_LOGS_ENDPOINT=https://otlp-gateway-prod-us-east-2.grafana.net/otlp
OTLP_LOGS_AUTH_USERNAME=1564351
OTLP_LOGS_AUTH_PASSWORD=glc_your_token_here
```

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

Point each endpoint at its own backend:

```bash
OTLP_METRICS_ENDPOINT=https://mimir.your-infra.com/otlp
OTLP_METRICS_AUTH_USERNAME=
OTLP_METRICS_AUTH_PASSWORD=

OTLP_LOGS_ENDPOINT=https://loki.your-infra.com/otlp
OTLP_LOGS_AUTH_USERNAME=
OTLP_LOGS_AUTH_PASSWORD=
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
| `slow_component_renders_total` | `component` | Renders > 16ms |
| `slow_screen_transitions_total` | `screen` | Transitions > 500ms |

### Gauges

| Metric | Labels | Description |
|--------|--------|-------------|
| `app_memory_used_bytes` | `source` | Current memory usage |
| `app_memory_limit_bytes` | | Device memory limit |
| `app_memory_usage_percent` | | Memory usage percentage |

### Histograms

| Metric | Labels | Description |
|--------|--------|-------------|
| `app_startup_duration_ms` | | Full app startup time |
| `app_native_launch_ms` | | Native platform init time |
| `app_js_bundle_load_ms` | | Hermes bytecode load time |
| `app_content_appeared_ms` | | Time to first content |
| `screen_mount_duration_ms` | `screen` | Screen mount time |
| `screen_interactive_duration_ms` | `screen` | Time to interactive |
| `screen_transition_duration_ms` | `screen` | Full transition time |
| `component_render_duration_ms` | `component` | Component render time |
| `http_request_duration_ms` | `host` | HTTP request duration |
| `graphql_request_duration_ms` | `name` | GraphQL operation duration |

All metrics automatically include `env` (environment) and `platform` (ios/android) labels.

Histogram bucket boundaries: `[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]` ms.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| No metrics after changing env vars | `react-native-config` needs native rebuild | Run `npx react-native run-android/ios` |
| HTTP 401 on metrics | Wrong instance ID or expired token | Check OTLP instance ID (not Prometheus ID) and regenerate token |
| HTTP 400 "invalid temporality" | Backend expects CUMULATIVE | Ensure `aggregationTemporality: 2` in HttpTransport |
| Dashboards show "No data" | Metrics not ingested or wrong `service_name` label | Query `{service_name="sous-chef-app"}` in Explore to verify |
| Logs not appearing | Logs endpoint not configured or token missing `logs:write` scope | Check `OTLP_LOGS_ENDPOINT` is set and token has correct scopes |

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
