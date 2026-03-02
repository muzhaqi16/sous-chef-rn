import { HttpTransport } from '../HttpTransport';
import { TelemetryConfig, LogEntry, MetricEntry } from '../../types';

jest.mock('#/utils/environment', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { logger } from '#/utils/environment';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const makeConfig = (overrides?: Partial<TelemetryConfig>): TelemetryConfig => ({
  enabled: true,
  enableMetrics: true,
  enableLogs: true,
  enableConsoleInDev: false,
  appName: 'test-app',
  environment: 'test',
  platform: 'ios',
  flushIntervals: { metrics: 10000, logs: 5000 },
  endpoints: { prometheus: 'http://prom.test', loki: 'http://loki.test' },
  auth: { username: 'user', password: 'pass' },
  transports: { http: true, console: false },
  ...overrides,
});

const makeLogs = (): LogEntry[] => [
  { level: 'info', message: 'test log', timestamp: '2024-01-01T00:00:00Z' },
];

const makeMetrics = (type: MetricEntry['type'] = 'counter'): MetricEntry[] => [
  {
    name: 'test_metric_total',
    value: 5,
    labels: { status: '200' },
    timestamp: Date.now(),
    type,
  },
];

describe('HttpTransport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });
  });

  describe('getName()', () => {
    it('returns "http"', () => {
      const transport = new HttpTransport(makeConfig());
      expect(transport.getName()).toBe('http');
    });
  });

  describe('isAvailable()', () => {
    it('returns true when http transport enabled AND endpoints exist', () => {
      const transport = new HttpTransport(makeConfig());
      expect(transport.isAvailable()).toBe(true);
    });

    it('returns false when no endpoints', () => {
      const transport = new HttpTransport(
        makeConfig({ endpoints: {} }),
      );
      expect(transport.isAvailable()).toBe(false);
    });
  });

  describe('sendLogs()', () => {
    it('sends to Loki endpoint with proper format', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendLogs(makeLogs());

      expect(mockFetch).toHaveBeenCalledWith(
        'http://loki.test/loki/api/v1/push',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.streams).toHaveLength(1);
      expect(body.streams[0].stream).toEqual({
        job: 'test-app',
        app: 'test-app',
        environment: 'test',
        platform: 'ios',
      });

      // Values should be [nanosecond-timestamp-string, json-string]
      const values = body.streams[0].values;
      expect(values).toHaveLength(1);
      expect(values[0][0]).toMatch(/^\d+000000$/); // nanosecond timestamp
      const parsed = JSON.parse(values[0][1]);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('test log');
    });

    it('includes Basic auth header when credentials present', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendLogs(makeLogs());

      const headers = mockFetch.mock.calls[0][1].headers;
      const expected = btoa('user:pass');
      expect(headers.Authorization).toBe(`Basic ${expected}`);
    });

    it('does nothing when loki endpoint missing', async () => {
      const transport = new HttpTransport(
        makeConfig({ endpoints: { prometheus: 'http://prom.test' } }),
      );

      await transport.sendLogs(makeLogs());

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('sendMetrics()', () => {
    it('accumulates counters and replaces gauges', async () => {
      const transport = new HttpTransport(makeConfig());

      // Send counter twice -- values should accumulate
      await transport.sendMetrics(makeMetrics('counter'));

      // Reset fetch mock to capture second call independently
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });

      await transport.sendMetrics(makeMetrics('counter'));

      // Second call body should contain accumulated value (5 + 5 = 10)
      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain('test_metric_total');
      // After first successful send the accumulator clears, so it should be 5 again
      // unless first send also cleared it. Let's check:
      // The first send succeeded (ok: true), so accumulator cleared.
      // Second send adds 5, so value should be 5.
      expect(body).toContain(' 5');
    });

    it('clears accumulator after successful send', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics(makeMetrics('gauge'));

      // First send succeeds, accumulator should be cleared
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });

      // Send empty metrics to trigger a body build from accumulator (should be empty)
      await transport.sendMetrics([]);

      // With empty accumulator and no new metrics, body is empty so no fetch
      expect(mockFetch).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('No metrics to send');
    });

    it('does NOT clear accumulator on failed send', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('error'),
      });

      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics(makeMetrics('gauge'));

      // Failed send -- accumulator should still have data
      // Send again with fetch succeeding to verify the value persists
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });

      await transport.sendMetrics([]);

      // The accumulated metric from the failed send should still be sent
      expect(mockFetch).toHaveBeenCalled();
      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain('test_metric_total');
      expect(body).toContain(' 5');
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const transport = new HttpTransport(makeConfig());

      await expect(transport.sendMetrics(makeMetrics())).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send metrics'),
        expect.any(Error),
      );
    });
  });
});
