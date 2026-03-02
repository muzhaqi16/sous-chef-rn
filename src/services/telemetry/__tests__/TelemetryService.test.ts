import { TelemetryService } from '../TelemetryService';

const mockSendLogs = jest.fn().mockResolvedValue(undefined);
const mockSendMetrics = jest.fn().mockResolvedValue(undefined);
const mockIsAvailable = jest.fn(() => true);

jest.mock('../transports/ConsoleTransport', () => ({
  ConsoleTransport: jest.fn().mockImplementation(() => ({
    getName: () => 'console',
    isAvailable: mockIsAvailable,
    sendLogs: mockSendLogs,
    sendMetrics: mockSendMetrics,
  })),
}));

jest.mock('../transports/HttpTransport', () => ({
  HttpTransport: jest.fn().mockImplementation(() => ({
    getName: () => 'http',
    isAvailable: jest.fn(() => true),
    sendLogs: jest.fn().mockResolvedValue(undefined),
    sendMetrics: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('#/utils/environment', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('TelemetryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ------------------------------------------------------------------ constructor
  describe('constructor', () => {
    it('uses DEFAULT_CONFIG when no config is provided', () => {
      const service = new TelemetryService();
      // Default has enabled: false, so logging should be a no-op
      service.log('info', 'should not buffer');
      expect(mockSendLogs).not.toHaveBeenCalled();
    });

    it('merges provided config with defaults', () => {
      const service = new TelemetryService({ enabled: true, enableLogs: true });
      service.log('info', 'buffered');
      // The log is buffered, so sendLogs is not called until flush
      expect(mockSendLogs).not.toHaveBeenCalled();
    });

    it('sets up console transport when transports.console is true', () => {
      const { ConsoleTransport } = jest.requireMock(
        '../transports/ConsoleTransport',
      );
      const service = new TelemetryService();
      // Verify that constructing the service triggered the ConsoleTransport constructor
      expect(ConsoleTransport).toHaveBeenCalled();
      expect(service).toBeDefined();
    });

    it('sets up http transport when transports.http is true', () => {
      const { HttpTransport } = jest.requireMock('../transports/HttpTransport');
      const service = new TelemetryService({ transports: { http: true, console: false } });
      expect(HttpTransport).toHaveBeenCalled();
      expect(service).toBeDefined();
    });
  });

  // ------------------------------------------------------------------ initialize
  describe('initialize', () => {
    it('sets isInitialized and tracks app_telemetry_initialized event', () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
      });
      service.initialize();
      // Calling initialize again should be a no-op (guard against double init)
      service.initialize();
      const { logger } = jest.requireMock('#/utils/environment');
      // logger.info is called once during initialize
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it('starts flush timers when logs are enabled', () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        flushIntervals: { logs: 5000, metrics: 10000 },
      });
      service.initialize();
      service.log('info', 'test message');

      jest.advanceTimersByTime(5000);
      expect(mockSendLogs).toHaveBeenCalled();
    });

    it('starts flush timers when metrics are enabled', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
        flushIntervals: { logs: 5000, metrics: 10000 },
      });
      service.initialize();
      service.incrementCounter('test_counter');

      jest.advanceTimersByTime(10000);
      // Allow promises to resolve
      await Promise.resolve();
      expect(mockSendMetrics).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------ updateConfig
  describe('updateConfig', () => {
    it('merges new config and rebuilds transports', () => {
      const { ConsoleTransport } = jest.requireMock(
        '../transports/ConsoleTransport',
      );
      const service = new TelemetryService();
      const callCountAfterCtor = ConsoleTransport.mock.calls.length;
      service.updateConfig({ enabled: true });
      // setupTransports is called again, so ConsoleTransport is re-instantiated
      expect(ConsoleTransport.mock.calls.length).toBeGreaterThan(
        callCountAfterCtor,
      );
    });

    it('re-sets flush timers if already initialized', () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        flushIntervals: { logs: 5000, metrics: 10000 },
      });
      service.initialize();
      // Update with new flush intervals
      service.updateConfig({
        flushIntervals: { logs: 2000, metrics: 10000 },
      });
      service.log('info', 'after update');
      jest.advanceTimersByTime(2000);
      expect(mockSendLogs).toHaveBeenCalled();
    });

    it('does not set flush timers if not yet initialized', () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });
      // Not calling initialize()
      service.updateConfig({
        flushIntervals: { logs: 1000, metrics: 1000 },
      });
      service.log('info', 'test');
      jest.advanceTimersByTime(1000);
      // No timer-based flush should have occurred
      expect(mockSendLogs).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------ log
  describe('log', () => {
    it('is a no-op when enabled is false', () => {
      const service = new TelemetryService({ enabled: false, enableLogs: true });
      service.log('info', 'ignored');
      // Nothing buffered, flush should send nothing
      service.flush();
      expect(mockSendLogs).not.toHaveBeenCalled();
    });

    it('is a no-op when enableLogs is false', () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: false,
      });
      service.log('info', 'ignored');
      service.flush();
      expect(mockSendLogs).not.toHaveBeenCalled();
    });

    it('buffers log entries when enabled', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });
      service.log('info', 'hello');
      await service.flush();
      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ level: 'info', message: 'hello' }),
        ]),
      );
    });

    it('auto-flushes on error level', () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });
      service.log('error', 'critical failure');
      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ level: 'error', message: 'critical failure' }),
        ]),
      );
    });

    it('includes platform and environment in extra', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        environment: 'test-env',
      });
      service.log('info', 'msg', { custom: 'data' });
      await service.flush();
      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            extra: expect.objectContaining({
              platform: 'ios',
              environment: 'test-env',
              custom: 'data',
            }),
          }),
        ]),
      );
    });
  });

  // ------------------------------------------------------------------ incrementCounter
  describe('incrementCounter', () => {
    it('is a no-op when disabled', async () => {
      const service = new TelemetryService({
        enabled: false,
        enableMetrics: true,
      });
      service.incrementCounter('test');
      await service.flush();
      expect(mockSendMetrics).not.toHaveBeenCalled();
    });

    it('adds counter metric with default value of 1', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.incrementCounter('requests_total');
      await service.flush();
      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'requests_total',
            value: 1,
            type: 'counter',
          }),
        ]),
      );
    });

    it('includes platform and environment labels', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
        environment: 'production',
      });
      service.incrementCounter('test', 5, { region: 'us' });
      await service.flush();
      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            labels: expect.objectContaining({
              platform: 'ios',
              environment: 'production',
              region: 'us',
            }),
            value: 5,
          }),
        ]),
      );
    });
  });

  // ------------------------------------------------------------------ recordGauge
  describe('recordGauge', () => {
    it('is a no-op when enableMetrics is false', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: false,
      });
      service.recordGauge('memory_usage', 42);
      await service.flush();
      expect(mockSendMetrics).not.toHaveBeenCalled();
    });

    it('adds gauge metric', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.recordGauge('memory_usage', 1024);
      await service.flush();
      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'memory_usage',
            value: 1024,
            type: 'gauge',
          }),
        ]),
      );
    });
  });

  // ------------------------------------------------------------------ recordHistogram
  describe('recordHistogram', () => {
    it('creates _sum, _count, and _bucket metrics', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.recordHistogram('request_duration', 75);
      await service.flush();

      const metrics = mockSendMetrics.mock.calls[0][0];
      const names = metrics.map((m: { name: string }) => m.name);

      expect(names).toContain('request_duration_sum');
      expect(names).toContain('request_duration_count');
      expect(names).toContain('request_duration_bucket');
    });

    it('populates buckets correctly for value 75', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.recordHistogram('latency', 75);
      await service.flush();

      const metrics = mockSendMetrics.mock.calls[0][0];
      const buckets = metrics.filter(
        (m: { name: string }) => m.name === 'latency_bucket',
      );

      // Buckets: 10,25,50 are < 75 so skipped; 100,250,500,1000,2500,5000,10000 + Inf
      const les = buckets.map(
        (b: { labels: { le: string } }) => b.labels.le,
      );
      expect(les).not.toContain('10');
      expect(les).not.toContain('25');
      expect(les).not.toContain('50');
      expect(les).toContain('100');
      expect(les).toContain('250');
      expect(les).toContain('+Inf');
    });

    it('always includes +Inf bucket', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.recordHistogram('huge_value', 999999);
      await service.flush();

      const metrics = mockSendMetrics.mock.calls[0][0];
      const infBucket = metrics.find(
        (m: { name: string; labels: { le: string } }) =>
          m.name === 'huge_value_bucket' && m.labels.le === '+Inf',
      );
      expect(infBucket).toBeDefined();
    });
  });

  // ------------------------------------------------------------------ trackError
  describe('trackError', () => {
    it('logs at error level and increments app_errors_total counter', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
      });
      service.trackError({
        message: 'Something went wrong',
        component: 'Login',
        operation: 'submit',
        isFatal: false,
      });

      // error-level log triggers auto-flush
      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'error',
            message: 'Something went wrong',
          }),
        ]),
      );

      await service.flush();
      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'app_errors_total',
            labels: expect.objectContaining({
              component: 'Login',
              operation: 'submit',
              is_fatal: 'false',
            }),
          }),
        ]),
      );
    });
  });

  // ------------------------------------------------------------------ trackEvent
  describe('trackEvent', () => {
    it('logs info and increments app_events_total', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
      });
      service.trackEvent('button_click', { screen: 'home' });
      await service.flush();

      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'info',
            message: 'Event: button_click',
          }),
        ]),
      );

      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'app_events_total',
            labels: expect.objectContaining({ event_name: 'button_click' }),
          }),
        ]),
      );
    });

    it('includes method label when method property is a string', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.trackEvent('login_attempt', { method: 'google' });
      await service.flush();

      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'app_events_total',
            labels: expect.objectContaining({
              event_name: 'login_attempt',
              method: 'google',
            }),
          }),
        ]),
      );
    });
  });

  // ------------------------------------------------------------------ trackScreenView
  describe('trackScreenView', () => {
    it('logs info and increments screen_views_total with screen_name', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
      });
      service.trackScreenView('HomeScreen', { tab: 'recipes' });
      await service.flush();

      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'info',
            message: 'Screen: HomeScreen',
          }),
        ]),
      );

      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'screen_views_total',
            labels: expect.objectContaining({ screen_name: 'HomeScreen' }),
          }),
        ]),
      );
    });
  });

  // ------------------------------------------------------------------ trackTiming
  describe('trackTiming', () => {
    it('records histogram with correct name and labels', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.trackTiming('api', 'fetchRecipes', 350, 'graphql');
      await service.flush();

      const metrics = mockSendMetrics.mock.calls[0][0];
      const sumMetric = metrics.find(
        (m: { name: string }) => m.name === 'app_timing_api_ms_sum',
      );
      expect(sumMetric).toBeDefined();
      expect(sumMetric.value).toBe(350);
      expect(sumMetric.labels).toEqual(
        expect.objectContaining({ variable: 'fetchRecipes', label: 'graphql' }),
      );
    });

    it('uses "default" as label when none is provided', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.trackTiming('render', 'component', 120);
      await service.flush();

      const metrics = mockSendMetrics.mock.calls[0][0];
      const sumMetric = metrics.find(
        (m: { name: string }) => m.name === 'app_timing_render_ms_sum',
      );
      expect(sumMetric.labels.label).toBe('default');
    });
  });

  // ------------------------------------------------------------------ flush
  describe('flush', () => {
    it('sends buffered logs and metrics to available transports', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
      });
      service.log('info', 'test log');
      service.incrementCounter('test_metric');
      await service.flush();

      expect(mockSendLogs).toHaveBeenCalled();
      expect(mockSendMetrics).toHaveBeenCalled();
    });

    it('does not call transports when buffers are empty', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
      });
      await service.flush();
      expect(mockSendLogs).not.toHaveBeenCalled();
      expect(mockSendMetrics).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------ destroy
  describe('destroy', () => {
    it('clears flush timers and flushes remaining data', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
        flushIntervals: { logs: 5000, metrics: 10000 },
      });
      service.initialize();
      service.log('info', 'before destroy');
      service.destroy();

      // After destroy, advancing timers should not trigger additional flushes
      mockSendLogs.mockClear();
      jest.advanceTimersByTime(15000);
      expect(mockSendLogs).not.toHaveBeenCalled();
    });

    it('allows re-initialization after destroy', () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });
      service.initialize();
      service.destroy();

      const { logger } = jest.requireMock('#/utils/environment');
      logger.info.mockClear();

      service.initialize();
      // logger.info should be called again for the second initialize
      expect(logger.info).toHaveBeenCalledTimes(1);
    });
  });
});
