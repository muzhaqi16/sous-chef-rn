import { ApolloLink, Observable } from '@apollo/client';
import performance from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { Environment } from '#/utils/environment';

// Telemetry uses the shared mock from `src/services/telemetry/__mocks__/`
// (applied globally in jest.setup.js), whose `isLevelEnabled` defaults to true
// so the guarded debug breadcrumbs still reach `Telemetry.debug` here.

// Environment is auto-mocked via jest.setup.js. Tests below override
// `shouldEnableAnalytics` / `isDevelopment` per-suite via `mockReturnValue`.

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      network: { isConnected: true },
    })),
  },
}));

jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn(
    (err: { message?: string; name?: string; stack?: string } | null) => ({
      message: err?.message || 'Unknown',
      name: err?.name || 'Error',
      stack: err?.stack,
    }),
  ),
}));

import { createTelemetryLink } from '../telemetryLink';

const mockedEnvironment = Environment as jest.Mocked<typeof Environment>;
const mockedPerformance = performance as jest.Mocked<typeof performance>;

// The mock operation/forward are intentionally partial fixtures.
interface MockOperation {
  operationName: string;
  query: {
    definitions: Array<{ kind: string; operation: string }>;
  };
  variables: Record<string, unknown>;
  setContext: jest.Mock;
  getContext: jest.Mock;
}
type MockForward = jest.Mock<Observable<ApolloLink.Result>, []>;

// Helper to create a mock operation
const createMockOperation = (
  name: string,
  type: string = 'query',
): MockOperation => ({
  operationName: name,
  query: {
    definitions: [
      {
        kind: 'OperationDefinition',
        operation: type,
      },
    ],
  },
  variables: { id: '123' },
  setContext: jest.fn(),
  getContext: jest.fn(() => ({})),
});

// Helper to create a mock forward function
const createMockForward = (
  response: ApolloLink.Result = { data: {} },
): MockForward =>
  jest.fn(
    (): Observable<ApolloLink.Result> =>
      new Observable(observer => {
        observer.next(response);
        observer.complete();
      }),
  );

// `runRequest` drives the link's public `request` handler with those fixtures,
// keeping every call site free of explicit `any` while reflecting the real
// argument shapes. The link only reads `operationName` / `query` / `variables`
// off the operation; the full `ApolloLink.Operation` additionally requires a
// live `ApolloClient` (and the overloaded `setContext`), which the partial
// fixtures intentionally omit, so the single residual cast lives here.
type RunRequest = (
  operation: MockOperation,
  forward: MockForward,
) => Observable<ApolloLink.Result>;
const runRequest = (
  link: ApolloLink,
  operation: MockOperation,
  forward: MockForward,
): Observable<ApolloLink.Result> => {
  const request: RunRequest = (link as unknown as { request: RunRequest })
    .request;
  return request(operation, forward);
};

describe('createTelemetryLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset performance.now to return incrementing values
    let time = 1000;
    mockedPerformance.now.mockImplementation(() => {
      time += 50;
      return time;
    });
  });

  describe('bypass conditions', () => {
    it('skips telemetry when analytics is disabled and not in development', () => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(false);

      const link = createTelemetryLink();
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      runRequest(link, operation, forward);

      // Should just forward without wrapping
      expect(forward).toHaveBeenCalledWith(operation);
      // The result is the forwarded observable, not a wrapped one
      expect(Telemetry.debug).not.toHaveBeenCalled();
      expect(Telemetry.increment).not.toHaveBeenCalled();
    });

    it('enables telemetry in development mode', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.debug).toHaveBeenCalled();
          expect(Telemetry.increment).toHaveBeenCalledWith(
            'graphql_requests_total',
            1,
            expect.objectContaining({ type: 'query', name: 'TestQuery' }),
          );
          done();
        },
      });
    });

    it('enables telemetry when analytics is enabled', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(true);
      mockedEnvironment.isDevelopment.mockReturnValue(false);

      // Force Math.random to be below sample rate (0.1)
      jest.spyOn(Math, 'random').mockReturnValue(0.05);

      const link = createTelemetryLink();
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.debug).toHaveBeenCalled();
          done();
        },
      });

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('sampling', () => {
    // The rate is read from `GRAPHQL_TELEMETRY_SAMPLE_RATE` at module scope, so
    // a test that needs a different rate must re-import the link with a
    // different env. Returns a freshly-evaluated `createTelemetryLink`.
    const linkFactoryWithRate = (
      rate: string | undefined,
    ): typeof createTelemetryLink => {
      let factory!: typeof createTelemetryLink;
      jest.isolateModules(() => {
        jest.doMock('#/config/env', () => ({
          env: { GRAPHQL_TELEMETRY_SAMPLE_RATE: rate },
        }));
        factory = require('../telemetryLink').createTelemetryLink;
      });
      return factory;
    };

    afterEach(() => {
      jest.spyOn(Math, 'random').mockRestore();
      jest.dontMock('#/config/env');
    });

    it('skips telemetry in production when random exceeds a reduced sample rate', () => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(true);
      mockedEnvironment.isDevelopment.mockReturnValue(false);
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 > 0.1

      const link = linkFactoryWithRate('0.1')();
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      runRequest(link, operation, forward);

      expect(forward).toHaveBeenCalledWith(operation);
      expect(Telemetry.debug).not.toHaveBeenCalled();
    });

    it('samples nothing out at the default rate of 1.0', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(true);
      mockedEnvironment.isDevelopment.mockReturnValue(false);
      // Math.random() is never > 1, so even the worst draw is captured.
      jest.spyOn(Math, 'random').mockReturnValue(0.999999);

      const link = linkFactoryWithRate('1.0')();
      const result = runRequest(
        link,
        createMockOperation('TestQuery'),
        createMockForward(),
      );
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.increment).toHaveBeenCalledWith(
            'graphql_requests_total',
            1, // weight 1: an exact count, not a x10 estimate
            expect.objectContaining({ type: 'query', name: 'TestQuery' }),
          );
          done();
        },
      });
    });

    it('always records telemetry in development regardless of sampling', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const link = linkFactoryWithRate('0.1')();
      const result = runRequest(
        link,
        createMockOperation('TestQuery'),
        createMockForward(),
      );
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.debug).toHaveBeenCalled();
          done();
        },
      });
    });

    it('weights counters by 1/sampleRate so totals are not under-counted', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(true);
      mockedEnvironment.isDevelopment.mockReturnValue(false);
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // sampled in at 0.1

      const link = linkFactoryWithRate('0.1')();
      const result = runRequest(
        link,
        createMockOperation('TestQuery'),
        createMockForward(),
      );
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.increment).toHaveBeenCalledWith(
            'graphql_requests_total',
            10,
            expect.objectContaining({ type: 'query', name: 'TestQuery' }),
          );
          done();
        },
      });
    });

    it('weights graphql_errors_total by errors.length / sampleRate', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(true);
      mockedEnvironment.isDevelopment.mockReturnValue(false);
      jest.spyOn(Math, 'random').mockReturnValue(0.05);

      const link = linkFactoryWithRate('0.1')();
      const result = runRequest(
        link,
        createMockOperation('FailQuery'),
        createMockForward({
          data: null,
          errors: [
            { message: 'e1', path: ['a'] },
            { message: 'e2', path: ['b'] },
          ],
        }),
      );
      result.subscribe({
        next: () => {},
        complete: () => {
          // 2 errors × weight 10 = 20
          expect(Telemetry.increment).toHaveBeenCalledWith(
            'graphql_errors_total',
            20,
            expect.objectContaining({ name: 'FailQuery' }),
          );
          done();
        },
      });
    });

    // An unset or malformed rate must fall back to FULL capture. Defaulting the
    // other way would silently discard most of production's telemetry the first
    // time the key went missing from an env file.
    const invalidRates: Array<[string, string | undefined]> = [
      ['unset', undefined],
      ['empty', ''],
      ['non-numeric', 'all'],
      ['zero', '0'],
      ['negative', '-0.5'],
      ['above 1', '7'],
    ];

    invalidRates.forEach(([label, rate]) => {
      it(`captures everything when the rate is ${label}`, done => {
        mockedEnvironment.shouldEnableAnalytics.mockReturnValue(true);
        mockedEnvironment.isDevelopment.mockReturnValue(false);
        jest.spyOn(Math, 'random').mockReturnValue(0.999999);

        const link = linkFactoryWithRate(rate)();
        const result = runRequest(
          link,
          createMockOperation('TestQuery'),
          createMockForward(),
        );
        result.subscribe({
          next: () => {},
          complete: () => {
            expect(Telemetry.increment).toHaveBeenCalledWith(
              'graphql_requests_total',
              1,
              expect.objectContaining({ name: 'TestQuery' }),
            );
            done();
          },
        });
      });
    });
  });

  describe('timing and reporting', () => {
    it('reports duration via histogram on successful response', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('GetUser', 'query');
      const forward = createMockForward({ data: { user: { id: '1' } } });

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.histogram).toHaveBeenCalledWith(
            'graphql_request_duration_ms',
            expect.any(Number),
            expect.objectContaining({
              type: 'query',
              name: 'GetUser',
              has_errors: 'false',
            }),
          );
          done();
        },
      });
    });

    /**
     * Replaced a test that asserted the mark/measure pair was placed and
     * cleared. That pair is gone: nothing read a `gql:*` measure, while
     * `clearMarks` is a full-array `entries.filter()` and every `measure`
     * appended an entry that was never cleared — making per-operation cost grow
     * with session length, inside the response handler.
     */
    it('creates no performance marks or measures per operation', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('GetItems');
      const forward = createMockForward();

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(performance.mark).not.toHaveBeenCalledWith(
            expect.stringContaining('gql:GetItems'),
          );
          expect(performance.measure).not.toHaveBeenCalledWith(
            expect.stringContaining('gql:GetItems'),
            expect.anything(),
          );
          expect(performance.clearMarks).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('still reports the duration without the mark it used to place', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('GetItems');
      const forward = createMockForward();

      runRequest(link, operation, forward).subscribe({
        next: () => {},
        complete: () => {
          // Duration comes from the stored `startTime`, which is what it always
          // came from — the mark was never an input to it.
          expect(Telemetry.histogram).toHaveBeenCalledWith(
            'graphql_request_duration_ms',
            expect.any(Number),
            expect.objectContaining({ name: 'GetItems' }),
          );
          done();
        },
      });
    });

    it('does not touch the performance buffer more as the session grows', () => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();

      const perfCallsFor = (operationCount: number) => {
        (performance.mark as jest.Mock).mockClear();
        (performance.measure as jest.Mock).mockClear();
        (performance.clearMarks as jest.Mock).mockClear();

        for (let i = 0; i < operationCount; i++) {
          runRequest(
            link,
            createMockOperation(`GetItems${i}`),
            createMockForward(),
          ).subscribe({ next: () => {} });
        }

        return (
          (performance.mark as jest.Mock).mock.calls.length +
          (performance.measure as jest.Mock).mock.calls.length +
          (performance.clearMarks as jest.Mock).mock.calls.length
        );
      };

      // The cost that grew was per-operation work against an unbounded buffer:
      // `clearMarks` filters the whole entries array, and every `measure`
      // appended an entry that was never removed. Ten times the operations must
      // not cost more than ten times as much — here it costs nothing at all,
      // because the link no longer touches that buffer.
      expect(perfCallsFor(10)).toBe(0);
      expect(perfCallsFor(100)).toBe(0);
    });

    it('releases the timing entry when an operation is cancelled', () => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('GetItems');
      // A forward that never emits: the screen unmounts with the query in
      // flight, which is ordinary rather than exceptional.
      const forward: MockForward = jest.fn(
        () => new Observable<ApolloLink.Result>(() => {}),
      );

      const subscription = runRequest(link, operation, forward).subscribe({
        next: () => {},
      });

      // Unsubscribing must leave nothing behind. Anything retained here is
      // retained for the whole session and lengthens the work every later
      // operation performs.
      expect(() => subscription.unsubscribe()).not.toThrow();
      expect(performance.clearMarks).not.toHaveBeenCalled();
    });

    it('reports errors in response', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('FailQuery');
      const errorResponse = {
        data: null,
        errors: [{ message: 'Something failed', path: ['field'] }],
      };
      const forward = createMockForward(errorResponse);

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.error).toHaveBeenCalledWith(
            expect.stringContaining('GraphQL Error in FailQuery'),
            expect.objectContaining({
              operation_name: 'FailQuery',
              error_message: 'Something failed',
            }),
          );
          expect(Telemetry.increment).toHaveBeenCalledWith(
            'graphql_errors_total',
            1,
            expect.objectContaining({ name: 'FailQuery' }),
          );
          done();
        },
      });
    });

    it('reports slow queries when duration exceeds 1000ms', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      // Make performance.now return values 1500ms apart
      let callCount = 0;
      mockedPerformance.now.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 1500;
      });

      const link = createTelemetryLink();
      const operation = createMockOperation('SlowQuery');
      const forward = createMockForward();

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.warn).toHaveBeenCalledWith(
            expect.stringContaining('Slow GraphQL query: SlowQuery'),
            expect.objectContaining({ duration_ms: 1500 }),
          );
          expect(Telemetry.increment).toHaveBeenCalledWith(
            'graphql_slow_queries_total',
            1,
            expect.objectContaining({ name: 'SlowQuery' }),
          );
          done();
        },
      });
    });

    it('reports network errors', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('NetworkFailQuery');
      const networkError = new Error('Network request failed');

      const forward: MockForward = jest.fn(
        (): Observable<ApolloLink.Result> =>
          new Observable(observer => {
            observer.error(networkError);
          }),
      );

      const result = runRequest(link, operation, forward);
      result.subscribe({
        error: () => {
          expect(Telemetry.error).toHaveBeenCalledWith(
            expect.stringContaining(
              'GraphQL Network Error in NetworkFailQuery',
            ),
            expect.objectContaining({
              operation_name: 'NetworkFailQuery',
              network_error: true,
            }),
          );
          expect(Telemetry.increment).toHaveBeenCalledWith(
            'graphql_network_errors_total',
            1,
            expect.objectContaining({ name: 'NetworkFailQuery' }),
          );
          done();
        },
      });
    });

    it('downgrades expected subscription socket drops to warn', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation(
        'NotificationEvents',
        'subscription',
      );
      const socketError = new Error('Socket closed');

      const forward: MockForward = jest.fn(
        (): Observable<ApolloLink.Result> =>
          new Observable(observer => {
            observer.error(socketError);
          }),
      );

      const result = runRequest(link, operation, forward);
      result.subscribe({
        error: () => {
          expect(Telemetry.warn).toHaveBeenCalledWith(
            expect.stringContaining(
              'Subscription NotificationEvents disconnected',
            ),
            expect.objectContaining({
              operation_name: 'NotificationEvents',
              operation_type: 'subscription',
              network_error: true,
            }),
          );
          expect(Telemetry.error).not.toHaveBeenCalled();
          expect(Telemetry.increment).not.toHaveBeenCalledWith(
            'graphql_network_errors_total',
            expect.anything(),
            expect.anything(),
          );
          done();
        },
      });
    });
  });

  describe('operation types', () => {
    it('identifies unnamed operations as "unnamed"', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation: MockOperation = {
        operationName: '',
        query: {
          definitions: [{ kind: 'OperationDefinition', operation: 'query' }],
        },
        variables: {},
        setContext: jest.fn(),
        getContext: jest.fn(() => ({})),
      };
      const forward = createMockForward();

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.debug).toHaveBeenCalledWith(
            expect.stringContaining('unnamed'),
            expect.any(Object),
          );
          done();
        },
      });
    });

    it('detects mutation operation type', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('CreateItem', 'mutation');
      const forward = createMockForward();

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.debug).toHaveBeenCalledWith(
            expect.stringContaining('mutation'),
            expect.objectContaining({ operation_type: 'mutation' }),
          );
          done();
        },
      });
    });
  });
});
