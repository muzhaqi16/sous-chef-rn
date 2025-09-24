import { Platform } from 'react-native';

export interface TelemetryConfig {
  enabled: boolean;
  enableMetrics: boolean;
  enableLogs: boolean;
  enableConsoleInDev: boolean;
  appName: string;
  environment: string;
  platform: string;
  flushIntervals: {
    metrics: number;
    logs: number;
  };
  endpoints: {
    prometheus?: string;
    loki?: string;
  };
  auth?: {
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

export interface PerformanceTimingData {
  category: string;
  variable: string;
  duration: number;
  label?: string;
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
  appName: 'sous-chef-app',
  environment: 'development',
  platform: Platform.OS,
  flushIntervals: {
    metrics: 10000,
    logs: 5000,
  },
  endpoints: {},
  auth: undefined,
  transports: {
    http: false,
    console: true,
  },
};