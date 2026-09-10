import { ApolloLink, Observable } from '@apollo/client';
import type { ApolloClient, OperationVariables } from '@apollo/client';
import { OperationTypeNode, parse } from 'graphql';
import performance from 'react-native-performance';

jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn((err: { message?: string; name?: string }) => ({
    message: err?.message || 'Unknown',
    name: err?.name || 'Error',
  })),
  safeStringifyError: jest.fn((val: unknown) => ({
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
  type: OperationTypeNode = OperationTypeNode.QUERY,
  variables: OperationVariables = {},
): ApolloLink.Operation => ({
  operationName: name,
  query: parse(`${type} ${name} { test }`),
  operationType: type,
  variables,
  extensions: {},
  setContext: jest.fn(),
  getContext: jest.fn(() => ({})),
  client: {} as ApolloClient,
});

// Helper to create a mock forward function
const createMockForward = (response: ApolloLink.Result = { data: {} }) => {
  return jest.fn(
    () =>
      new Observable<ApolloLink.Result>(observer => {
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
    it('forwards without logging when disabled', done => {
      const link = createConsoleLink({ enabled: false });
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          expect(console.log).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('logs when explicitly enabled', done => {
      const link = createConsoleLink({ enabled: true });
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      const result = link.request(operation, forward);
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
    it('logs timing info with operation name and duration', done => {
      const link = createConsoleLink({ enabled: true, logTiming: true });
      const operation = createMockOperation('GetUser');
      const forward = createMockForward();

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const logCalls = jest.mocked(console.log).mock.calls;
          const timingLog = logCalls.find(
            call => typeof call[0] === 'string' && call[0].includes('GetUser'),
          );
          expect(timingLog).toBeDefined();
          expect(timingLog![0]).toContain('QUERY');
          done();
        },
      });
    });

    it('does not log timing when logTiming is false', done => {
      const link = createConsoleLink({
        enabled: true,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('TestQuery');
      const forward = createMockForward();

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          // No timing log at all
          const logCalls = jest.mocked(console.log).mock.calls;
          const timingLog = logCalls.find(
            call => typeof call[0] === 'string' && call[0].includes('QUERY'),
          );
          expect(timingLog).toBeUndefined();
          done();
        },
      });
    });

    it('marks subscription operations without timing', done => {
      const link = createConsoleLink({ enabled: true, logTiming: true });
      const operation = createMockOperation(
        'OnItemUpdated',
        OperationTypeNode.SUBSCRIPTION,
      );
      const forward = createMockForward();

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const logCalls = jest.mocked(console.log).mock.calls;
          const subLog = logCalls.find(
            call =>
              typeof call[0] === 'string' && call[0].includes('SUBSCRIPTION'),
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
    it('logs variables when enabled and present', done => {
      const link = createConsoleLink({
        enabled: true,
        logVariables: true,
        logTiming: false,
      });
      const operation = createMockOperation(
        'GetUser',
        OperationTypeNode.QUERY,
        {
          id: '123',
        },
      );
      const forward = createMockForward();

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const varLog = jest
            .mocked(console.log)
            .mock.calls.find(
              call =>
                typeof call[0] === 'string' && call[0].includes('Variables'),
            );
          expect(varLog).toBeDefined();
          done();
        },
      });
    });

    it('does not log variables when empty', done => {
      const link = createConsoleLink({
        enabled: true,
        logVariables: true,
        logTiming: false,
      });
      const operation = createMockOperation(
        'GetUser',
        OperationTypeNode.QUERY,
        {},
      );
      const forward = createMockForward();

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const varLog = jest
            .mocked(console.log)
            .mock.calls.find(
              call =>
                typeof call[0] === 'string' && call[0].includes('Variables'),
            );
          expect(varLog).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('masking credentials in logged variables', () => {
    // Every auth mutation takes a single `$input`, so a mask that reads only
    // top-level keys never sees the credential it exists to hide.
    const logged = (variables: OperationVariables): string => {
      const link = createConsoleLink({
        enabled: true,
        logVariables: true,
        logTiming: false,
      });
      link
        .request(
          createMockOperation('Login', OperationTypeNode.MUTATION, variables),
          createMockForward(),
        )
        .subscribe({ next: () => {}, complete: () => {} });
      return JSON.stringify(jest.mocked(console.log).mock.calls);
    };

    it.each([
      ['Login', { input: { email: 'a@b.c', password: 'hunter2-secret' } }],
      ['Register', { input: { email: 'a@b.c', password: 'hunter2-secret' } }],
      ['ResetPassword', { input: { token: 't', password: 'hunter2-secret' } }],
      [
        'ChangePassword',
        {
          input: {
            currentPassword: 'hunter2-secret',
            newPassword: 'hunter2-secret',
          },
        },
      ],
    ])('masks the credential nested in %s’s $input', (_name, variables) => {
      const out = logged(variables);
      expect(out).not.toContain('hunter2-secret');
      expect(out).toContain('[MASKED]');
    });

    it('masks a refresh token nested in $input', () => {
      const out = logged({ input: { refreshToken: 'rt-secret-value' } });
      expect(out).not.toContain('rt-secret-value');
    });

    it('leaves non-sensitive nested values readable', () => {
      const out = logged({ input: { email: 'a@b.c', password: 'p' } });
      expect(out).toContain('a@b.c');
    });
  });

  describe('logResponse option', () => {
    it('logs response data when enabled', done => {
      const link = createConsoleLink({
        enabled: true,
        logResponse: true,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('GetUser');
      const forward = createMockForward({ data: { user: { name: 'Test' } } });

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const dataLog = jest
            .mocked(console.log)
            .mock.calls.find(
              call => typeof call[0] === 'string' && call[0].includes('Data'),
            );
          expect(dataLog).toBeDefined();
          done();
        },
      });
    });

    it('does not log response when disabled', done => {
      const link = createConsoleLink({
        enabled: true,
        logResponse: false,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('GetUser');
      const forward = createMockForward({ data: { user: { name: 'Test' } } });

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const dataLog = jest
            .mocked(console.log)
            .mock.calls.find(
              call => typeof call[0] === 'string' && call[0].includes('Data'),
            );
          expect(dataLog).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('logQuery option', () => {
    it('logs query body when enabled', done => {
      const link = createConsoleLink({
        enabled: true,
        logQuery: true,
        logTiming: false,
        logVariables: false,
      });
      const operation = createMockOperation('GetUser');
      const forward = createMockForward();

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const queryLog = jest
            .mocked(console.log)
            .mock.calls.find(
              call => typeof call[0] === 'string' && call[0].includes('Query'),
            );
          expect(queryLog).toBeDefined();
          done();
        },
      });
    });
  });

  describe('error handling', () => {
    it('logs errors from response', done => {
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

      const result = link.request(operation, forward);
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

    it('forwards observer errors', done => {
      const link = createConsoleLink({ enabled: true });
      const operation = createMockOperation('ErrorQuery');
      const testError = new Error('Network failure');

      const forward = jest.fn(
        () =>
          new Observable<ApolloLink.Result>(observer => {
            observer.error(testError);
          }),
      );

      const result = link.request(operation, forward);
      result.subscribe({
        error: (err: Error) => {
          expect(err.message).toBe('Network failure');
          done();
        },
      });
    });
  });

  describe('slow query detection', () => {
    it('uses warning style for queries exceeding slowQueryThreshold', done => {
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

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          // The slow query log should use the warning color style
          const timingCall = jest
            .mocked(console.log)
            .mock.calls.find(
              call =>
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
    it('logs extensions when present in response', done => {
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

      const result = link.request(operation, forward);
      result.subscribe({
        next: () => {},
        complete: () => {
          const extLog = jest
            .mocked(console.log)
            .mock.calls.find(
              call =>
                typeof call[0] === 'string' && call[0].includes('Extensions'),
            );
          expect(extLog).toBeDefined();
          done();
        },
      });
    });
  });
});
