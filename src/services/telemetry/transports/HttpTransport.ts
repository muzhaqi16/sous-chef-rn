import { Platform } from 'react-native';
import { TelemetryTransport, LogEntry, MetricEntry, TelemetryConfig } from '../types';
import { logger } from '#/utils/environment';

export class HttpTransport implements TelemetryTransport {
  private readonly config: TelemetryConfig;
  private metricsAccumulator: Map<string, number> = new Map();

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
      const streams = [{
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
      }];

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.auth?.username && this.config.auth?.password) {
        const credentials = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
        headers.Authorization = `Basic ${credentials}`;
      }

      const response = await fetch(`${this.config.endpoints.loki}/loki/api/v1/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ streams }),
      });

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
      // Accumulate metrics by key (handle counter increments properly)
      metrics.forEach(metric => {
        const labelStr = Object.entries({
          app: this.config.appName,
          env: this.config.environment,
          platform: this.config.platform,
          ...metric.labels,
        })
          .filter(([_, v]) => v !== undefined && v !== null)
          .sort() // Sort for consistent key
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');

        const key = labelStr ? `${metric.name}{${labelStr}}` : metric.name;

        if (metric.type === 'counter') {
          // For counters, accumulate the value
          const current = this.metricsAccumulator.get(key) || 0;
          this.metricsAccumulator.set(key, current + metric.value);
        } else {
          // For gauges, replace the value
          this.metricsAccumulator.set(key, metric.value);
        }
      });

      // Build Prometheus format text WITHOUT TIMESTAMPS
      const metricsByName = new Map<string, { type: string; lines: string[] }>();

      // Group metrics by base name for proper HELP/TYPE headers
      this.metricsAccumulator.forEach((value, key) => {
        const baseName = key.split('{')[0];
        if (!metricsByName.has(baseName)) {
          metricsByName.set(baseName, {
            type: this.inferMetricType(baseName),
            lines: []
          });
        }
        // IMPORTANT: No timestamp at the end!
        metricsByName.get(baseName)!.lines.push(`${key} ${value}`);
      });

      // Build the final body
      let body = '';
      metricsByName.forEach((data, baseName) => {
        body += `# HELP ${baseName} ${baseName.replace(/_/g, ' ')}\n`;
        body += `# TYPE ${baseName} ${data.type}\n`;
        data.lines.forEach(line => {
          body += `${line}\n`;
        });
      });

      if (body.trim().length === 0) {
        logger.debug('No metrics to send');
        return;
      }

      // Send to Push Gateway
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain; version=0.0.4',
      };

      if (this.config.auth?.username && this.config.auth?.password) {
        const credentials = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
        headers.Authorization = `Basic ${credentials}`;
      }

      const pushGatewayUrl = `${this.config.endpoints.prometheus}/metrics/job/${this.config.appName}/instance/${Platform.OS}`;

      logger.debug('📤 Sending metrics to Push Gateway:', {
        url: pushGatewayUrl,
        metricsCount: this.metricsAccumulator.size,
        bodyPreview: body.substring(0, 500),
      });

      const response = await fetch(pushGatewayUrl, {
        method: 'POST',
        headers,
        body: body,
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Unable to read response');
        logger.error('❌ Failed to send metrics to Push Gateway:', {
          status: response.status,
          statusText: response.statusText,
          response: responseText,
          url: pushGatewayUrl,
        });
        // Don't clear accumulator on failure
      } else {
        logger.debug(`✅ Metrics sent to Push Gateway (${this.metricsAccumulator.size} metrics)`);
        // Clear accumulator after successful send
        this.metricsAccumulator.clear();
      }
    } catch (error) {
      logger.error('❌ Failed to send metrics to Push Gateway:', error);
    }
  }

  private inferMetricType(metricName: string): string {
    if (metricName.endsWith('_total') || metricName.endsWith('_count')) {
      return 'counter';
    }
    if (metricName.endsWith('_bucket') || metricName.endsWith('_sum')) {
      return 'histogram';
    }
    return 'gauge';
  }
}