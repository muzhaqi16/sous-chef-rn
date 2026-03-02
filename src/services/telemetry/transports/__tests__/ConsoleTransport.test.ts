import { ConsoleTransport } from '../ConsoleTransport';
import { LogEntry, MetricEntry } from '../../types';

jest.mock('#/utils/environment', () => ({
  Environment: { isDevelopment: jest.fn() },
}));

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
    const makeLogs = (level: LogEntry['level'], message = 'test message'): LogEntry[] => [
      { level, message, timestamp: new Date().toISOString() },
    ];

    it('does nothing when not available', async () => {
      mockIsDevelopment.mockReturnValue(false);
      const spy = jest.spyOn(console, 'log').mockImplementation();

      await transport.sendLogs(makeLogs('info'));

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
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
      const spy = jest.spyOn(console, 'log').mockImplementation();

      await transport.sendLogs(makeLogs('debug'));

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[TELEMETRY-DEBUG]'),
        'test message',
        '',
      );
      spy.mockRestore();
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
      const spy = jest.spyOn(console, 'warn').mockImplementation();

      await transport.sendLogs(makeLogs('warn'));

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[TELEMETRY-WARN]'),
        'test message',
        '',
      );
      spy.mockRestore();
    });

    it('routes error to console.error', async () => {
      mockIsDevelopment.mockReturnValue(true);
      const spy = jest.spyOn(console, 'error').mockImplementation();

      await transport.sendLogs(makeLogs('error'));

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[TELEMETRY-ERROR]'),
        'test message',
        '',
      );
      spy.mockRestore();
    });

    it('handles undefined level gracefully with console.warn', async () => {
      mockIsDevelopment.mockReturnValue(true);
      const spy = jest.spyOn(console, 'warn').mockImplementation();

      const badLog = { message: 'bad' } as unknown as LogEntry;
      await transport.sendLogs([badLog]);

      expect(spy).toHaveBeenCalledWith(
        '[TELEMETRY] Received log with undefined level:',
        badLog,
      );
      spy.mockRestore();
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
      const spy = jest.spyOn(console, 'log').mockImplementation();

      await transport.sendMetrics(makeMetrics());

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[TELEMETRY-METRIC] http_requests_total{method="GET", path="/api"} = 42'),
      );
      spy.mockRestore();
    });

    it('does nothing when not available', async () => {
      mockIsDevelopment.mockReturnValue(false);
      const spy = jest.spyOn(console, 'log').mockImplementation();

      await transport.sendMetrics(makeMetrics());

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
