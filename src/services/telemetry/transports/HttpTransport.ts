import {
  TelemetryTransport,
  LogEntry,
  MetricEntry,
  TelemetryConfig,
} from '../types';
import { logger } from '#/utils/environment';

const HISTOGRAM_BOUNDS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

interface MetricMeta {
  name: string;
  labels: Record<string, string>;
}

export class HttpTransport implements TelemetryTransport {
  private readonly config: TelemetryConfig;

  // Accumulated state between flushes
  private counterAccumulator: Map<string, number> = new Map();
  private gaugeAccumulator: Map<string, number> = new Map();
  private histogramObservations: Map<string, number[]> = new Map();
  private metricMeta: Map<string, MetricMeta> = new Map();
  private flushStartTime: string = `${Date.now()}000000`;

  constructor(config: TelemetryConfig) {
    this.config = config;
  }

  getName(): string {
    return 'http';
  }

  isAvailable(): boolean {
    return (
      this.config.transports.http &&
      (!!this.config.endpoints.prometheus || !!this.config.endpoints.loki)
    );
  }

  async sendLogs(logs: LogEntry[]): Promise<void> {
    if (!this.isAvailable() || !this.config.endpoints.loki) {
      return;
    }

    try {
      const streams = [
        {
          stream: {
            job: this.config.appName,
            app: this.config.appName,
            environment: this.config.environment,
            platform: this.config.platform,
          },
          values: logs.map(log => [
            `${Date.now()}000000`,
            JSON.stringify({
              level: log.level,
              message: log.message,
              timestamp: log.timestamp,
              ...log.extra,
            }),
          ]),
        },
      ];

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.auth?.username && this.config.auth?.password) {
        const credentials = btoa(
          `${this.config.auth.username}:${this.config.auth.password}`,
        );
        headers.Authorization = `Basic ${credentials}`;
      }

      const response = await fetch(
        `${this.ensureProtocol(this.config.endpoints.loki!)}/loki/api/v1/push`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ streams }),
        },
      );

      if (!response.ok) {
        logger.warn('Failed to send logs to Loki:', response.status);
      } else {
        logger.debug(`✅ Logs sent to Loki (${logs.length} entries)`);
      }
    } catch (error) {
      logger.error('Failed to send logs to Loki:', error);
    }
  }

  async sendMetrics(metrics: MetricEntry[]): Promise<void> {
    if (!this.isAvailable() || !this.config.endpoints.prometheus) {
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
          const observations = this.histogramObservations.get(key) || [];
          observations.push(metric.value);
          this.histogramObservations.set(key, observations);
        }
      }

      const totalMetrics =
        this.counterAccumulator.size +
        this.gaugeAccumulator.size +
        this.histogramObservations.size;

      if (totalMetrics === 0) {
        logger.debug('No metrics to send');
        return;
      }

      const payload = this.buildOtlpPayload();
      const body = JSON.stringify(payload);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.auth?.username && this.config.auth?.password) {
        const credentials = btoa(
          `${this.config.auth.username}:${this.config.auth.password}`,
        );
        headers.Authorization = `Basic ${credentials}`;
      }

      const otlpUrl = `${this.ensureProtocol(
        this.config.endpoints.prometheus!,
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

      if (!response.ok) {
        const responseText = await response
          .text()
          .catch(() => 'Unable to read response');
        logger.error('❌ Failed to send metrics via OTLP:', {
          status: response.status,
          statusText: response.statusText,
          response: responseText,
          url: otlpUrl,
        });
        // Don't clear accumulators on failure — retry on next flush
      } else {
        logger.debug(`✅ Metrics sent via OTLP (${totalMetrics} metrics)`);
        this.clearAccumulators();
      }
    } catch (error) {
      logger.error('❌ Failed to send metrics via OTLP:', error);
    }
  }

  private buildKey(
    name: string,
    labels: Record<string, string>,
  ): string {
    const labelStr = Object.entries(labels)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort()
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private clearAccumulators(): void {
    this.counterAccumulator.clear();
    this.gaugeAccumulator.clear();
    this.histogramObservations.clear();
    this.metricMeta.clear();
    this.flushStartTime = `${Date.now()}000000`;
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
            startTimeUnixNano: this.flushStartTime,
            timeUnixNano: nowNano,
            attributes: this.toOtlpAttributes(dp.labels),
          })),
          aggregationTemporality: 1, // DELTA
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
          dataPoints: dataPoints.map(dp => {
            const bucketCounts = this.computeBucketCounts(dp.values);
            return {
              startTimeUnixNano: this.flushStartTime,
              timeUnixNano: nowNano,
              count: `${dp.values.length}`,
              sum: dp.values.reduce((a, b) => a + b, 0),
              bucketCounts: bucketCounts.map(String),
              explicitBounds: HISTOGRAM_BOUNDS,
              attributes: this.toOtlpAttributes(dp.labels),
            };
          }),
          aggregationTemporality: 1, // DELTA
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
    { values: number[]; labels: Record<string, string> }[]
  > {
    const grouped = new Map<
      string,
      { values: number[]; labels: Record<string, string> }[]
    >();

    for (const [key, values] of this.histogramObservations) {
      const meta = this.metricMeta.get(key);
      if (!meta) {
        continue;
      }
      const existing = grouped.get(meta.name) || [];
      existing.push({ values, labels: meta.labels });
      grouped.set(meta.name, existing);
    }

    return grouped;
  }

  private computeBucketCounts(values: number[]): number[] {
    // OTLP: N+1 buckets for N bounds
    // bucket[0] = count of values <= bounds[0]
    // bucket[i] = count of values in (bounds[i-1], bounds[i]]
    // bucket[N] = count of values > bounds[N-1]
    const counts = new Array(HISTOGRAM_BOUNDS.length + 1).fill(0);

    for (const value of values) {
      let placed = false;
      for (let i = 0; i < HISTOGRAM_BOUNDS.length; i++) {
        if (value <= HISTOGRAM_BOUNDS[i]) {
          counts[i]++;
          placed = true;
          break;
        }
      }
      if (!placed) {
        counts[HISTOGRAM_BOUNDS.length]++;
      }
    }

    return counts;
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
