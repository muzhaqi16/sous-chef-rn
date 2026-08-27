// This suite tests the real Environment class — opt out of the global
// auto-mock applied by jest.setup.js.
jest.unmock('#/utils/environment');

import { Environment, getWebAppUrl, logger } from '../environment';
import { env } from '#/config/env';

beforeEach(() => {
  Environment.clearCache();
});

describe('environment', () => {
  describe('Environment', () => {
    it('returns a config object', () => {
      const config = Environment.getConfig();
      expect(config).toHaveProperty('isDevelopment');
      expect(config).toHaveProperty('isProduction');
      expect(config).toHaveProperty('isStaging');
      expect(config).toHaveProperty('isTesting');
      expect(config).toHaveProperty('platform');
      expect(config).toHaveProperty('buildMode');
    });

    it('caches config on second call', () => {
      const config1 = Environment.getConfig();
      const config2 = Environment.getConfig();
      expect(config1).toBe(config2);
    });

    it('clearCache resets cached config', () => {
      const config1 = Environment.getConfig();
      Environment.clearCache();
      const config2 = Environment.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('isTesting returns true in test environment', () => {
      expect(Environment.isTesting()).toBe(true);
    });

    it('getPlatform returns a valid platform', () => {
      expect(['ios', 'android', 'web']).toContain(Environment.getPlatform());
    });

    it('isDevelopment returns a boolean', () => {
      expect(typeof Environment.isDevelopment()).toBe('boolean');
    });

    it('isProduction returns a boolean', () => {
      expect(typeof Environment.isProduction()).toBe('boolean');
    });

    it('isStaging returns a boolean', () => {
      expect(typeof Environment.isStaging()).toBe('boolean');
    });

    it('shouldEnableDebugFeatures returns a boolean', () => {
      expect(typeof Environment.shouldEnableDebugFeatures()).toBe('boolean');
    });

    it('shouldEnableCrashReporting returns a boolean', () => {
      expect(typeof Environment.shouldEnableCrashReporting()).toBe('boolean');
    });

    it('shouldEnableAnalytics returns a boolean', () => {
      expect(typeof Environment.shouldEnableAnalytics()).toBe('boolean');
    });

    it('getLogLevel returns a valid log level', () => {
      const validLevels = ['debug', 'info', 'warn', 'error', 'none'];
      expect(validLevels).toContain(Environment.getLogLevel());
    });

    it('getApiConfig returns config with all fields', () => {
      const apiConfig = Environment.getApiConfig();
      expect(apiConfig).toHaveProperty('baseUrl');
      expect(apiConfig).toHaveProperty('wsUrl');
      expect(apiConfig).toHaveProperty('timeout');
      expect(apiConfig).toHaveProperty('retries');
    });
  });

  describe('allowsLaunchArgAuth', () => {
    // Accepting an auth state from launch arguments is a named capability, and
    // the point of this gate is that a build people RECEIVE cannot have it.
    // Every previous gate leaked: `!isProduction()` handed it to any variant
    // that merely forgot to say it was production, and `isDevelopment()` reads
    // `NODE_ENV` from the bundled env — which `.env` sets to `development`, so
    // a local RELEASE build resolved it true.
    const withDev = (value: boolean, fn: () => void) => {
      const g = global as unknown as { __DEV__: boolean };
      const previous = g.__DEV__;
      g.__DEV__ = value;
      try {
        fn();
      } finally {
        g.__DEV__ = previous;
      }
    };

    const withFlag = (value: string | undefined, fn: () => void) => {
      // The real `env` object, not a mock: this suite tests the real
      // Environment, and the gate reads the bundled value directly.
      const mutable = env as Record<string, string | undefined>;
      const previous = mutable.ALLOW_LAUNCH_ARG_AUTH;
      mutable.ALLOW_LAUNCH_ARG_AUTH = value;
      try {
        fn();
      } finally {
        mutable.ALLOW_LAUNCH_ARG_AUTH = previous;
      }
    };

    // NODE_ENV comes from the BUILD MACHINE's env file, which is gitignored:
    // a local `.env` carries `development`, CI generates the module with the
    // key undefined. A test asserting what a NODE_ENV value implies has to set
    // it. Clearing the cache is what makes the write visible — `getConfig()`
    // memoizes on first read.
    const withNodeEnv = (value: string | undefined, fn: () => void) => {
      const mutable = env as Record<string, string | undefined>;
      const previous = mutable.NODE_ENV;
      mutable.NODE_ENV = value;
      Environment.clearCache();
      try {
        fn();
      } finally {
        mutable.NODE_ENV = previous;
        Environment.clearCache();
      }
    };

    it('is on in a debug build, with no build flag needed', () => {
      // Covers Detox: its builds run xcodebuild/gradlew directly, never the
      // run scripts, and for a debug build Metro is a separate process no
      // build command can hand a variable to.
      withDev(true, () =>
        withFlag(undefined, () => {
          expect(Environment.allowsLaunchArgAuth()).toBe(true);
        }),
      );
    });

    it('is on in a release build that explicitly opted in', () => {
      withDev(false, () =>
        withFlag('true', () => {
          expect(Environment.allowsLaunchArgAuth()).toBe(true);
        }),
      );
    });

    it('is OFF in a release build that did not opt in', () => {
      withDev(false, () =>
        withFlag(undefined, () => {
          expect(Environment.allowsLaunchArgAuth()).toBe(false);
        }),
      );
    });

    it('is OFF in a release build even when NODE_ENV says development', () => {
      // The exact shape that made the old gate wrong: `.env` carries
      // NODE_ENV=development and every LOCAL release variant falls through to
      // it, so a gate reading the environment said yes here.
      withDev(false, () =>
        withFlag(undefined, () =>
          withNodeEnv('development', () => {
            expect(Environment.isDevelopment()).toBe(true);
            expect(Environment.allowsLaunchArgAuth()).toBe(false);
          }),
        ),
      );
    });

    it('the shared mock default agrees with the real function under Jest', () => {
      // A globally auto-mocked module that INVERTS the thing it stands in for
      // disables coverage everywhere without failing anything. This mock
      // defaulted to `false` while the real function returns `true` under Jest
      // (`__DEV__` is defined true by @react-native/jest-preset), so every
      // suite that rendered `useStartupInit` without an explicit override
      // skipped `injectDetoxLaunchArgs` entirely — a renamed launch arg or a
      // parse change inside it passed CI untouched, which is how the Detox
      // auth break in deaf9d4c reached main.
      //
      // Compared against the REAL function rather than asserted as a literal,
      // so changing the real gate's behaviour under test fails here instead of
      // silently re-opening the gap.
      const real = Environment.allowsLaunchArgAuth();

      const mocked = jest.requireActual<{
        Environment: { allowsLaunchArgAuth: () => boolean };
      }>('../__mocks__/environment');

      expect(mocked.Environment.allowsLaunchArgAuth()).toBe(real);
    });
  });

  describe('getWebAppUrl', () => {
    it('returns base URL without path', () => {
      const url = getWebAppUrl();
      expect(url).toMatch(/^https?:\/\//);
    });

    it('appends path to base URL', () => {
      const url = getWebAppUrl('/privacy');
      expect(url).toContain('/privacy');
    });
  });

  describe('logger', () => {
    it('has all log methods', () => {
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.production).toBe('function');
    });

    it('does not throw when calling log methods', () => {
      expect(() => logger.debug('test')).not.toThrow();
      expect(() => logger.info('test')).not.toThrow();
      expect(() => logger.warn('test')).not.toThrow();
      expect(() => logger.error('test')).not.toThrow();
      expect(() => logger.production('test')).not.toThrow();
    });
  });
});
