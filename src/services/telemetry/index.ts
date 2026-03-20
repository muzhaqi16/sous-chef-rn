import { Platform } from 'react-native';
import Config from 'react-native-config';
import { TelemetryService } from './TelemetryService';
import { TelemetryConfig } from './types';
import { Environment } from '#/utils/environment';
import { getDeviceId } from '#/utils/deviceId';

const createTelemetryConfig = (): TelemetryConfig => {
  const env = Environment.getConfig();

  return {
    enabled: Environment.shouldEnableAnalytics() || Environment.isDevelopment(),
    enableMetrics:
      Environment.shouldEnableAnalytics() || Environment.isDevelopment(),
    enableLogs: true,
    enableConsoleInDev: false,
    appName: 'sous-chef-app',
    environment: env.isProduction
      ? 'production'
      : env.isStaging
      ? 'staging'
      : 'development',
    platform: Platform.OS,
    instanceId: `${Platform.OS}_${getDeviceId()}`,
    flushIntervals: {
      metrics: env.isDevelopment ? 5000 : 10000,
      logs: env.isDevelopment ? 2000 : 5000,
    },
    endpoints: {
      metrics: Config.OTLP_METRICS_ENDPOINT,
      logs: Config.OTLP_LOGS_ENDPOINT,
    },
    metricsAuth:
      Config.OTLP_METRICS_AUTH_USERNAME && Config.OTLP_METRICS_AUTH_PASSWORD
        ? {
            username: Config.OTLP_METRICS_AUTH_USERNAME,
            password: Config.OTLP_METRICS_AUTH_PASSWORD,
          }
        : undefined,
    logsAuth:
      Config.OTLP_LOGS_AUTH_USERNAME && Config.OTLP_LOGS_AUTH_PASSWORD
        ? {
            username: Config.OTLP_LOGS_AUTH_USERNAME,
            password: Config.OTLP_LOGS_AUTH_PASSWORD,
          }
        : undefined,
    transports: {
      http:
        (env.isDevelopment || env.isStaging || env.isProduction) &&
        !!(Config.OTLP_METRICS_ENDPOINT || Config.OTLP_LOGS_ENDPOINT),
      console: false,
    },
  };
};

const telemetryService = new TelemetryService(createTelemetryConfig());

export const Telemetry = {
  log: (message: string, extra?: Record<string, any>) =>
    telemetryService.log('info', message, extra),

  info: (message: string, extra?: Record<string, any>) =>
    telemetryService.log('info', message, extra),

  warn: (message: string, extra?: Record<string, any>) =>
    telemetryService.log('warn', message, extra),

  error: (message: string, extra?: Record<string, any>) =>
    telemetryService.log('error', message, extra),

  debug: (message: string, extra?: Record<string, any>) =>
    telemetryService.log('debug', message, extra),

  increment: (name: string, value = 1, labels: Record<string, string> = {}) =>
    telemetryService.incrementCounter(name, value, labels),

  gauge: (name: string, value: number, labels: Record<string, string> = {}) =>
    telemetryService.recordGauge(name, value, labels),

  histogram: (
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ) => telemetryService.recordHistogram(name, value, labels),

  trackEvent: (eventName: string, properties: Record<string, any> = {}) =>
    telemetryService.trackEvent(eventName, properties),

  trackScreen: (screenName: string, properties: Record<string, any> = {}) =>
    telemetryService.trackScreenView(screenName, properties),

  trackTiming: (
    category: string,
    variable: string,
    duration: number,
    label?: string,
  ) => telemetryService.trackTiming(category, variable, duration, label),

  trackError: (error: Error | string, context?: Record<string, any>) => {
    const { component, operation, isFatal, ...rest } = context || {};
    const details = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      component: typeof component === 'string' ? component : undefined,
      operation: typeof operation === 'string' ? operation : undefined,
      isFatal: typeof isFatal === 'boolean' ? isFatal : undefined,
      context: Object.keys(rest).length > 0 ? rest : undefined,
    };
    telemetryService.trackError(details);
  },

  flush: () => telemetryService.flush(),

  updateConfig: (config: Partial<TelemetryConfig>) =>
    telemetryService.updateConfig(config),

  initialize: () => telemetryService.initialize(),
};

export default telemetryService;
