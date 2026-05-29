import { Platform } from 'react-native';
import {
  TelemetryConfig,
  LogEntry,
  MetricEntry,
  ErrorDetails,
  TelemetryTransport,
  DEFAULT_CONFIG,
} from './types';
import { ConsoleTransport } from './transports/ConsoleTransport';
import { HttpTransport } from './transports/HttpTransport';
import { scrubLogExtra, scrubString } from './scrub';
import { logger } from '#/utils/environment';
import { useStore } from '#store';

const LOG_LEVEL_PRIORITY: Record<LogEntry['level'], number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Cap the in-memory log retry buffer so a downed OTLP gateway cannot grow
// memory without bound on a phone. Oldest entries are dropped first.
const MAX_LOG_BUFFER = 1000;

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

    this.incrementCounter('app_starts_total');
  }

  updateConfig(newConfig: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.setupTransports();

    if (this.isInitialized) {
      this.setupFlushTimers();
    }
  }

  log(
    level: LogEntry['level'],
    message: string,
    extra?: Record<string, any>,
  ): void {
    if (
      !this.config.enabled ||
      !this.config.enableLogs ||
      this.isConsentDenied()
    ) {
      return;
    }

    // Drop entries below the configured floor (e.g. debug/info in production)
    // so they never reach the buffer or get shipped to Loki.
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
      },
    };

    this.logBuffer.push(logEntry);

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
        ...labels,
      },
      timestamp: Date.now(),
      type: 'histogram',
      bounds,
    });
  }

  trackError(error: ErrorDetails): void {
    this.log('error', error.message, {
      error_stack: error.stack,
      error_component: error.component,
      error_operation: error.operation,
      is_fatal: error.isFatal,
      ...error.context,
    });

    this.incrementCounter('app_errors_total', 1, {
      component: error.component || 'unknown',
      operation: error.operation || 'unknown',
      is_fatal: String(error.isFatal || false),
    });
  }

  trackEvent(eventName: string, properties: Record<string, any> = {}): void {
    // `app_events_total` is the source of truth for the analytics dashboards.
    // The breadcrumb is logged at debug level so `minLogLevel` drops it before
    // Loki in staging/production — no write-amplification where volume matters.
    this.log('debug', `Event: ${eventName}`, properties);

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
    properties: Record<string, any> = {},
  ): void {
    // `screen_views_total` is the source of truth; the breadcrumb is logged at
    // debug level so `minLogLevel` drops it before Loki in staging/production.
    this.log('debug', `Screen: ${screenName}`, properties);
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
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0 || this.logFlushInFlight) {
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

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(
            `Failed to send logs via ${availableTransports[index].getName()}:`,
            result.reason,
          );
        }
      });

      // Re-buffer the batch for retry on the next flush if any transport
      // failed. Newer entries that arrived during the await are kept ahead of
      // the retried batch, and the buffer is capped (oldest dropped) to bound
      // memory during a sustained outage.
      if (results.some(result => result.status === 'rejected')) {
        this.logBuffer = [...logs, ...this.logBuffer].slice(-MAX_LOG_BUFFER);
      }
    } finally {
      this.logFlushInFlight = false;
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricBuffer.length === 0) {
      return;
    }

    const metrics = [...this.metricBuffer];
    this.metricBuffer = [];

    const availableTransports = this.transports.filter(t => t.isAvailable());

    await Promise.allSettled(
      availableTransports.map(transport =>
        transport.sendMetrics(metrics).catch(error => {
          logger.error(
            `Failed to send metrics via ${transport.getName()}:`,
            error,
          );
          this.metricBuffer.unshift(...metrics);
        }),
      ),
    );
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
          this.trackError({
            message: 'Unhandled Promise Rejection',
            context: {
              rejection_id: id,
              reason: String(reason),
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
