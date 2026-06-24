import { ApolloLink, Observable } from '@apollo/client';
import performance from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { Environment } from '#/utils/environment';

// Mock dependencies
jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    increment: jest.fn(),
    histogram: jest.fn(),
  },
}));

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
    it('skips telemetry in production when random exceeds sample rate', () => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(true);
      mockedEnvironment.isDevelopment.mockReturnValue(false);

      // Math.random() returns 0.5 > PRODUCTION_SAMPLE_RATE (0.1)
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const link = createTelemetryLink();
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      runRequest(link, operation, forward);

      expect(forward).toHaveBeenCalledWith(operation);
      // Telemetry should not be invoked since sampled out
      expect(Telemetry.debug).not.toHaveBeenCalled();

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('always records telemetry in development regardless of sampling', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      // Even with high random value, dev mode should always record
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

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

    it('weights counters by 1/sampleRate in production so totals are not under-counted', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(true);
      mockedEnvironment.isDevelopment.mockReturnValue(false);
      // Sampled in (0.05 < 0.1). Each sampled op stands for 10 real ones.
      jest.spyOn(Math, 'random').mockReturnValue(0.05);

      const link = createTelemetryLink();
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(Telemetry.increment).toHaveBeenCalledWith(
            'graphql_requests_total',
            10,
            expect.objectContaining({ type: 'query', name: 'TestQuery' }),
          );
          jest.spyOn(Math, 'random').mockRestore();
          done();
        },
      });
    });

    it('weights graphql_errors_total by errors.length / sampleRate in production', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(true);
      mockedEnvironment.isDevelopment.mockReturnValue(false);
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // sampled in

      const link = createTelemetryLink();
      const operation = createMockOperation('FailQuery');
      const forward = createMockForward({
        data: null,
        errors: [
          { message: 'e1', path: ['a'] },
          { message: 'e2', path: ['b'] },
        ],
      });

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          // 2 errors × weight 10 = 20
          expect(Telemetry.increment).toHaveBeenCalledWith(
            'graphql_errors_total',
            20,
            expect.objectContaining({ name: 'FailQuery' }),
          );
          jest.spyOn(Math, 'random').mockRestore();
          done();
        },
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

    it('places and clears performance marks', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('GetItems');
      const forward = createMockForward();

      const result = runRequest(link, operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(performance.mark).toHaveBeenCalledWith(
            expect.stringContaining('gql:GetItems'),
          );
          expect(performance.clearMarks).toHaveBeenCalled();
          done();
        },
      });
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
