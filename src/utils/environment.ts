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

  /**
   * Check if we're in testing mode
   */
  static isTesting(): boolean {
    return Environment.getConfig().isTesting;
  }

  /**
   * Whether this build accepts an auth state handed to it through launch
   * arguments (`simctl launch --args`, `am start --es`).
   *
   * A NAMED capability with its own build flag, default off, rather than
   * something inherited from an environment designation. The property "a build
   * people receive does not accept an injected session" previously held by
   * three unrelated mechanisms agreeing — CI writing `NODE_ENV=production` for
   * prod, `NODE_ENV=staging` for stg, and the `dev` branch writing no NODE_ENV
   * and being saved only by `__DEV__` being false in a release bundle. None of
   * them is about this capability, so a build path added later inherits it
   * silently. `.env` carries `NODE_ENV=development`, which every LOCAL release
   * variant falls through to, so `isDevelopment()` is not the gate either.
   *
   * Set it only for a local measuring build (`MODE=release npm run ios`,
   * Android `localRelease`). `scripts/check-launch-arg-auth.mjs` fails the
   * build if it is ever on alongside a production or staging NODE_ENV.
   */
  static allowsLaunchArgAuth(): boolean {
    // `__DEV__` covers every debug build, including Detox's. It is a
    // COMPILE-TIME constant that the bundler eliminates from release output,
    // so it cannot leak the capability into a shipped binary — unlike
    // `isDevelopment()`, which reads `NODE_ENV` from the bundled env and is
    // therefore true in a local RELEASE build too. That difference is the
    // whole reason this gate exists.
    //
    // Without this clause the flag had to reach Metro, and for a debug build
    // Metro is a separate process started by `npm start` that no build command
    // can hand a variable to — so Detox token injection broke silently: an
    // ignored launch arg looks exactly like one that was never passed.
    //
    // The build flag remains the ONLY way a release build gets the capability.
    return __DEV__ || env.ALLOW_LAUNCH_ARG_AUTH === 'true';
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
 * Log-level-gated console wrapper for local/device diagnostics only.
 *
 * This writes to the device console and nothing else — it does NOT reach the
 * telemetry pipeline (Loki/Grafana). It intentionally cannot: the telemetry
 * service imports this module, so routing `logger` through `Telemetry` would
 * create a circular dependency.
 *
 * For anything that must be observable in production (caught errors in
 * mutations, data fetches, action handlers), use
 * `errorService.reportError(error, { operation })` instead — it logs in dev
 * AND forwards to telemetry. Reserve `logger` for developer-facing trace/debug
 * output.
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
