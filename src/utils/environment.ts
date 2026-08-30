import { Platform } from 'react-native';
import { env, type Env } from '#/config/env';
import { appConfig } from '#/config/appConfig';

type ConfigValue = string | number | boolean | undefined;
// Pure-JS build-time config (see scripts/generate-env.js). The return type
// follows the fallback — a string fallback yields `string`.
const getConfigValue = <T extends ConfigValue>(
  key: keyof Env,
  fallback: T,
): string | T => env[key] ?? fallback;

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

  static isTesting(): boolean {
    return Environment.getConfig().isTesting;
  }

  /**
   * Whether this build accepts an auth state from launch arguments: a NAMED
   * capability with its own build flag, default off, NOT inherited from a
   * NODE_ENV (every LOCAL release variant falls through to `development`). Set
   * it only for a local measuring build; `check-launch-arg-auth.mjs` enforces.
   */
  static allowsLaunchArgAuth(): boolean {
    // `__DEV__` covers every debug build, Detox's included, and is a
    // COMPILE-TIME constant the bundler strips from release output — so unlike
    // `isDevelopment()` it cannot leak the capability into a shipped binary.
    // It is also the only way a debug build gets it: Metro is a separate
    // process no build command can hand a variable to.
    return __DEV__ || env.ALLOW_LAUNCH_ARG_AUTH === 'true';
  }

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
      // warn/error always reach the Metro console so failure paths (error
      // boundaries, storage/keychain fallbacks) stay visible while developing;
      // ENABLE_DEBUG_LOGS opts into the chattier debug/info levels.
      return getConfigValue('ENABLE_DEBUG_LOGS', false) ? 'debug' : 'warn';
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
 * Device console only — this does NOT reach telemetry, and cannot: the telemetry
 * service imports this module. For anything that must be observable in
 * production use `errorService.reportError(error, { operation })`, which logs in
 * dev AND forwards. Reserve `logger` for developer-facing trace output.
 */
export const logger = {
  debug: (...args: unknown[]) => {
    if (Environment.getLogLevel() === 'debug') {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (['debug', 'info'].includes(Environment.getLogLevel())) {
      console.info('[INFO]', ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (['debug', 'info', 'warn'].includes(Environment.getLogLevel())) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (Environment.getLogLevel() !== 'none') {
      console.error('[ERROR]', ...args);
    }
  },
  production: (...args: unknown[]) => {
    // Always log in production for critical issues
    if (Environment.isProduction()) {
      console.error('[PROD]', ...args);
    }
  },
};
