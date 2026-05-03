import { Platform } from 'react-native';
import Config from 'react-native-config';
import { appConfig } from '#/config/appConfig';

// justified: react-native-config doesn't provide typed keys — dynamic string access requires `as any`
const getConfigValue = (key: string, fallback: any = undefined) => {
  return (Config as any)[key] ?? fallback;
};

/**
 * Get web app URL for external links (privacy policy, terms, etc.)
 */
export const getWebAppUrl = (path: string = ''): string => {
  const baseUrl = getConfigValue('WEB_APP_URL', appConfig.identity.webAppUrl);
  return `${baseUrl}${path}`;
};

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isStaging: boolean;
  isTesting: boolean;
  platform: 'ios' | 'android' | 'web';
  buildMode: 'debug' | 'release';
}

/**
 * Environment detection and configuration
 */
export class Environment {
  private static _config: EnvironmentConfig | null = null;

  /**
   * Get current environment configuration
   */
  static getConfig(): EnvironmentConfig {
    if (Environment._config) {
      return Environment._config;
    }

    const nodeEnv = getConfigValue(
      'NODE_ENV',
      __DEV__ ? 'development' : 'production',
    );

    const config: EnvironmentConfig = {
      isDevelopment: nodeEnv === 'development' || __DEV__,
      isProduction: nodeEnv === 'production',
      isStaging: nodeEnv === 'staging',
      isTesting:
        nodeEnv === 'testing' ||
        nodeEnv === 'test' ||
        process.env.NODE_ENV === 'test',
      platform: Platform.OS as 'ios' | 'android' | 'web',
      buildMode: __DEV__ ? 'debug' : 'release',
    };

    Environment._config = config;
    return config;
  }

  /**
   * Check if we're in development mode
   */
  static isDevelopment(): boolean {
    return Environment.getConfig().isDevelopment;
  }

  /**
   * Check if we're in production mode
   */
  static isProduction(): boolean {
    return Environment.getConfig().isProduction;
  }

  /**
   * Check if we're in staging mode
   */
  static isStaging(): boolean {
    return Environment.getConfig().isStaging;
  }

  /**
   * Check if we're in testing mode
   */
  static isTesting(): boolean {
    return Environment.getConfig().isTesting;
  }

  /**
   * Get current platform
   */
  static getPlatform(): 'ios' | 'android' | 'web' {
    return Environment.getConfig().platform;
  }

  /**
   * Check if debug features should be enabled
   */
  static shouldEnableDebugFeatures(): boolean {
    const config = Environment.getConfig();
    return config.isDevelopment || config.isStaging;
  }

  /**
   * Check if crash reporting should be enabled
   */
  static shouldEnableCrashReporting(): boolean {
    const config = Environment.getConfig();

    // Enable crash reporting in production and staging
    return config.isProduction || config.isStaging;
  }

  /**
   * Check if analytics should be enabled
   */
  static shouldEnableAnalytics(): boolean {
    const config = Environment.getConfig();

    // Enable analytics in production and staging (but not in dev/test)
    return (config.isProduction || config.isStaging) && !config.isTesting;
  }

  /**
   * Get appropriate log level
   */
  static getLogLevel(): 'debug' | 'info' | 'warn' | 'error' | 'none' {
    const config = Environment.getConfig();

    if (config.isDevelopment) {
      return getConfigValue('ENABLE_DEBUG_LOGS', false) ? 'debug' : 'none';
    }

    if (config.isStaging) {
      return 'info';
    }

    if (config.isProduction) {
      return getConfigValue('ENABLE_PRODUCTION_LOGS', false) ? 'warn' : 'error';
    }

    if (config.isTesting) {
      return 'none';
    }

    return 'error';
  }

  /**
   * Get environment-specific API configuration
   */
  static getApiConfig() {
    const config = Environment.getConfig();

    if (config.isDevelopment) {
      return {
        baseUrl: getConfigValue('DEV_API_URL', 'http://localhost:4000/graphql'),
        wsUrl: getConfigValue('DEV_WS_URL', 'ws://localhost:4000/graphql'),
        timeout: 10000,
        retries: 3,
      };
    }

    if (config.isStaging) {
      return {
        baseUrl: getConfigValue(
          'STAGING_API_URL',
          'https://staging-api.souschef.dev/graphql',
        ),
        wsUrl: getConfigValue(
          'STAGING_WS_URL',
          'wss://staging-api.souschef.dev/graphql',
        ),
        timeout: 10000,
        retries: 2,
      };
    }

    // Production
    return {
      baseUrl: getConfigValue(
        'PROD_API_URL',
        'https://api.souschef.dev/graphql',
      ),
      wsUrl: getConfigValue('PROD_WS_URL', 'wss://api.souschef.dev/graphql'),
      timeout: 10000,
      retries: 1,
    };
  }

  /**
   * Clear cached config (useful for testing)
   */
  static clearCache(): void {
    Environment._config = null;
  }
}

/**
 * Conditional logging helper
 */
export const logger = {
  debug: (...args: any[]) => {
    if (Environment.getLogLevel() === 'debug') {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (['debug', 'info'].includes(Environment.getLogLevel())) {
      console.info('[INFO]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (['debug', 'info', 'warn'].includes(Environment.getLogLevel())) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args: any[]) => {
    if (Environment.getLogLevel() !== 'none') {
      console.error('[ERROR]', ...args);
    }
  },
  production: (...args: any[]) => {
    // Always log in production for critical issues
    if (Environment.isProduction()) {
      console.error('[PROD]', ...args);
    }
  },
};

/**
 * Feature flags based on environment
 */
export const FeatureFlags = {
  enableBiometrics:
    Environment.shouldEnableDebugFeatures() || Environment.isProduction(),
  enableCrashReporting: Environment.shouldEnableCrashReporting(),
  enableAnalytics: Environment.shouldEnableAnalytics(),
  enablePerformanceMonitoring:
    Environment.isProduction() || Environment.isStaging(),
  enableDetailedLogging: Environment.isDevelopment(),
  enableDevTools: Environment.isDevelopment(),
  enableTestMode: Environment.isTesting(),
};
