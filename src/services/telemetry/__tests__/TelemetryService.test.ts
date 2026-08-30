import { TelemetryService } from '../TelemetryService';
import { TransportSendError } from '../types';

// Mutable so individual tests can simulate consent being granted/denied and
// the device going offline. Names are `mock`-prefixed so they may be
// referenced inside the jest.mock factory.
let mockUserConsent: boolean | null = null;
let mockIsOnline = true;
jest.mock('#store', () => ({
  useStore: {
    getState: () => ({ userConsent: mockUserConsent, isOnline: mockIsOnline }),
  },
}));

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

describe('TelemetryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUserConsent = null; // default: consent not denied
    mockIsOnline = true; // default: device online
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
      const service = new TelemetryService({
        transports: { http: true, console: false },
      });
      expect(HttpTransport).toHaveBeenCalled();
      expect(service).toBeDefined();
    });
  });

  // ------------------------------------------------------------------ initialize
  describe('initialize', () => {
    it('sets isInitialized and tracks app_telemetry_initialized event', async () => {
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

      await service.flush();
      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'app_events_total',
            type: 'counter',
          }),
        ]),
      );
    });

    it('emits no metric of its own from initialize()', async () => {
      // `initialize()` is called synchronously from the startup hydration
      // effect, so anything it emits is the FIRST labelled metric of a cold
      // start — and resolving `device_type` means `isEmulatorSync()`, a binder
      // IPC on Android hardware and free on an emulator. Emitting from here put
      // that read inside the very window `app_startup_duration_ms` and
      // `app_fully_drawn_ms` measure, on real devices only, biasing the
      // comparison the label exists to enable. `app_starts_total` now comes
      // from `useStartupInit`'s idle callback instead.
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
      });

      service.initialize();
      await service.flush();

      const metricNames = mockSendMetrics.mock.calls
        .flatMap(([metrics]) => metrics as { name: string }[])
        .map(m => m.name);
      expect(metricNames).not.toContain('app_starts_total');
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
      const service = new TelemetryService({
        enabled: false,
        enableLogs: true,
      });
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

    it('carries the commit SHA so a log is traceable to code', async () => {
      // The counterpart to keeping the SHA off metric labels: on logs it is a
      // body field, searchable with `| json | git_sha="..."`, and it is what
      // ties a run to the build that produced it.
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });
      service.log('info', 'hello');
      await service.flush();
      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            extra: expect.objectContaining({ git_sha: expect.any(String) }),
          }),
        ]),
      );
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
          expect.objectContaining({
            level: 'error',
            message: 'critical failure',
          }),
        ]),
      );
    });

    it('drops entries below minLogLevel before buffering', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        minLogLevel: 'warn',
      });
      service.log('debug', 'dbg');
      service.log('info', 'nfo');
      await service.flush();
      expect(mockSendLogs).not.toHaveBeenCalled();

      service.log('warn', 'warning');
      await service.flush();
      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ level: 'warn', message: 'warning' }),
        ]),
      );
    });

    // `isLevelEnabled` exists so a hot-path caller can skip BUILDING a payload
    // that `log` would discard on the next line. If it ever inverted, those
    // call sites would go silent in development with nothing failing, so both
    // directions are pinned here.
    describe('isLevelEnabled', () => {
      const prodLike = () =>
        new TelemetryService({
          enabled: true,
          enableLogs: true,
          minLogLevel: 'warn',
        });

      it('reports the floor that log() actually enforces', () => {
        const service = prodLike();
        expect(service.isLevelEnabled('debug')).toBe(false);
        expect(service.isLevelEnabled('info')).toBe(false);
        expect(service.isLevelEnabled('warn')).toBe(true);
        expect(service.isLevelEnabled('error')).toBe(true);
      });

      it('agrees with log() for every level', async () => {
        const service = prodLike();
        for (const level of ['debug', 'info', 'warn', 'error'] as const) {
          mockSendLogs.mockClear();
          service.log(level, `msg-${level}`);
          await service.flush();
          expect(mockSendLogs.mock.calls.length > 0).toBe(
            service.isLevelEnabled(level),
          );
        }
      });

      it('is false when logging is off entirely, whatever the level', () => {
        expect(
          new TelemetryService({
            enabled: false,
            enableLogs: true,
            minLogLevel: 'debug',
          }).isLevelEnabled('error'),
        ).toBe(false);
        expect(
          new TelemetryService({
            enabled: true,
            enableLogs: false,
            minLogLevel: 'debug',
          }).isLevelEnabled('error'),
        ).toBe(false);
      });

      it('is false once the user has denied consent', () => {
        mockUserConsent = false;
        expect(
          new TelemetryService({
            enabled: true,
            enableLogs: true,
            minLogLevel: 'debug',
          }).isLevelEnabled('error'),
        ).toBe(false);
      });
    });

    it('emits nothing when the user has denied consent', async () => {
      mockUserConsent = false;
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
      });

      service.log('error', 'should not ship'); // error would normally auto-flush
      service.incrementCounter('should_not_ship_total');
      await service.flush();

      expect(mockSendLogs).not.toHaveBeenCalled();
      expect(mockSendMetrics).not.toHaveBeenCalled();
    });

    it('redacts sensitive values before buffering', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });

      service.log('warn', 'login for jane@example.com failed', {
        password: 'hunter2',
        note: 'contact bob@corp.io',
      });
      await service.flush();

      const sent = mockSendLogs.mock.calls[0][0][0];
      expect(sent.message).toBe('login for [REDACTED] failed');
      expect(sent.extra.password).toBe('[REDACTED]');
      expect(sent.extra.note).toBe('contact [REDACTED]');
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
              env: 'test-env',
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
              env: 'production',
              region: 'us',
            }),
            value: 5,
          }),
        ]),
      );
    });

    it('labels metrics with the app version, so a build is attributable', async () => {
      // Without this label nothing on a metric says which build produced it:
      // the only other version-bearing dimension is `service.instance.id`, and
      // every Grafana startup panel collapses it with `sum(...) by (le)`.
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
        environment: 'production',
      });
      service.incrementCounter('test', 1);
      await service.flush();
      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            labels: expect.objectContaining({ version: expect.any(String) }),
          }),
        ]),
      );
    });

    it('keeps the commit SHA OFF metric labels', async () => {
      // Every unique label combination is a Prometheus series, multiplied again
      // by histogram buckets. A commit SHA is unbounded — the textbook
      // cardinality bomb. It belongs on logs, where per-run identity already
      // lives as a body field, and this test is what stops it drifting back.
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
        environment: 'production',
      });
      service.incrementCounter('test', 1);
      await service.flush();
      const [metrics] = mockSendMetrics.mock.calls.at(-1) as [
        Array<{ labels: Record<string, string> }>,
      ];
      for (const metric of metrics) {
        expect(Object.keys(metric.labels)).not.toContain('git_sha');
      }
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
    it('creates a single histogram metric entry with the raw value', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.recordHistogram('request_duration', 75);
      await service.flush();

      const metrics = mockSendMetrics.mock.calls[0][0];
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual(
        expect.objectContaining({
          name: 'request_duration',
          value: 75,
          type: 'histogram',
        }),
      );
    });

    it('forwards explicit histogram bounds to the metric entry', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });
      service.recordHistogram('ratio', 0.5, {}, [0.25, 0.5, 0.75, 1.0]);
      await service.flush();

      const metrics = mockSendMetrics.mock.calls[0][0];
      expect(metrics[0].bounds).toEqual([0.25, 0.5, 0.75, 1.0]);
    });

    it('includes platform and environment labels', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
        environment: 'production',
      });
      service.recordHistogram('latency', 100, { host: 'api.test' });
      await service.flush();

      const metrics = mockSendMetrics.mock.calls[0][0];
      expect(metrics[0].labels).toEqual(
        expect.objectContaining({
          platform: 'ios',
          env: 'production',
          host: 'api.test',
        }),
      );
    });

    it('is a no-op when disabled', async () => {
      const service = new TelemetryService({
        enabled: false,
        enableMetrics: true,
      });
      service.recordHistogram('test', 50);
      await service.flush();
      expect(mockSendMetrics).not.toHaveBeenCalled();
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

    it('attaches OTel exception fields to the error log record', () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });
      service.trackError({
        name: 'TypeError',
        message: 'x is not a function',
        stack: 'TypeError: x is not a function\n  at foo.js:1',
      });

      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            exception: {
              type: 'TypeError',
              message: 'x is not a function',
              stacktrace: expect.stringContaining('foo.js'),
            },
          }),
        ]),
      );
    });

    it('defaults exception.type to Error when no name is given', () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });
      service.trackError({ message: 'plain failure' });

      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            exception: { type: 'Error', message: 'plain failure' },
          }),
        ]),
      );
    });
  });

  // ------------------------------------------------------------------ trackEvent
  describe('trackEvent', () => {
    it('increments app_events_total without shipping a duplicate log to Loki', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
        minLogLevel: 'warn', // prod-like: the debug breadcrumb is dropped
      });
      service.trackEvent('button_click', { screen: 'home' });
      await service.flush();

      // The debug breadcrumb is filtered by minLogLevel — no write-amplification.
      expect(mockSendLogs).not.toHaveBeenCalled();

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
    it('increments screen_views_total with screen_name without shipping a duplicate log', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
        enableMetrics: true,
        minLogLevel: 'warn', // prod-like: the debug breadcrumb is dropped
      });
      service.trackScreenView('HomeScreen', { tab: 'recipes' });
      await service.flush();

      // The debug breadcrumb is filtered by minLogLevel — no write-amplification.
      expect(mockSendLogs).not.toHaveBeenCalled();

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

    it('re-buffers logs for retry when a transport send fails (no data loss)', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });

      // First flush rejects → the batch must be re-queued, not dropped.
      mockSendLogs.mockRejectedValueOnce(new Error('gateway down'));
      service.log('warn', 'keep me');
      await service.flush();

      // The failure opens a backoff window — advance past it.
      jest.advanceTimersByTime(5000);

      // Next successful flush ships the re-buffered batch.
      mockSendLogs.mockResolvedValue(undefined);
      await service.flush();

      expect(mockSendLogs).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ level: 'warn', message: 'keep me' }),
        ]),
      );
    });
  });

  // ------------------------------------------------------------------ flush gating
  describe('flush gating (offline + backoff)', () => {
    it('skips log flushes while the device is offline and drains after reconnect', async () => {
      mockIsOnline = false;
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });

      service.log('warn', 'buffered offline');
      await service.flush();
      expect(mockSendLogs).not.toHaveBeenCalled();

      mockIsOnline = true;
      await service.flush();
      expect(mockSendLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ message: 'buffered offline' }),
        ]),
      );
    });

    it('skips the error-triggered immediate flush while offline', () => {
      mockIsOnline = false;
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });

      service.log('error', 'offline error');
      expect(mockSendLogs).not.toHaveBeenCalled();
    });

    it('skips metric flushes while offline without losing entries', async () => {
      mockIsOnline = false;
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });

      service.incrementCounter('offline_counter');
      await service.flush();
      expect(mockSendMetrics).not.toHaveBeenCalled();

      mockIsOnline = true;
      await service.flush();
      expect(mockSendMetrics).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'offline_counter' }),
        ]),
      );
    });

    it('backs off after a failed log flush instead of retrying on every tick', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });

      mockSendLogs.mockRejectedValueOnce(new Error('endpoint down'));
      service.log('warn', 'first');
      await service.flush(); // fails → 5s backoff window opens
      expect(mockSendLogs).toHaveBeenCalledTimes(1);

      // Inside the window: neither a manual flush nor the error-triggered
      // immediate flush fires a request.
      jest.advanceTimersByTime(4000);
      await service.flush();
      service.log('error', 'during backoff');
      expect(mockSendLogs).toHaveBeenCalledTimes(1);

      // Past the window: the retry carries the re-buffered batch plus the
      // entries that arrived during the backoff.
      jest.advanceTimersByTime(1000);
      await service.flush();
      expect(mockSendLogs).toHaveBeenCalledTimes(2);
      expect(mockSendLogs).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ message: 'first' }),
          expect.objectContaining({ message: 'during backoff' }),
        ]),
      );
    });

    it('doubles the backoff on consecutive failures', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });
      mockSendLogs.mockRejectedValue(new Error('endpoint down'));

      service.log('warn', 'x');
      await service.flush(); // failure 1 → 5s window
      jest.advanceTimersByTime(5000);
      await service.flush(); // failure 2 → 10s window
      expect(mockSendLogs).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(5000); // only halfway through the 10s window
      await service.flush();
      expect(mockSendLogs).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(5000);
      await service.flush();
      expect(mockSendLogs).toHaveBeenCalledTimes(3);

      // clearAllMocks does not reset implementations — restore the default.
      mockSendLogs.mockResolvedValue(undefined);
    });

    it('drops the batch on a non-retryable transport error instead of retrying it forever', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });

      mockSendLogs.mockRejectedValueOnce(
        new TransportSendError('OTLP logs HTTP 404', { retryable: false }),
      );
      service.log('warn', 'poisoned');
      await service.flush();

      jest.advanceTimersByTime(5000);
      mockSendLogs.mockResolvedValue(undefined);
      service.log('warn', 'fresh');
      await service.flush();

      // Only the new entry ships — the poisoned batch was dropped.
      expect(mockSendLogs).toHaveBeenLastCalledWith([
        expect.objectContaining({ message: 'fresh' }),
      ]);
    });

    it('retries metrics after a failed send without re-buffering (no double count)', async () => {
      const service = new TelemetryService({
        enabled: true,
        enableMetrics: true,
      });

      mockSendMetrics.mockRejectedValueOnce(
        new TransportSendError('OTLP metrics HTTP 500', { retryable: true }),
      );
      service.incrementCounter('requests_total');
      await service.flush();
      expect(mockSendMetrics).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(5000);
      await service.flush();
      // The retry flush fires with an EMPTY buffer: the cumulative totals
      // live in the transport's accumulators — re-buffering the entries
      // would double-count them.
      expect(mockSendMetrics).toHaveBeenCalledTimes(2);
      expect(mockSendMetrics).toHaveBeenLastCalledWith([]);
    });

    it('logs the outage once and the recovery once (no per-attempt error wall)', async () => {
      const { logger } = jest.requireMock('#/utils/environment');
      const service = new TelemetryService({
        enabled: true,
        enableLogs: true,
      });
      mockSendLogs.mockRejectedValue(new Error('endpoint down'));

      service.log('warn', 'x');
      await service.flush(); // failure 1
      jest.advanceTimersByTime(5000);
      await service.flush(); // failure 2
      jest.advanceTimersByTime(10000);
      await service.flush(); // failure 3
      expect(logger.error).toHaveBeenCalledTimes(1);

      mockSendLogs.mockResolvedValue(undefined);
      jest.advanceTimersByTime(20000);
      await service.flush();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('recovered after 3'),
      );
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
