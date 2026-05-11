// This suite tests the real Environment class — opt out of the global
// auto-mock applied by jest.setup.js.
jest.unmock('#/utils/environment');

import { Environment, getWebAppUrl, logger } from '../environment';

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
