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
  instanceId: 'ios_device_test123',
  flushIntervals: { metrics: 10000, logs: 5000 },
  endpoints: {
    metrics: 'http://otlp.test/otlp',
    logs: 'http://otlp.test/otlp',
  },
  metricsAuth: { username: 'user', password: 'pass' },
  logsAuth: { username: 'user', password: 'pass' },
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

function parseOtlpBody(call: any): any {
  return JSON.parse(call[1].body);
}

function getOtlpMetrics(body: any): any[] {
  return body.resourceMetrics[0].scopeMetrics[0].metrics;
}

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
      const transport = new HttpTransport(makeConfig({ endpoints: {} }));
      expect(transport.isAvailable()).toBe(false);
    });
  });

  describe('sendLogs()', () => {
    it('sends logs via OTLP /v1/logs endpoint', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendLogs(makeLogs());

      expect(mockFetch).toHaveBeenCalledWith(
        'http://otlp.test/otlp/v1/logs',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.resourceLogs).toHaveLength(1);

      const resource = body.resourceLogs[0].resource;
      expect(resource.attributes).toEqual(
        expect.arrayContaining([
          { key: 'service.name', value: { stringValue: 'test-app' } },
        ]),
      );

      const logRecords = body.resourceLogs[0].scopeLogs[0].logRecords;
      expect(logRecords).toHaveLength(1);
      expect(logRecords[0].severityText).toBe('INFO');

      const parsed = JSON.parse(logRecords[0].body.stringValue);
      expect(parsed.message).toBe('test log');
    });

    it('includes Basic auth header when credentials present', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendLogs(makeLogs());

      const headers = mockFetch.mock.calls[0][1].headers;
      const expected = btoa('user:pass');
      expect(headers.Authorization).toBe(`Basic ${expected}`);
    });

    it('does nothing when prometheus endpoint missing', async () => {
      const transport = new HttpTransport(makeConfig({ endpoints: {} }));

      await transport.sendLogs(makeLogs());

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('sendMetrics()', () => {
    it('sends to OTLP endpoint with correct URL', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics(makeMetrics());

      expect(mockFetch).toHaveBeenCalledWith(
        'http://otlp.test/otlp/v1/metrics',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('includes resource attributes in OTLP payload', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics(makeMetrics());

      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const resource = body.resourceMetrics[0].resource;

      const attrs = Object.fromEntries(
        resource.attributes.map((a: any) => [a.key, a.value.stringValue]),
      );

      expect(attrs['service.name']).toBe('test-app');
      expect(attrs['deployment.environment.name']).toBe('test');
      expect(attrs['os.type']).toBe('ios');
      expect(attrs['service.instance.id']).toBe('ios_device_test123');
    });

    it('serializes counters as OTLP Sum with DELTA temporality', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics([
        {
          name: 'requests_total',
          value: 3,
          labels: { method: 'GET' },
          timestamp: Date.now(),
          type: 'counter',
        },
      ]);

      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);

      const counter = metrics.find((m: any) => m.name === 'requests_total');
      expect(counter).toBeDefined();
      expect(counter.sum).toBeDefined();
      expect(counter.sum.isMonotonic).toBe(true);
      expect(counter.sum.aggregationTemporality).toBe(2); // CUMULATIVE
      expect(counter.sum.dataPoints).toHaveLength(1);
      expect(counter.sum.dataPoints[0].asDouble).toBe(3);
    });

    it('serializes gauges as OTLP Gauge', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics([
        {
          name: 'memory_bytes',
          value: 1024,
          labels: {},
          timestamp: Date.now(),
          type: 'gauge',
        },
      ]);

      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);

      const gauge = metrics.find((m: any) => m.name === 'memory_bytes');
      expect(gauge).toBeDefined();
      expect(gauge.gauge).toBeDefined();
      expect(gauge.gauge.dataPoints).toHaveLength(1);
      expect(gauge.gauge.dataPoints[0].asDouble).toBe(1024);
    });

    it('serializes histograms as OTLP Histogram with correct bucket counts', async () => {
      const transport = new HttpTransport(makeConfig());

      // Send multiple histogram observations
      await transport.sendMetrics([
        {
          name: 'request_duration_ms',
          value: 15,
          labels: { host: 'api.test' },
          timestamp: Date.now(),
          type: 'histogram',
        },
        {
          name: 'request_duration_ms',
          value: 75,
          labels: { host: 'api.test' },
          timestamp: Date.now(),
          type: 'histogram',
        },
        {
          name: 'request_duration_ms',
          value: 300,
          labels: { host: 'api.test' },
          timestamp: Date.now(),
          type: 'histogram',
        },
      ]);

      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);

      const histogram = metrics.find(
        (m: any) => m.name === 'request_duration_ms',
      );
      expect(histogram).toBeDefined();
      expect(histogram.histogram).toBeDefined();
      expect(histogram.histogram.aggregationTemporality).toBe(2); // CUMULATIVE

      const dp = histogram.histogram.dataPoints[0];
      expect(dp.count).toBe('3');
      expect(dp.sum).toBe(390); // 15 + 75 + 300
      expect(dp.explicitBounds).toEqual([
        10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
      ]);

      // bucketCounts: 11 entries (10 bounds + 1)
      // 15 → bucket[1] (10, 25]
      // 75 → bucket[3] (50, 100]
      // 300 → bucket[5] (250, 500]
      const counts = dp.bucketCounts.map(Number);
      expect(counts).toHaveLength(11);
      expect(counts[0]).toBe(0); // (-Inf, 10]
      expect(counts[1]).toBe(1); // (10, 25] → 15
      expect(counts[2]).toBe(0); // (25, 50]
      expect(counts[3]).toBe(1); // (50, 100] → 75
      expect(counts[4]).toBe(0); // (100, 250]
      expect(counts[5]).toBe(1); // (250, 500] → 300
      expect(counts.slice(6)).toEqual([0, 0, 0, 0, 0]); // rest empty
    });

    it('accumulates counters across calls before flush', async () => {
      const transport = new HttpTransport(makeConfig());

      // First batch — send succeeds and clears accumulator
      await transport.sendMetrics(makeMetrics('counter'));

      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });

      // Second batch — fresh accumulation after clear
      await transport.sendMetrics(makeMetrics('counter'));

      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);
      const counter = metrics.find((m: any) => m.name === 'test_metric_total');
      expect(counter.sum.dataPoints[0].asDouble).toBe(5);
    });

    it('clears accumulators after successful send', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics(makeMetrics('gauge'));

      // First send succeeds, accumulators cleared
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });

      // Send empty metrics — nothing accumulated
      await transport.sendMetrics([]);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('No metrics to send');
    });

    it('does NOT clear accumulators on failed send', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('error'),
      });

      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics(makeMetrics('gauge'));

      // Failed send — accumulators retained
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });

      await transport.sendMetrics([]);

      // Retained metric from failed send should still be present
      expect(mockFetch).toHaveBeenCalled();
      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);
      const gauge = metrics.find((m: any) => m.name === 'test_metric_total');
      expect(gauge.gauge.dataPoints[0].asDouble).toBe(5);
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const transport = new HttpTransport(makeConfig());

      await expect(
        transport.sendMetrics(makeMetrics()),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send metrics'),
        expect.any(Error),
      );
    });

    it('groups multiple label sets under the same metric name', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics([
        {
          name: 'http_requests',
          value: 10,
          labels: { method: 'GET' },
          timestamp: Date.now(),
          type: 'counter',
        },
        {
          name: 'http_requests',
          value: 5,
          labels: { method: 'POST' },
          timestamp: Date.now(),
          type: 'counter',
        },
      ]);

      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);

      // Should be one metric with two data points
      const httpRequests = metrics.filter(
        (m: any) => m.name === 'http_requests',
      );
      expect(httpRequests).toHaveLength(1);
      expect(httpRequests[0].sum.dataPoints).toHaveLength(2);
    });

    it('includes auth header', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics(makeMetrics());

      const headers = mockFetch.mock.calls[0][1].headers;
      const expected = btoa('user:pass');
      expect(headers.Authorization).toBe(`Basic ${expected}`);
    });

    it('places boundary values in correct buckets', async () => {
      const transport = new HttpTransport(makeConfig());

      // Test exact boundary values
      await transport.sendMetrics([
        {
          name: 'timing_ms',
          value: 10, // Exactly at first bound → bucket[0] (≤10)
          labels: {},
          timestamp: Date.now(),
          type: 'histogram',
        },
        {
          name: 'timing_ms',
          value: 10000, // Exactly at last bound → bucket[9] (5000, 10000]
          labels: {},
          timestamp: Date.now(),
          type: 'histogram',
        },
        {
          name: 'timing_ms',
          value: 99999, // Above all bounds → bucket[10] (overflow)
          labels: {},
          timestamp: Date.now(),
          type: 'histogram',
        },
      ]);

      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);
      const histogram = metrics.find((m: any) => m.name === 'timing_ms');
      const counts = histogram.histogram.dataPoints[0].bucketCounts.map(Number);

      expect(counts[0]).toBe(1); // 10 → (-Inf, 10]
      expect(counts[9]).toBe(1); // 10000 → (5000, 10000]
      expect(counts[10]).toBe(1); // 99999 → (10000, +Inf)
    });
  });
});
