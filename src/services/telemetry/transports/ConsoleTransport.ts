import { TelemetryTransport, LogEntry, MetricEntry } from '../types';
import { Environment } from '#/utils/environment';

export class ConsoleTransport implements TelemetryTransport {
  private readonly enabledInDev: boolean;

  constructor(enabledInDev = true) {
    this.enabledInDev = enabledInDev;
  }

  getName(): string {
    return 'console';
  }

  isAvailable(): boolean {
    return Environment.isDevelopment();
  }

  async sendLogs(logs: LogEntry[]): Promise<void> {
    if (
      !this.isAvailable() ||
      (!this.enabledInDev && Environment.isDevelopment())
    ) {
      return;
    }

    logs.forEach(log => {
      // Guard against undefined level
      if (!log || !log.level) {
        console.warn('[TELEMETRY] Received log with undefined level:', log);
        return;
      }

      const emoji = this.getLogEmoji(log.level);
      const prefix = `${emoji} [TELEMETRY-${log.level.toUpperCase()}]`;

      switch (log.level) {
        case 'debug':
          console.log(prefix, log.message, log.extra || '');
          break;
        case 'info':
          console.info(prefix, log.message, log.extra || '');
          break;
        case 'warn':
          console.warn(prefix, log.message, log.extra || '');
          break;
        case 'error':
          console.error(prefix, log.message, log.extra || '');
          break;
        default:
          console.log(prefix, log.message, log.extra || '');
      }
    });
  }

  async sendMetrics(metrics: MetricEntry[]): Promise<void> {
    if (
      !this.isAvailable() ||
      (!this.enabledInDev && Environment.isDevelopment())
    ) {
      return;
    }

    metrics.forEach(metric => {
      const emoji = this.getMetricEmoji(metric.type);
      const labelsStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(', ');

      console.log(
        `${emoji} [TELEMETRY-METRIC] ${metric.name}{${labelsStr}} = ${metric.value}`,
      );
    });
  }

  private getLogEmoji(level: string): string {
    switch (level) {
      case 'debug':
        return '🐛';
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '📝';
    }
  }

  private getMetricEmoji(type: string): string {
    switch (type) {
      case 'counter':
        return '🔢';
      case 'gauge':
        return '📊';
      case 'histogram':
        return '📈';
      default:
        return '📏';
    }
  }
}
