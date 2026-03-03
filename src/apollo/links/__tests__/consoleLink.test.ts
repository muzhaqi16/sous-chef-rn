import { Observable } from '@apollo/client';
import performance from 'react-native-performance';

jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn((err: any) => ({
    message: err?.message || 'Unknown',
    name: err?.name || 'Error',
  })),
  safeStringifyError: jest.fn((val: any) => ({
    stringified: JSON.stringify(val),
    isCircular: false,
  })),
  isTimerCircularStructureError: jest.fn(() => false),
}));

import { createConsoleLink } from '../consoleLink';

const mockedPerformance = performance as jest.Mocked<typeof performance>;

// Helper to create a mock operation
const createMockOperation = (
  name: string,
  type: string = 'query',
  variables: Record<string, any> = {},
) => ({
  operationName: name,
  query: {
    definitions: [
      {
        kind: 'OperationDefinition',
        operation: type,
      },
    ],
    loc: { source: { body: 'query { test }' } },
  },
  variables,
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

describe('createConsoleLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    let time = 100;
    mockedPerformance.now.mockImplementation(() => {
      time += 50;
      return time;
    });
  });

  describe('enabled option', () => {
    it('forwards without logging when disabled', (done) => {
      const link = createConsoleLink({ enabled: false });
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(console.log).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('logs when explicitly enabled', (done) => {
      const link = createConsoleLink({ enabled: true });
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(console.log).toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('logTiming option', () => {
    it('logs timing info with operation name and duration', (done) => {
      const link = createConsoleLink({ enabled: true, logTiming: true });
      const operation = createMockOperation('GetUser');
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const logCalls = jest.mocked(console.log).mock.calls;
          const timingLog = logCalls.find(
            (call: any[]) =>
              typeof call[0] === 'string' && call[0].includes('GetUser'),
          );
          expect(timingLog).toBeDefined();
          expect(timingLog![0]).toContain('QUERY');
          done();
        },
      });
    });

    it('does not log timing when logTiming is false', (done) => {
      const link = createConsoleLink({
        enabled: true,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          // No timing log at all
          const logCalls = jest.mocked(console.log).mock.calls;
          const timingLog = logCalls.find(
            (call: any[]) =>
              typeof call[0] === 'string' && call[0].includes('QUERY'),
          );
          expect(timingLog).toBeUndefined();
          done();
        },
      });
    });

    it('marks subscription operations without timing', (done) => {
      const link = createConsoleLink({ enabled: true, logTiming: true });
      const operation = createMockOperation('OnItemUpdated', 'subscription');
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const logCalls = jest.mocked(console.log).mock.calls;
          const subLog = logCalls.find(
            (call: any[]) =>
              typeof call[0] === 'string' &&
              call[0].includes('SUBSCRIPTION'),
          );
          expect(subLog).toBeDefined();
          // Subscription logs should not include "ms" duration
          expect(subLog![0]).not.toMatch(/\d+ms/);
          done();
        },
      });
    });
  });

  describe('logVariables option', () => {
    it('logs variables when enabled and present', (done) => {
      const link = createConsoleLink({
        enabled: true,
        logVariables: true,
        logTiming: false,
      });
      const operation = createMockOperation('GetUser', 'query', {
        id: '123',
      });
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const varLog = jest.mocked(console.log).mock.calls.find(
            (call: any[]) =>
              typeof call[0] === 'string' && call[0].includes('Variables'),
          );
          expect(varLog).toBeDefined();
          done();
        },
      });
    });

    it('does not log variables when empty', (done) => {
      const link = createConsoleLink({
        enabled: true,
        logVariables: true,
        logTiming: false,
      });
      const operation = createMockOperation('GetUser', 'query', {});
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const varLog = jest.mocked(console.log).mock.calls.find(
            (call: any[]) =>
              typeof call[0] === 'string' && call[0].includes('Variables'),
          );
          expect(varLog).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('logResponse option', () => {
    it('logs response data when enabled', (done) => {
      const link = createConsoleLink({
        enabled: true,
        logResponse: true,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('GetUser');
      const forward = createMockForward({ data: { user: { name: 'Test' } } });

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const dataLog = jest.mocked(console.log).mock.calls.find(
            (call: any[]) =>
              typeof call[0] === 'string' && call[0].includes('Data'),
          );
          expect(dataLog).toBeDefined();
          done();
        },
      });
    });

    it('does not log response when disabled', (done) => {
      const link = createConsoleLink({
        enabled: true,
        logResponse: false,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('GetUser');
      const forward = createMockForward({ data: { user: { name: 'Test' } } });

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const dataLog = jest.mocked(console.log).mock.calls.find(
            (call: any[]) =>
              typeof call[0] === 'string' && call[0].includes('Data'),
          );
          expect(dataLog).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('logQuery option', () => {
    it('logs query body when enabled', (done) => {
      const link = createConsoleLink({
        enabled: true,
        logQuery: true,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('GetUser');
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const queryLog = jest.mocked(console.log).mock.calls.find(
            (call: any[]) =>
              typeof call[0] === 'string' && call[0].includes('Query'),
          );
          expect(queryLog).toBeDefined();
          done();
        },
      });
    });
  });

  describe('error handling', () => {
    it('logs errors from response', (done) => {
      const link = createConsoleLink({
        enabled: true,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('FailQuery');
      const forward = createMockForward({
        data: null,
        errors: [{ message: 'Something went wrong' }],
      });

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Errors'),
            expect.any(String),
          );
          done();
        },
      });
    });

    it('forwards observer errors', (done) => {
      const link = createConsoleLink({ enabled: true });
      const operation = createMockOperation('ErrorQuery');
      const testError = new Error('Network failure');

      const forward = jest.fn(
        () =>
          new Observable(observer => {
            observer.error(testError);
          }),
      );

      const result = (link as any).request(operation, forward);
      result.subscribe({
        error: (err: Error) => {
          expect(err.message).toBe('Network failure');
          done();
        },
      });
    });
  });

  describe('slow query detection', () => {
    it('uses warning style for queries exceeding slowQueryThreshold', (done) => {
      // Make duration exceed threshold
      let callCount = 0;
      mockedPerformance.now.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 2000;
      });

      const link = createConsoleLink({
        enabled: true,
        slowQueryThreshold: 1000,
      });
      const operation = createMockOperation('SlowQuery');
      const forward = createMockForward();

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          // The slow query log should use the warning color style
          const timingCall = jest.mocked(console.log).mock.calls.find(
            (call: any[]) =>
              typeof call[0] === 'string' && call[0].includes('SlowQuery'),
          );
          expect(timingCall).toBeDefined();
          // Second arg is the CSS style; for slow queries it should be amber
          expect(timingCall![1]).toContain('#f59e0b');
          done();
        },
      });
    });
  });

  describe('extensions logging', () => {
    it('logs extensions when present in response', (done) => {
      const link = createConsoleLink({
        enabled: true,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('WithExtensions');
      const forward = createMockForward({
        data: {},
        extensions: { traceId: 'abc-123' },
      });

      const result = (link as any).request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const extLog = jest.mocked(console.log).mock.calls.find(
            (call: any[]) =>
              typeof call[0] === 'string' && call[0].includes('Extensions'),
          );
          expect(extLog).toBeDefined();
          done();
        },
      });
    });
  });
});
