import { HttpTransport } from '../HttpTransport';
import {
  TelemetryConfig,
  LogEntry,
  MetricEntry,
  TransportSendError,
} from '../../types';

import { logger } from '#/utils/environment';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const makeConfig = (overrides?: Partial<TelemetryConfig>): TelemetryConfig => ({
  enabled: true,
  enableMetrics: true,
  enableLogs: true,
  enableConsoleInDev: false,
  minLogLevel: 'debug',
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

interface OtlpAttribute {
  key: string;
  value: { stringValue: string };
}

interface OtlpDataPoint {
  asDouble: number;
  count: string;
  sum: number;
  explicitBounds: number[];
  bucketCounts: string[];
}

interface OtlpMetric {
  name: string;
  sum: {
    isMonotonic: boolean;
    aggregationTemporality: number;
    dataPoints: OtlpDataPoint[];
  };
  gauge: { dataPoints: OtlpDataPoint[] };
  histogram: {
    aggregationTemporality: number;
    dataPoints: OtlpDataPoint[];
  };
}

interface OtlpBody {
  resourceMetrics: Array<{
    resource: { attributes: OtlpAttribute[] };
    scopeMetrics: Array<{ metrics: OtlpMetric[] }>;
  }>;
}

function parseOtlpBody(call: [string, { body: string }]): OtlpBody {
  return JSON.parse(call[1].body);
}

function getOtlpMetrics(body: OtlpBody): OtlpMetric[] {
  return body.resourceMetrics[0].scopeMetrics[0].metrics;
}

function findMetric(metrics: OtlpMetric[], name: string): OtlpMetric {
  const metric = metrics.find(m => m.name === name);
  if (!metric) {
    throw new Error(`metric ${name} not found`);
  }
  return metric;
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
      expect(logRecords[0].severityNumber).toBe(9);

      const parsed = JSON.parse(logRecords[0].body.stringValue);
      expect(parsed.message).toBe('test log');
      // `level` must be in the body so LogQL `| json | level="..."` works.
      expect(parsed.level).toBe('info');
      // timeUnixNano derived from the record's own timestamp (2024-01-01T00:00:00Z),
      // not the flush time, so Loki preserves per-event ordering.
      expect(logRecords[0].timeUnixNano).toBe('1704067200000000000');

      // No exception on the entry → no exception.* attributes on the record.
      const attributeKeys = logRecords[0].attributes.map(
        (a: OtlpAttribute) => a.key,
      );
      expect(attributeKeys).not.toContain('exception.type');
    });

    it('emits OTel exception.* attributes for entries carrying an exception', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendLogs([
        {
          level: 'error',
          message: 'Unhandled Promise Rejection: boom',
          timestamp: '2024-01-01T00:00:00Z',
          exception: {
            type: 'TypeError',
            message: 'boom',
            stacktrace: 'TypeError: boom\n  at foo.js:1',
          },
        },
      ]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const record = body.resourceLogs[0].scopeLogs[0].logRecords[0];
      expect(record.attributes).toEqual(
        expect.arrayContaining([
          { key: 'exception.type', value: { stringValue: 'TypeError' } },
          { key: 'exception.message', value: { stringValue: 'boom' } },
          {
            key: 'exception.stacktrace',
            value: { stringValue: 'TypeError: boom\n  at foo.js:1' },
          },
        ]),
      );
    });

    it('throws on a non-ok response so the service re-buffers instead of losing logs', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('boom'),
      });
      const transport = new HttpTransport(makeConfig());

      await expect(transport.sendLogs(makeLogs())).rejects.toThrow(
        /OTLP logs HTTP 500/,
      );
    });

    // The retryable verdict drives TelemetryService's policy: re-buffer +
    // backoff (transient) vs drop the batch (permanent — the same payload can
    // never succeed against a 404/401 endpoint).
    it.each([
      [408, true],
      [429, true],
      [500, true],
      [503, true],
      [400, false],
      [401, false],
      [404, false],
      [413, false],
    ])('classifies HTTP %i as retryable=%s', async (status, retryable) => {
      mockFetch.mockResolvedValue({
        ok: false,
        status,
        statusText: 'nope',
        text: jest.fn().mockResolvedValue('nope'),
      });
      const transport = new HttpTransport(makeConfig());

      const error: unknown = await transport.sendLogs(makeLogs()).catch(e => e);
      expect(error).toBeInstanceOf(TransportSendError);
      expect((error as TransportSendError).retryable).toBe(retryable);
    });

    it('throws retryable on a fetch rejection (network-level failure)', async () => {
      mockFetch.mockRejectedValue(new Error('Network down'));
      const transport = new HttpTransport(makeConfig());

      const error: unknown = await transport.sendLogs(makeLogs()).catch(e => e);
      expect(error).toBeInstanceOf(TransportSendError);
      expect((error as TransportSendError).retryable).toBe(true);
      expect((error as TransportSendError).message).toContain('Network down');
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
        resource.attributes.map(a => [a.key, a.value.stringValue]),
      );

      expect(attrs['service.name']).toBe('test-app');
      expect(attrs['deployment.environment.name']).toBe('test');
      expect(attrs['os.type']).toBe('ios');
      expect(attrs['service.instance.id']).toBe('ios_device_test123');
    });

    it('serializes counters as OTLP Sum with CUMULATIVE temporality', async () => {
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

      const counter = findMetric(metrics, 'requests_total');
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

      const gauge = findMetric(metrics, 'memory_bytes');
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

      const histogram = findMetric(metrics, 'request_duration_ms');
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

    it('accumulates counters cumulatively across calls (never resets on flush)', async () => {
      const transport = new HttpTransport(makeConfig());

      // First send: value 5
      await transport.sendMetrics(makeMetrics('counter'));

      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });

      // Second send: another 5 — the running total is now 10 (cumulative).
      await transport.sendMetrics(makeMetrics('counter'));

      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);
      const counter = findMetric(metrics, 'test_metric_total');
      expect(counter.sum.dataPoints[0].asDouble).toBe(10);
    });

    it('re-sends the cumulative snapshot on a later flush (does not clear on success)', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics(makeMetrics('gauge')); // value 5

      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });

      // Empty batch, but cumulative state is retained, so the snapshot re-ships.
      await transport.sendMetrics([]);

      expect(mockFetch).toHaveBeenCalled();
      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);
      const gauge = findMetric(metrics, 'test_metric_total');
      expect(gauge.gauge.dataPoints[0].asDouble).toBe(5);
    });

    it('sends nothing when no metrics have ever been recorded', async () => {
      const transport = new HttpTransport(makeConfig());

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

      await expect(transport.sendMetrics(makeMetrics('gauge'))).rejects.toThrow(
        /OTLP metrics HTTP 500/,
      );

      // Failed send — accumulators retained
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({ ok: true, status: 200, text: jest.fn() });

      await transport.sendMetrics([]);

      // Retained metric from failed send should still be present
      expect(mockFetch).toHaveBeenCalled();
      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const metrics = getOtlpMetrics(body);
      const gauge = findMetric(metrics, 'test_metric_total');
      expect(gauge.gauge.dataPoints[0].asDouble).toBe(5);
    });

    it('throws retryable on a fetch rejection so the service backs off and retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const transport = new HttpTransport(makeConfig());

      const error: unknown = await transport
        .sendMetrics(makeMetrics())
        .catch(e => e);
      expect(error).toBeInstanceOf(TransportSendError);
      expect((error as TransportSendError).retryable).toBe(true);
    });

    it('throws non-retryable on a 404 (misconfigured endpoint)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('404 page not found'),
      });

      const transport = new HttpTransport(makeConfig());

      const error: unknown = await transport
        .sendMetrics(makeMetrics())
        .catch(e => e);
      expect(error).toBeInstanceOf(TransportSendError);
      expect((error as TransportSendError).retryable).toBe(false);
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
      const httpRequests = metrics.filter(m => m.name === 'http_requests');
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
      const histogram = findMetric(metrics, 'timing_ms');
      const counts = histogram.histogram.dataPoints[0].bucketCounts.map(Number);

      expect(counts[0]).toBe(1); // 10 → (-Inf, 10]
      expect(counts[9]).toBe(1); // 10000 → (5000, 10000]
      expect(counts[10]).toBe(1); // 99999 → (10000, +Inf)
    });

    it('uses per-metric explicit bounds when provided', async () => {
      const transport = new HttpTransport(makeConfig());

      await transport.sendMetrics([
        {
          name: 'coverage_ratio',
          value: 0.85,
          labels: {},
          timestamp: Date.now(),
          type: 'histogram',
          bounds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        },
      ]);

      const body = parseOtlpBody(mockFetch.mock.calls[0]);
      const histogram = findMetric(getOtlpMetrics(body), 'coverage_ratio');
      const dp = histogram.histogram.dataPoints[0];

      expect(dp.explicitBounds).toEqual([
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
      ]);
      expect(dp.sum).toBe(0.85);
      expect(dp.count).toBe('1');
      const counts = dp.bucketCounts.map(Number);
      expect(counts).toHaveLength(11); // 10 bounds + overflow
      expect(counts[8]).toBe(1); // 0.85 ≤ 0.9 → bucket index 8
    });
  });
});
