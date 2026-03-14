import { Observable } from '@apollo/client';
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

jest.mock('#/utils/environment', () => ({
  Environment: {
    shouldEnableAnalytics: jest.fn(),
    isDevelopment: jest.fn(),
    getApiConfig: jest.fn(() => ({ wsUrl: 'ws://localhost:4000/graphql' })),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      network: { isConnected: true },
    })),
  },
}));

jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn((err: any) => ({
    message: err?.message || 'Unknown',
    name: err?.name || 'Error',
    stack: err?.stack,
  })),
}));

import { createTelemetryLink } from '../telemetryLink';

const mockedEnvironment = Environment as jest.Mocked<typeof Environment>;
const mockedPerformance = performance as jest.Mocked<typeof performance>;

// Helper to create a mock operation
const createMockOperation = (name: string, type: string = 'query') => ({
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
const createMockForward = (response: any = { data: {} }) => {
  return jest.fn(
    () =>
      new Observable(observer => {
        observer.next(response);
        observer.complete();
      }),
  );
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

      (link as any).request(operation, forward);

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

      const result = (link as any).request(operation, forward);
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

      const result = (link as any).request(operation, forward);
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

      (link as any).request(operation, forward);

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

      const result = (link as any).request(operation, forward);
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

  describe('timing and reporting', () => {
    it('reports duration via histogram on successful response', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = createMockOperation('GetUser', 'query');
      const forward = createMockForward({ data: { user: { id: '1' } } });

      const result = (link as any).request(operation, forward);
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

      const result = (link as any).request(operation, forward);
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

      const result = (link as any).request(operation, forward);
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

      const result = (link as any).request(operation, forward);
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

      const forward = jest.fn(
        () =>
          new Observable(observer => {
            observer.error(networkError);
          }),
      );

      const result = (link as any).request(operation, forward);
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
  });

  describe('operation types', () => {
    it('identifies unnamed operations as "unnamed"', done => {
      mockedEnvironment.shouldEnableAnalytics.mockReturnValue(false);
      mockedEnvironment.isDevelopment.mockReturnValue(true);

      const link = createTelemetryLink();
      const operation = {
        operationName: '',
        query: {
          definitions: [{ kind: 'OperationDefinition', operation: 'query' }],
        },
        variables: {},
        setContext: jest.fn(),
        getContext: jest.fn(() => ({})),
      };
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
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

      const result = (link as any).request(operation, forward);
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
