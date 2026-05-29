import { Platform } from 'react-native';

export interface TelemetryConfig {
  enabled: boolean;
  enableMetrics: boolean;
  enableLogs: boolean;
  enableConsoleInDev: boolean;
  /**
   * Lowest log level shipped to transports. Levels below this are dropped at
   * `log()` time so debug/info chatter never reaches Loki in production.
   */
  minLogLevel: LogEntry['level'];
  appName: string;
  environment: string;
  platform: string;
  instanceId?: string;
  flushIntervals: {
    metrics: number;
    logs: number;
  };
  endpoints: {
    metrics?: string;
    logs?: string;
  };
  metricsAuth?: {
    username?: string;
    password?: string;
  };
  logsAuth?: {
    username?: string;
    password?: string;
  };
  transports: {
    http: boolean;
    console: boolean;
  };
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  extra?: Record<string, any>;
}

export interface MetricEntry {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
  type: 'counter' | 'gauge' | 'histogram';
  /**
   * Explicit histogram bucket upper bounds. Only meaningful for `histogram`
   * metrics; when omitted the transport's default latency bounds are used. Set
   * this for non-latency histograms (ratios 0-1, byte sizes, long durations)
   * so `histogram_quantile` resolves real percentiles instead of saturating.
   */
  bounds?: number[];
}

export interface ErrorDetails {
  message: string;
  stack?: string;
  component?: string;
  operation?: string;
  isFatal?: boolean;
  context?: Record<string, any>;
}

export interface GraphQLOperationDetails {
  operationName: string;
  operationType: 'query' | 'mutation' | 'subscription';
  variables?: Record<string, any>;
  duration?: number;
  hasErrors?: boolean;
  errorCount?: number;
}

export interface TelemetryTransport {
  sendLogs(logs: LogEntry[]): Promise<void>;
  sendMetrics(metrics: MetricEntry[]): Promise<void>;
  isAvailable(): boolean;
  getName(): string;
}

export interface TelemetryEventData {
  eventName: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

export interface ScreenViewData {
  screenName: string;
  properties?: Record<string, any>;
}

export const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: false,
  enableMetrics: false,
  enableLogs: false,
  enableConsoleInDev: true,
  minLogLevel: 'debug',
  appName: 'sous-chef-app',
  environment: 'development',
  platform: Platform.OS,
  flushIntervals: {
    metrics: 10000,
    logs: 5000,
  },
  endpoints: {},
  transports: {
    http: false,
    console: true,
  },
};
