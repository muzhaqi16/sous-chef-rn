import { Platform } from 'react-native';
import {
  TelemetryConfig,
  LogEntry,
  LogExceptionDetails,
  MetricEntry,
  ErrorDetails,
  TelemetryTransport,
  TransportSendError,
  DEFAULT_CONFIG,
} from './types';
import { ConsoleTransport } from './transports/ConsoleTransport';
import { HttpTransport } from './transports/HttpTransport';
import { scrubLogExtra, scrubString } from './scrub';
import { logger } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';
import { getDeviceIdSync } from '#/utils/deviceId';
import { generateId } from '#/utils/generateId';
import { getVersion, isEmulatorSync } from 'react-native-device-info';
import { env as buildEnv } from '#/config/env';
import { useStore } from '#store';

/**
 * One id per app process. Distinguishes runs of the same install — a counter
 * reset or a cold start is otherwise invisible in the log stream.
 */
const SESSION_ID = generateId();

/**
 * The app version, as a metric label — the dimension that attributes a
 * regression to a release. BOUNDED on purpose: every label combination is a new
 * Prometheus series times its buckets, so the unbounded commit SHA must never be
 * a label. It travels on LOGS instead, as a body field (see `log()`).
 */
let appVersion: string | undefined;
function resolveAppVersion(): string {
  appVersion ??= safeNativeRead(getVersion, 'unknown');
  return appVersion;
}

/**
 * Emulator or real hardware — two values, deliberately not `device_model`, which
 * is the same cardinality bomb as a commit SHA. Without it both run under one
 * series while disagreeing by 1.4-2x on startup marks and 10-20x on
 * `flashlist_initial_load_ms`, poisoning any release baseline.
 */
let deviceType: string | undefined;
function resolveDeviceType(): string {
  deviceType ??= safeNativeRead(
    () => (isEmulatorSync() ? 'emulator' : 'physical'),
    'unknown',
  );
  return deviceType;
}

/**
 * Both readers are blocking SYNCHRONOUS bridge calls — `isEmulatorSync` is a
 * binder IPC on Android hardware — so they must stay lazy and memoized rather
 * than run at module scope, inside the startup window this service measures. A
 * throw is swallowed: a missing label beats breaking every `import { Telemetry }`.
 */
function safeNativeRead<T>(read: () => T, fallback: T): T {
  let value;
  try {
    value = read();
  } catch {
    // Degrade to an unlabelled metric rather than breaking every consumer.
  }
  return value ?? fallback;
}

const LOG_LEVEL_PRIORITY: Record<LogEntry['level'], number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Bounded retry buffers: a downed OTLP gateway must not grow memory on a phone.
// Oldest first, so a very long outage slightly undercounts metric totals.
const MAX_LOG_BUFFER = 1000;
const MAX_METRIC_BUFFER = 2000;

// Backoff between failed flushes; without it a dead endpoint is retried on every
// interval tick plus every error log's immediate flush. Recovery is lazy — the
// next allowed flush — since telemetry is fire-and-forget.
const INITIAL_FLUSH_BACKOFF_MS = 5_000;
const MAX_FLUSH_BACKOFF_MS = 300_000;

interface FlushBackoff {
  consecutiveFailures: number;
  /** Epoch ms before which flushes are skipped; 0 = no backoff active. */
  nextAttemptAt: number;
}

// Errors a transport hasn't classified (e.g. from a test double) default to
// retryable — dropping data needs an explicit permanent verdict.
const isRetryableReason = (reason: unknown): boolean =>
  reason instanceof TransportSendError ? reason.retryable : true;

export class TelemetryService {
  private config: TelemetryConfig;
  private transports: TelemetryTransport[] = [];
  private logBuffer: LogEntry[] = [];
  private metricBuffer: MetricEntry[] = [];
  private isInitialized = false;
  private flushTimers: { logs?: NodeJS.Timeout; metrics?: NodeJS.Timeout } = {};
  // Guards against overlapping log flushes (the error-triggered immediate flush
  // can race the interval timer); without it, concurrent flushes fire
  // duplicate failing requests and invert the re-buffer order.
  private logFlushInFlight = false;
  private metricFlushInFlight = false;
  private logsBackoff: FlushBackoff = {
    consecutiveFailures: 0,
    nextAttemptAt: 0,
  };
  private metricsBackoff: FlushBackoff = {
    consecutiveFailures: 0,
    nextAttemptAt: 0,
  };
  // A metrics send failed: the entries are already folded into HttpTransport's
  // cumulative accumulators, so the retry must flush even with an empty buffer
  // (re-buffering the entries instead would double-count them).
  private metricsRetryPending = false;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupTransports();
  }

  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    logger.info('📊 Telemetry Service initialized', {
      enabled: this.config.enabled,
      environment: this.config.environment,
      transports: this.transports.map(t => t.getName()),
    });

    this.setupFlushTimers();
    this.setupErrorHandlers();
    this.isInitialized = true;

    this.trackEvent('app_telemetry_initialized', {
      platform: Platform.OS,
      environment: this.config.environment,
      enabled_transports: this.transports.filter(t => t.isAvailable()).length,
    });

    // `app_starts_total` belongs in `useStartupInit`'s idle callback, NOT here:
    // this runs synchronously from the hydration effect, so its metric would be
    // the first labelled one of a cold start and would resolve `device_type`
    // (a binder IPC on Android hardware) inside the window the startup metrics
    // measure — biasing them on real devices only.
  }

  updateConfig(newConfig: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.setupTransports();

    if (this.isInitialized) {
      this.setupFlushTimers();
    }
  }

  /**
   * Whether a log at `level` would survive the gates in {@link log}. Lets a hot
   * path skip BUILDING a payload that would be discarded — the production floor
   * is `warn`, so a debug breadcrumb allocates its `extra` object for nothing.
   */
  isLevelEnabled(level: LogEntry['level']): boolean {
    if (
      !this.config.enabled ||
      !this.config.enableLogs ||
      this.isConsentDenied()
    ) {
      return false;
    }
    return (
      LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLogLevel]
    );
  }

  log(
    level: LogEntry['level'],
    message: string,
    extra?: Record<string, unknown>,
    exception?: LogExceptionDetails,
  ): void {
    if (
      !this.config.enabled ||
      !this.config.enableLogs ||
      this.isConsentDenied()
    ) {
      return;
    }

    // Below the floor: never buffered, never shipped.
    if (
      LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLogLevel]
    ) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message: scrubString(message),
      timestamp: new Date().toISOString(),
      extra: {
        platform: Platform.OS,
        env: this.config.environment,
        ...scrubLogExtra(extra),
        // Attribution, applied last so a caller's `extra` cannot shadow it.
        // BODY fields, not Loki stream labels — a label per device or run would
        // multiply the stream count, while a body field stays searchable with
        // `| json | device_id="..."`.
        device_id: getDeviceIdSync() ?? 'unknown',
        session_id: SESSION_ID,
        // The commit the build came from; a body field, never a label. `-dirty`
        // means uncommitted changes, so the build is not reproducible.
        git_sha: buildEnv.GIT_SHA ?? 'unknown',
      },
    };

    if (exception) {
      logEntry.exception = {
        type: exception.type,
        message: scrubString(exception.message),
      };
      if (exception.stacktrace) {
        logEntry.exception.stacktrace = scrubString(exception.stacktrace);
      }
    }

    this.logBuffer.push(logEntry);
    // Cap at insert time too — the buffer also grows while flushes are
    // skipped (device offline, backoff window), not just on re-buffer.
    if (this.logBuffer.length > MAX_LOG_BUFFER) {
      this.logBuffer.shift();
    }

    if (level === 'error') {
      this.flushLogs();
    }
  }

  // Defense-in-depth consent gate, evaluated live on every emit. Even if
  // updateConfig has not yet reflected revoked consent (e.g. cold start before
  // setup runs), nothing is emitted once the user has opted out. Mirrors the
  // telemetryLink guard.
  private isConsentDenied(): boolean {
    return useStore.getState().userConsent === false;
  }

  incrementCounter(
    name: string,
    value = 1,
    labels: Record<string, string> = {},
  ): void {
    if (
      !this.config.enabled ||
      !this.config.enableMetrics ||
      this.isConsentDenied()
    ) {
      return;
    }

    this.addMetric({
      name,
      value,
      labels: {
        platform: Platform.OS,
        env: this.config.environment,
        version: resolveAppVersion(),
        device_type: resolveDeviceType(),
        ...labels,
      },
      timestamp: Date.now(),
      type: 'counter',
    });
  }

  recordGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    if (
      !this.config.enabled ||
      !this.config.enableMetrics ||
      this.isConsentDenied()
    ) {
      return;
    }

    this.addMetric({
      name,
      value,
      labels: {
        platform: Platform.OS,
        env: this.config.environment,
        version: resolveAppVersion(),
        device_type: resolveDeviceType(),
        ...labels,
      },
      timestamp: Date.now(),
      type: 'gauge',
    });
  }

  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    bounds?: number[],
  ): void {
    if (
      !this.config.enabled ||
      !this.config.enableMetrics ||
      this.isConsentDenied()
    ) {
      return;
    }

    this.addMetric({
      name,
      value,
      labels: {
        platform: Platform.OS,
        env: this.config.environment,
        version: resolveAppVersion(),
        device_type: resolveDeviceType(),
        ...labels,
      },
      timestamp: Date.now(),
      type: 'histogram',
      bounds,
    });
  }

  trackError(error: ErrorDetails): void {
    this.log(
      'error',
      error.message,
      {
        error_stack: error.stack,
        error_component: error.component,
        error_operation: error.operation,
        is_fatal: error.isFatal,
        ...error.context,
      },
      {
        type: error.name || 'Error',
        message: error.message,
        stacktrace: error.stack,
      },
    );

    this.incrementCounter('app_errors_total', 1, {
      component: error.component || 'unknown',
      operation: error.operation || 'unknown',
      is_fatal: String(error.isFatal || false),
    });
  }

  trackEvent(
    eventName: string,
    properties: Record<string, unknown> = {},
  ): void {
    // `app_events_total` is the source of truth for the analytics dashboards.
    // The breadcrumb is logged at debug level so `minLogLevel` drops it before
    // Loki in staging/production — no write-amplification where volume matters.
    // Guarded so the message is not even built where the floor discards it.
    if (this.isLevelEnabled('debug')) {
      this.log('debug', `Event: ${eventName}`, properties);
    }

    // Build labels for the counter
    const labels: Record<string, string> = {
      event_name: eventName,
    };

    // Add method label if present (for auth events like login_attempt, login_success)
    if (typeof properties.method === 'string') {
      labels.method = properties.method;
    }

    this.incrementCounter('app_events_total', 1, labels);
  }

  trackScreenView(
    screenName: string,
    properties: Record<string, unknown> = {},
  ): void {
    // `screen_views_total` is the source of truth; the breadcrumb is logged at
    // debug level so `minLogLevel` drops it before Loki in staging/production.
    if (this.isLevelEnabled('debug')) {
      this.log('debug', `Screen: ${screenName}`, properties);
    }
    this.incrementCounter('screen_views_total', 1, {
      screen_name: screenName,
    });
  }

  async flush(): Promise<void> {
    await Promise.all([this.flushLogs(), this.flushMetrics()]);
  }

  private setupTransports(): void {
    this.transports = [];

    if (this.config.transports.console) {
      this.transports.push(
        new ConsoleTransport(this.config.enableConsoleInDev),
      );
    }

    if (this.config.transports.http) {
      this.transports.push(new HttpTransport(this.config));
    }
  }

  private setupFlushTimers(): void {
    this.clearFlushTimers();

    if (this.config.enableLogs) {
      this.flushTimers.logs = setInterval(
        () => this.flushLogs(),
        this.config.flushIntervals.logs,
      );
    }

    if (this.config.enableMetrics) {
      this.flushTimers.metrics = setInterval(
        () => this.flushMetrics(),
        this.config.flushIntervals.metrics,
      );
    }
  }

  private clearFlushTimers(): void {
    if (this.flushTimers.logs) {
      clearInterval(this.flushTimers.logs);
      delete this.flushTimers.logs;
    }

    if (this.flushTimers.metrics) {
      clearInterval(this.flushTimers.metrics);
      delete this.flushTimers.metrics;
    }
  }

  private addMetric(metric: MetricEntry): void {
    this.metricBuffer.push(metric);
    if (this.metricBuffer.length > MAX_METRIC_BUFFER) {
      this.metricBuffer.shift();
    }
  }

  /**
   * Skip flushes while the device has no internet (NetInfo-driven store
   * flag). Deliberately NOT gated on `apiReachable` — that flag tracks the
   * GraphQL API host, while telemetry ships to separate hosts (Loki/Mimir)
   * whose health is handled by the flush backoff instead.
   */
  private isDeviceOffline(): boolean {
    return useStore.getState().isOnline === false;
  }

  private inBackoff(backoff: FlushBackoff): boolean {
    return Date.now() < backoff.nextAttemptAt;
  }

  private noteFlushSuccess(backoff: FlushBackoff, pipeline: string): void {
    if (backoff.consecutiveFailures > 0) {
      logger.info(
        `Telemetry ${pipeline} pipeline recovered after ${backoff.consecutiveFailures} failed flush(es)`,
      );
    }
    backoff.consecutiveFailures = 0;
    backoff.nextAttemptAt = 0;
  }

  private noteFlushFailure(
    backoff: FlushBackoff,
    pipeline: string,
    transports: string,
    reason: unknown,
    detail?: string,
  ): void {
    backoff.consecutiveFailures += 1;
    const delay = Math.min(
      INITIAL_FLUSH_BACKOFF_MS * 2 ** (backoff.consecutiveFailures - 1),
      MAX_FLUSH_BACKOFF_MS,
    );
    backoff.nextAttemptAt = Date.now() + delay;
    const summary = `Failed to send ${pipeline} via ${transports} (attempt ${
      backoff.consecutiveFailures
    }, next flush in ${Math.round(delay / 1000)}s${
      detail ? `; ${detail}` : ''
    })`;
    // One loud line per outage; repeats go to debug so a dead endpoint does
    // not produce an error wall on every flush attempt.
    if (backoff.consecutiveFailures === 1) {
      logger.error(summary, reason);
    } else {
      logger.debug(summary, reason);
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0 || this.logFlushInFlight) {
      return;
    }
    // Keep buffering (capped) instead of firing requests that cannot succeed.
    // Gates both the interval timer and the error-triggered immediate flush.
    if (this.isDeviceOffline() || this.inBackoff(this.logsBackoff)) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];
    this.logFlushInFlight = true;

    const availableTransports = this.transports.filter(t => t.isAvailable());

    try {
      const results = await Promise.allSettled(
        availableTransports.map(transport => transport.sendLogs(logs)),
      );

      const failures = results
        .map((result, index) => ({
          result,
          name: availableTransports[index].getName(),
        }))
        .filter(
          (entry): entry is { result: PromiseRejectedResult; name: string } =>
            entry.result.status === 'rejected',
        );

      if (failures.length === 0) {
        this.noteFlushSuccess(this.logsBackoff, 'logs');
        return;
      }

      // Re-buffer only when retrying can ever succeed. A permanent failure
      // (non-retryable 4xx: wrong endpoint, bad auth) means the same batch
      // fails forever — re-buffering it would pin the pipeline on a poisoned
      // batch. Newer entries that arrived during the await stay ahead of the
      // retried batch; the cap (oldest dropped) bounds a sustained outage.
      const retryable = failures.some(f => isRetryableReason(f.result.reason));
      if (retryable) {
        this.logBuffer = [...logs, ...this.logBuffer].slice(-MAX_LOG_BUFFER);
      }
      this.noteFlushFailure(
        this.logsBackoff,
        'logs',
        failures.map(f => f.name).join(', '),
        failures[0].result.reason,
        retryable
          ? undefined
          : `dropped ${logs.length} entries (non-retryable)`,
      );
    } finally {
      this.logFlushInFlight = false;
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricFlushInFlight) {
      return;
    }
    // `metricsRetryPending` forces a flush even with an empty buffer: after a
    // failed send the retry payload lives in HttpTransport's cumulative
    // accumulators, not in this buffer.
    if (this.metricBuffer.length === 0 && !this.metricsRetryPending) {
      return;
    }
    if (this.isDeviceOffline() || this.inBackoff(this.metricsBackoff)) {
      return;
    }

    const metrics = [...this.metricBuffer];
    this.metricBuffer = [];
    this.metricFlushInFlight = true;

    const availableTransports = this.transports.filter(t => t.isAvailable());

    try {
      const results = await Promise.allSettled(
        availableTransports.map(transport => transport.sendMetrics(metrics)),
      );

      const failures = results
        .map((result, index) => ({
          result,
          name: availableTransports[index].getName(),
        }))
        .filter(
          (entry): entry is { result: PromiseRejectedResult; name: string } =>
            entry.result.status === 'rejected',
        );

      if (failures.length === 0) {
        this.metricsRetryPending = false;
        this.noteFlushSuccess(this.metricsBackoff, 'metrics');
        return;
      }

      // No re-buffering: HttpTransport has already folded these entries into
      // its cumulative accumulators — pushing them back would double-count
      // counters on the next flush. Mark a resend instead so the next allowed
      // flush re-ships the running totals even if no new metrics arrive.
      this.metricsRetryPending = failures.some(f =>
        isRetryableReason(f.result.reason),
      );
      this.noteFlushFailure(
        this.metricsBackoff,
        'metrics',
        failures.map(f => f.name).join(', '),
        failures[0].result.reason,
      );
    } finally {
      this.metricFlushInFlight = false;
    }
  }

  private setupErrorHandlers(): void {
    // HermesInternal is a Hermes engine-specific global not in the RN type defs;
    // narrow it to just the API we touch instead of casting through `any`.
    const hermesGlobal = global as typeof globalThis & {
      HermesInternal?: {
        enablePromiseRejectionTracker?: (options: {
          allRejections: boolean;
          onUnhandled: (id: unknown, reason: unknown) => void;
        }) => void;
      };
    };
    if (typeof global !== 'undefined' && hermesGlobal.HermesInternal) {
      hermesGlobal.HermesInternal.enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled: (id: unknown, reason: unknown) => {
          // Track dedicated counter for dashboard compatibility
          this.incrementCounter('unhandled_promise_rejections_total');
          // Structurally serialize the reason instead of String(reason): a
          // rejected non-Error object stringifies to "[object Object]", losing
          // the message/stack/GraphQL fields. serializeError narrows Errors,
          // plain objects, and Apollo error shapes into a JSON-friendly object.
          const serialized = serializeError(reason);
          this.trackError({
            message: `Unhandled Promise Rejection: ${serialized.message}`,
            name: serialized.name,
            stack: serialized.stack,
            context: {
              rejection_id: id,
              reason: serialized,
            },
          });
        },
      });
    }
  }

  destroy(): void {
    this.clearFlushTimers();
    this.flush();
    this.isInitialized = false;
  }
}
