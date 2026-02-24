import { Platform } from 'react-native';
import Config from 'react-native-config';
import { TelemetryService } from './TelemetryService';
import { TelemetryConfig } from './types';
import { Environment } from '#/utils/environment';

const createTelemetryConfig = (): TelemetryConfig => {
  const env = Environment.getConfig();

  const needsAuth = env.isProduction || env.isStaging;

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
    flushIntervals: {
      metrics: env.isDevelopment ? 5000 : 10000,
      logs: env.isDevelopment ? 2000 : 5000,
    },
    endpoints: {
      prometheus: Config.PROMETHEUS_ENDPOINT,
      loki: Config.LOKI_ENDPOINT,
    },
    auth:
      needsAuth &&
      Config.TELEMETRY_AUTH_USERNAME &&
      Config.TELEMETRY_AUTH_PASSWORD
        ? {
            username: Config.TELEMETRY_AUTH_USERNAME,
            password: Config.TELEMETRY_AUTH_PASSWORD,
          }
        : undefined,
    transports: {
      http:
        (env.isDevelopment || env.isStaging || env.isProduction) &&
        !!(Config.PROMETHEUS_ENDPOINT || Config.LOKI_ENDPOINT),
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
    if (typeof error === 'string') {
      telemetryService.trackError({
        message: error,
        context,
      });
    } else {
      telemetryService.trackError({
        message: error.message,
        stack: error.stack,
        context,
      });
    }
  },

  flush: () => telemetryService.flush(),

  updateConfig: (config: Partial<TelemetryConfig>) =>
    telemetryService.updateConfig(config),

  initialize: () => telemetryService.initialize(),
};


export default telemetryService;
