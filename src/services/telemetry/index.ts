import { Platform } from 'react-native';
import { env as buildEnv } from '#/config/env';
import { TelemetryService } from './TelemetryService';
import { TelemetryConfig } from './types';
import { getVersion } from 'react-native-device-info';
import { Environment } from '#/utils/environment';

const createTelemetryConfig = (): TelemetryConfig => {
  const env = Environment.getConfig();

  return {
    enabled: Environment.shouldEnableAnalytics() || Environment.isDevelopment(),
    enableMetrics:
      Environment.shouldEnableAnalytics() || Environment.isDevelopment(),
    enableLogs: true,
    enableConsoleInDev: false,
    // Production ships only warn+error to Loki; staging adds info; dev keeps
    // everything. Prevents debug/info chatter (e.g. GraphQL traces) from
    // flooding Loki in production.
    minLogLevel: env.isProduction ? 'warn' : env.isStaging ? 'info' : 'debug',
    appName: 'sous-chef-app',
    environment: env.isProduction
      ? 'production'
      : env.isStaging
      ? 'staging'
      : 'development',
    platform: Platform.OS,
    // Coarse instance id (platform + app version), NOT per-device: a
    // per-device id becomes the `instance` label on every series and
    // multiplies active series by the install base in Prometheus. Per-device
    // identity, when needed, belongs on logs (Loki), not metric labels.
    instanceId: `${Platform.OS}_${getVersion()}`,
    flushIntervals: {
      metrics: env.isDevelopment ? 5000 : 10000,
      logs: env.isDevelopment ? 2000 : 5000,
    },
    endpoints: {
      metrics: buildEnv.OTLP_METRICS_ENDPOINT,
      logs: buildEnv.OTLP_LOGS_ENDPOINT,
    },
    metricsAuth:
      buildEnv.OTLP_METRICS_AUTH_USERNAME && buildEnv.OTLP_METRICS_AUTH_PASSWORD
        ? {
            username: buildEnv.OTLP_METRICS_AUTH_USERNAME,
            password: buildEnv.OTLP_METRICS_AUTH_PASSWORD,
          }
        : undefined,
    logsAuth:
      buildEnv.OTLP_LOGS_AUTH_USERNAME && buildEnv.OTLP_LOGS_AUTH_PASSWORD
        ? {
            username: buildEnv.OTLP_LOGS_AUTH_USERNAME,
            password: buildEnv.OTLP_LOGS_AUTH_PASSWORD,
          }
        : undefined,
    transports: {
      http:
        (env.isDevelopment || env.isStaging || env.isProduction) &&
        !!(buildEnv.OTLP_METRICS_ENDPOINT || buildEnv.OTLP_LOGS_ENDPOINT),
      console: false,
    },
  };
};

let telemetryService: TelemetryService | null = null;

function getService(): TelemetryService {
  if (!telemetryService) {
    telemetryService = new TelemetryService(createTelemetryConfig());
  }
  return telemetryService;
}

export const Telemetry = {
  log: (message: string, extra?: Record<string, any>) =>
    getService().log('info', message, extra),

  info: (message: string, extra?: Record<string, any>) =>
    getService().log('info', message, extra),

  warn: (message: string, extra?: Record<string, any>) =>
    getService().log('warn', message, extra),

  error: (message: string, extra?: Record<string, any>) =>
    getService().log('error', message, extra),

  debug: (message: string, extra?: Record<string, any>) =>
    getService().log('debug', message, extra),

  increment: (name: string, value = 1, labels: Record<string, string> = {}) =>
    getService().incrementCounter(name, value, labels),

  gauge: (name: string, value: number, labels: Record<string, string> = {}) =>
    getService().recordGauge(name, value, labels),

  histogram: (
    name: string,
    value: number,
    labels: Record<string, string> = {},
    bounds?: number[],
  ) => getService().recordHistogram(name, value, labels, bounds),

  trackEvent: (eventName: string, properties: Record<string, any> = {}) =>
    getService().trackEvent(eventName, properties),

  trackScreen: (screenName: string, properties: Record<string, any> = {}) =>
    getService().trackScreenView(screenName, properties),

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
    getService().trackError(details);
  },

  flush: () => getService().flush(),

  updateConfig: (config: Partial<TelemetryConfig>) =>
    getService().updateConfig(config),

  initialize: () => getService().initialize(),
};
