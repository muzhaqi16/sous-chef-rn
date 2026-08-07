import {
  TelemetryTransport,
  LogEntry,
  MetricEntry,
  TelemetryConfig,
  TransportSendError,
} from '../types';
import { logger } from '#/utils/environment';

const HISTOGRAM_BOUNDS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// Transient failures worth retrying: timeout, rate limiting, server errors.
// Any other 4xx is a config/payload problem — the same batch can never
// succeed, so the service drops it instead of retrying it forever.
const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// OTLP SeverityNumber values (logs data model) keyed by our log level.
const LOG_SEVERITY_NUMBER: Record<LogEntry['level'], number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

interface MetricMeta {
  name: string;
  labels: Record<string, string>;
}

export class HttpTransport implements TelemetryTransport {
  private readonly config: TelemetryConfig;

  // Cumulative state accumulated over the process lifetime. It is NOT reset on
  // flush — each flush re-sends the running totals, which is what Mimir /
  // Prometheus expect (the Grafana Cloud OTLP gateway ingests cumulative only;
  // delta temporality is rejected). Storing histograms as running bucket counts
  // (not raw observation arrays) keeps memory bounded by series count.
  private counterAccumulator: Map<string, number> = new Map();
  private gaugeAccumulator: Map<string, number> = new Map();
  private histogramAccumulator: Map<
    string,
    { buckets: number[]; sum: number; count: number; bounds: number[] }
  > = new Map();
  private metricMeta: Map<string, MetricMeta> = new Map();
  // Pinned at process start — the cumulative series' start anchor.
  private readonly startTimeNano: string = `${Date.now()}000000`;

  constructor(config: TelemetryConfig) {
    this.config = config;
  }

  getName(): string {
    return 'http';
  }

  isAvailable(): boolean {
    return (
      this.config.transports.http &&
      !!(this.config.endpoints.metrics || this.config.endpoints.logs)
    );
  }

  async sendLogs(logs: LogEntry[]): Promise<void> {
    if (!this.isAvailable() || !this.config.endpoints.logs) {
      return;
    }
    try {
      const nowNano = `${Date.now()}000000`;
      const payload = {
        resourceLogs: [
          {
            resource: {
              attributes: [
                {
                  key: 'service.name',
                  value: { stringValue: this.config.appName },
                },
                {
                  key: 'deployment.environment.name',
                  value: { stringValue: this.config.environment },
                },
                {
                  key: 'os.type',
                  value: { stringValue: this.config.platform },
                },
              ],
            },
            scopeLogs: [
              {
                scope: { name: 'sous-chef-telemetry', version: '1.0.0' },
                logRecords: logs.map(log => {
                  // Use each record's real emission time, not the flush time,
                  // so Loki preserves ordering within a batch.
                  const parsedMs = Date.parse(log.timestamp);
                  const recordNano = Number.isFinite(parsedMs)
                    ? `${parsedMs}000000`
                    : nowNano;
                  const attributes = [
                    {
                      key: 'level',
                      value: { stringValue: log.level },
                    },
                    {
                      key: 'environment',
                      value: { stringValue: this.config.environment },
                    },
                    {
                      key: 'platform',
                      value: { stringValue: this.config.platform },
                    },
                  ];
                  // OTel exception semantic conventions — record attributes
                  // so Grafana reads error logs as exceptions natively.
                  if (log.exception) {
                    attributes.push(
                      {
                        key: 'exception.type',
                        value: { stringValue: log.exception.type },
                      },
                      {
                        key: 'exception.message',
                        value: { stringValue: log.exception.message },
                      },
                    );
                    if (log.exception.stacktrace) {
                      attributes.push({
                        key: 'exception.stacktrace',
                        value: { stringValue: log.exception.stacktrace },
                      });
                    }
                  }
                  return {
                    timeUnixNano: recordNano,
                    body: {
                      stringValue: JSON.stringify({
                        // `level` lives in the body so LogQL `| json |
                        // level="error"` works; it is also an attribute below.
                        level: log.level,
                        message: log.message,
                        ...log.extra,
                      }),
                    },
                    severityText: log.level.toUpperCase(),
                    severityNumber: LOG_SEVERITY_NUMBER[log.level],
                    attributes,
                  };
                }),
              },
            ],
          },
        ],
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.logsAuth?.username && this.config.logsAuth?.password) {
        const credentials = btoa(
          `${this.config.logsAuth.username}:${this.config.logsAuth.password}`,
        );
        headers.Authorization = `Basic ${credentials}`;
      }

      const otlpUrl = `${this.ensureProtocol(
        this.config.endpoints.logs!,
      )}/v1/logs`;

      const response = await fetch(otlpUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseText = await response
          .text()
          .catch(() => 'Unable to read response');
        // Throw so TelemetryService owns the outcome: re-buffer + backoff for
        // retryable statuses, drop the batch for permanent ones.
        throw new TransportSendError(
          `OTLP logs HTTP ${response.status} ${response.statusText}: ${responseText} (${otlpUrl})`,
          { retryable: isRetryableStatus(response.status) },
        );
      }
      logger.debug(`✅ Logs sent via OTLP (${logs.length} entries)`);
    } catch (error) {
      if (error instanceof TransportSendError) {
        throw error;
      }
      // fetch itself rejected — a network-level failure, always retryable.
      throw new TransportSendError(
        `OTLP logs send failed: ${describeError(error)}`,
        { retryable: true },
      );
    }
  }

  async sendMetrics(metrics: MetricEntry[]): Promise<void> {
    if (!this.isAvailable() || !this.config.endpoints.metrics) {
      return;
    }

    try {
      // Accumulate incoming metrics
      for (const metric of metrics) {
        const key = this.buildKey(metric.name, metric.labels);

        if (!this.metricMeta.has(key)) {
          this.metricMeta.set(key, {
            name: metric.name,
            labels: metric.labels,
          });
        }

        if (metric.type === 'counter') {
          const current = this.counterAccumulator.get(key) || 0;
          this.counterAccumulator.set(key, current + metric.value);
        } else if (metric.type === 'gauge') {
          this.gaugeAccumulator.set(key, metric.value);
        } else if (metric.type === 'histogram') {
          let agg = this.histogramAccumulator.get(key);
          if (!agg) {
            // First observation fixes this series' bounds (per metric, stable).
            const bounds = metric.bounds ?? HISTOGRAM_BOUNDS;
            agg = {
              buckets: new Array(bounds.length + 1).fill(0),
              sum: 0,
              count: 0,
              bounds,
            };
            this.histogramAccumulator.set(key, agg);
          }
          agg.buckets[this.bucketIndex(metric.value, agg.bounds)] += 1;
          agg.sum += metric.value;
          agg.count += 1;
        }
      }

      const totalMetrics =
        this.counterAccumulator.size +
        this.gaugeAccumulator.size +
        this.histogramAccumulator.size;

      if (totalMetrics === 0) {
        logger.debug('No metrics to send');
        return;
      }

      const payload = this.buildOtlpPayload();
      const body = JSON.stringify(payload);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (
        this.config.metricsAuth?.username &&
        this.config.metricsAuth?.password
      ) {
        const credentials = btoa(
          `${this.config.metricsAuth.username}:${this.config.metricsAuth.password}`,
        );
        headers.Authorization = `Basic ${credentials}`;
      }

      const otlpUrl = `${this.ensureProtocol(
        this.config.endpoints.metrics!,
      )}/v1/metrics`;

      logger.debug('📤 Sending metrics via OTLP:', {
        url: otlpUrl,
        metricsCount: totalMetrics,
      });

      const response = await fetch(otlpUrl, {
        method: 'POST',
        headers,
        body,
      });

      // Cumulative totals are retained on failure either way (they live in
      // the instance accumulators): the next allowed flush re-sends the
      // running totals, so a failed send self-heals without losing data.
      if (!response.ok) {
        const responseText = await response
          .text()
          .catch(() => 'Unable to read response');
        throw new TransportSendError(
          `OTLP metrics HTTP ${response.status} ${response.statusText}: ${responseText} (${otlpUrl})`,
          { retryable: isRetryableStatus(response.status) },
        );
      }
      logger.debug(`✅ Metrics sent via OTLP (${totalMetrics} metrics)`);
    } catch (error) {
      if (error instanceof TransportSendError) {
        throw error;
      }
      // fetch itself rejected — a network-level failure, always retryable.
      throw new TransportSendError(
        `OTLP metrics send failed: ${describeError(error)}`,
        { retryable: true },
      );
    }
  }

  private buildKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort()
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private buildOtlpPayload(): Record<string, unknown> {
    const nowNano = `${Date.now()}000000`;
    const otlpMetrics: Record<string, unknown>[] = [];

    // Group by metric name for OTLP (each metric has multiple data points)
    const countersByName = this.groupByName(this.counterAccumulator);
    const gaugesByName = this.groupByName(this.gaugeAccumulator);
    const histogramsByName = this.groupHistogramsByName();

    // Counters → OTLP Sum
    for (const [name, dataPoints] of countersByName) {
      otlpMetrics.push({
        name,
        sum: {
          dataPoints: dataPoints.map(dp => ({
            asDouble: dp.value,
            startTimeUnixNano: this.startTimeNano,
            timeUnixNano: nowNano,
            attributes: this.toOtlpAttributes(dp.labels),
          })),
          // CUMULATIVE running total re-sent each flush with a fixed
          // startTimeUnixNano (process start). Grafana Cloud / Mimir ingests
          // cumulative only; rate()/increase() handle a process-restart reset.
          aggregationTemporality: 2, // CUMULATIVE
          isMonotonic: true,
        },
      });
    }

    // Gauges → OTLP Gauge
    for (const [name, dataPoints] of gaugesByName) {
      otlpMetrics.push({
        name,
        gauge: {
          dataPoints: dataPoints.map(dp => ({
            asDouble: dp.value,
            timeUnixNano: nowNano,
            attributes: this.toOtlpAttributes(dp.labels),
          })),
        },
      });
    }

    // Histograms → OTLP Histogram
    for (const [name, dataPoints] of histogramsByName) {
      otlpMetrics.push({
        name,
        histogram: {
          dataPoints: dataPoints.map(dp => ({
            startTimeUnixNano: this.startTimeNano,
            timeUnixNano: nowNano,
            count: `${dp.count}`,
            sum: dp.sum,
            bucketCounts: dp.buckets.map(String),
            explicitBounds: dp.bounds,
            attributes: this.toOtlpAttributes(dp.labels),
          })),
          // CUMULATIVE: bucket counts/sum/count are running totals over the
          // process lifetime, re-sent each flush (same model as counters).
          aggregationTemporality: 2, // CUMULATIVE
        },
      });
    }

    return {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.config.appName },
              },
              {
                key: 'deployment.environment.name',
                value: { stringValue: this.config.environment },
              },
              {
                key: 'os.type',
                value: { stringValue: this.config.platform },
              },
              ...(this.config.instanceId
                ? [
                    {
                      key: 'service.instance.id',
                      value: { stringValue: this.config.instanceId },
                    },
                  ]
                : []),
            ],
          },
          scopeMetrics: [
            {
              scope: { name: 'sous-chef-telemetry', version: '1.0.0' },
              metrics: otlpMetrics,
            },
          ],
        },
      ],
    };
  }

  private groupByName(
    accumulator: Map<string, number>,
  ): Map<string, { value: number; labels: Record<string, string> }[]> {
    const grouped = new Map<
      string,
      { value: number; labels: Record<string, string> }[]
    >();

    for (const [key, value] of accumulator) {
      const meta = this.metricMeta.get(key);
      if (!meta) {
        continue;
      }
      const existing = grouped.get(meta.name) || [];
      existing.push({ value, labels: meta.labels });
      grouped.set(meta.name, existing);
    }

    return grouped;
  }

  private groupHistogramsByName(): Map<
    string,
    {
      buckets: number[];
      sum: number;
      count: number;
      bounds: number[];
      labels: Record<string, string>;
    }[]
  > {
    const grouped = new Map<
      string,
      {
        buckets: number[];
        sum: number;
        count: number;
        bounds: number[];
        labels: Record<string, string>;
      }[]
    >();

    for (const [key, agg] of this.histogramAccumulator) {
      const meta = this.metricMeta.get(key);
      if (!meta) {
        continue;
      }
      const existing = grouped.get(meta.name) || [];
      existing.push({
        buckets: agg.buckets,
        sum: agg.sum,
        count: agg.count,
        bounds: agg.bounds,
        labels: meta.labels,
      });
      grouped.set(meta.name, existing);
    }

    return grouped;
  }

  // OTLP histogram bucket index for a value within the given bounds:
  // N+1 buckets for N bounds. index i = first bound the value is <= ;
  // index N = above all bounds.
  private bucketIndex(value: number, bounds: number[]): number {
    for (let i = 0; i < bounds.length; i++) {
      if (value <= bounds[i]) {
        return i;
      }
    }
    return bounds.length;
  }

  private toOtlpAttributes(
    labels: Record<string, string>,
  ): { key: string; value: { stringValue: string } }[] {
    return Object.entries(labels)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort()
      .map(([key, value]) => ({
        key,
        value: { stringValue: value },
      }));
  }

  private ensureProtocol(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }
}
