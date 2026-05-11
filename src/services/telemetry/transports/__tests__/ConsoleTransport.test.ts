import { ConsoleTransport } from '../ConsoleTransport';
import { LogEntry, MetricEntry } from '../../types';
// Environment is auto-mocked via jest.setup.js; we override `isDevelopment`
// per-test to exercise both dev and prod branches of the transport.
import { Environment } from '#/utils/environment';

const mockIsDevelopment = Environment.isDevelopment as jest.Mock;

describe('ConsoleTransport', () => {
  let transport: ConsoleTransport;

  beforeEach(() => {
    jest.clearAllMocks();
    transport = new ConsoleTransport();
  });

  describe('getName()', () => {
    it('returns "console"', () => {
      expect(transport.getName()).toBe('console');
    });
  });

  describe('isAvailable()', () => {
    it('delegates to Environment.isDevelopment()', () => {
      mockIsDevelopment.mockReturnValue(true);
      expect(transport.isAvailable()).toBe(true);
      expect(mockIsDevelopment).toHaveBeenCalled();

      mockIsDevelopment.mockReturnValue(false);
      expect(transport.isAvailable()).toBe(false);
    });
  });

  describe('sendLogs()', () => {
    const makeLogs = (
      level: LogEntry['level'],
      message = 'test message',
    ): LogEntry[] => [{ level, message, timestamp: new Date().toISOString() }];

    it('does nothing when not available', async () => {
      mockIsDevelopment.mockReturnValue(false);

      await transport.sendLogs(makeLogs('info'));

      expect(console.log).not.toHaveBeenCalled();
    });

    it('does nothing when enabledInDev is false even in dev', async () => {
      mockIsDevelopment.mockReturnValue(true);
      const disabledTransport = new ConsoleTransport(false);
      const spy = jest.spyOn(console, 'info').mockImplementation();

      await disabledTransport.sendLogs(makeLogs('info'));

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('routes debug to console.log', async () => {
      mockIsDevelopment.mockReturnValue(true);

      await transport.sendLogs(makeLogs('debug'));

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[TELEMETRY-DEBUG]'),
        'test message',
        '',
      );
    });

    it('routes info to console.info', async () => {
      mockIsDevelopment.mockReturnValue(true);
      const spy = jest.spyOn(console, 'info').mockImplementation();

      await transport.sendLogs(makeLogs('info'));

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[TELEMETRY-INFO]'),
        'test message',
        '',
      );
      spy.mockRestore();
    });

    it('routes warn to console.warn', async () => {
      mockIsDevelopment.mockReturnValue(true);

      await transport.sendLogs(makeLogs('warn'));

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[TELEMETRY-WARN]'),
        'test message',
        '',
      );
    });

    it('routes error to console.error', async () => {
      mockIsDevelopment.mockReturnValue(true);

      await transport.sendLogs(makeLogs('error'));

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[TELEMETRY-ERROR]'),
        'test message',
        '',
      );
    });

    it('handles undefined level gracefully with console.warn', async () => {
      mockIsDevelopment.mockReturnValue(true);

      const badLog = { message: 'bad' } as unknown as LogEntry;
      await transport.sendLogs([badLog]);

      expect(console.warn).toHaveBeenCalledWith(
        '[TELEMETRY] Received log with undefined level:',
        badLog,
      );
    });
  });

  describe('sendMetrics()', () => {
    const makeMetrics = (): MetricEntry[] => [
      {
        name: 'http_requests_total',
        value: 42,
        labels: { method: 'GET', path: '/api' },
        timestamp: Date.now(),
        type: 'counter',
      },
    ];

    it('logs each metric with proper format', async () => {
      mockIsDevelopment.mockReturnValue(true);

      await transport.sendMetrics(makeMetrics());

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          '[TELEMETRY-METRIC] http_requests_total{method="GET", path="/api"} = 42',
        ),
      );
    });

    it('does nothing when not available', async () => {
      mockIsDevelopment.mockReturnValue(false);

      await transport.sendMetrics(makeMetrics());

      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
