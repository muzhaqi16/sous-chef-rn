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
import { logger } from '#/utils/environment';

export class TelemetryService {
  private config: TelemetryConfig;
  private transports: TelemetryTransport[] = [];
  private logBuffer: LogEntry[] = [];
  private metricBuffer: MetricEntry[] = [];
  private isInitialized = false;
  private flushTimers: { logs?: NodeJS.Timeout; metrics?: NodeJS.Timeout } = {};

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
    if (!this.config.enabled || !this.config.enableLogs) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      extra: {
        platform: Platform.OS,
        env: this.config.environment,
        ...extra,
      },
    };

    this.logBuffer.push(logEntry);

    if (level === 'error') {
      this.flushLogs();
    }
  }

  incrementCounter(
    name: string,
    value = 1,
    labels: Record<string, string> = {},
  ): void {
    if (!this.config.enabled || !this.config.enableMetrics) {
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
    if (!this.config.enabled || !this.config.enableMetrics) {
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
  ): void {
    if (!this.config.enabled || !this.config.enableMetrics) {
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
    this.log('info', `Event: ${eventName}`, properties);

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
    this.log('info', `Screen: ${screenName}`, properties);
    this.incrementCounter('screen_views_total', 1, {
      screen_name: screenName,
    });
  }

  trackTiming(
    category: string,
    variable: string,
    duration: number,
    label?: string,
  ): void {
    this.recordHistogram(`app_timing_${category}_ms`, duration, {
      variable,
      label: label || 'default',
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
    if (this.logBuffer.length === 0) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    const availableTransports = this.transports.filter(t => t.isAvailable());

    await Promise.allSettled(
      availableTransports.map(transport =>
        transport.sendLogs(logs).catch(error => {
          logger.error(
            `Failed to send logs via ${transport.getName()}:`,
            error,
          );
          this.logBuffer.unshift(...logs);
        }),
      ),
    );
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
    // justified: HermesInternal is a Hermes engine-specific API not in TS type definitions
    if (typeof global !== 'undefined' && (global as any).HermesInternal) {
      (global as any).HermesInternal.enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled: (id: any, reason: any) => {
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
