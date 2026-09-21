import {
  handleSubscriptionError,
  clearRetryState,
  clearAllRetryStates,
  classifyTransportTermination,
  isExpectedTransportError,
  isKnownServerError,
  isPermanentSubscriptionRejection,
} from '../subscriptionErrorHandler';
import { TimeoutError } from '../errors/timeoutError';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { errorService } from '#/services/errorService';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';

jest.mock('#/services/errorService');

// graphql-js's refusal of a subscription resolver that returns no event stream.
const resolverError = new CombinedGraphQLErrors({
  errors: [
    {
      message: 'Subscription field must return Async Iterable. Received: true.',
    },
  ],
});

beforeEach(() => {
  clearAllRetryStates();
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('subscriptionErrorHandler', () => {
  describe('handleSubscriptionError', () => {
    it('suppresses a socket close', () => {
      const result = handleSubscriptionError(
        'TestSub',
        new Error('Socket closed with event 1006 '),
      );
      expect(result).toBe(false);
    });

    it('suppresses a socket failure with no close event', () => {
      expect(
        handleSubscriptionError('TestSub', new Error('Socket closed')),
      ).toBe(false);
    });

    it('reports a server error that mentions a connection', () => {
      const error = new CombinedGraphQLErrors({
        errors: [{ message: 'Database connection pool exhausted' }],
      });
      expect(handleSubscriptionError('TestSub', error)).toBe(false);
      expect(errorService.reportError).toHaveBeenCalledTimes(1);
    });

    it('returns false for non-resolver errors and reports them to telemetry', () => {
      const result = handleSubscriptionError('TestSub', {
        message: 'Unknown server error',
      });
      expect(result).toBe(false);
      expect(errorService.reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: 'subscriptionError',
          subscription: 'TestSub',
        }),
      );
    });

    it('does NOT report suppressed transport errors to telemetry', () => {
      handleSubscriptionError(
        'TestSub',
        new Error('Socket closed with event 1006 '),
      );
      handleSubscriptionError(
        'TestSub',
        new NetworkRequestError('Network request failed'),
      );
      expect(errorService.reportError).not.toHaveBeenCalled();
    });

    it('retries server resolver errors', () => {
      const onRetry = jest.fn();
      const result = handleSubscriptionError('TestSub', resolverError, onRetry);
      expect(result).toBe(true);
    });

    it('schedules retry callback with setTimeout', () => {
      const onRetry = jest.fn();
      handleSubscriptionError('TestSub', resolverError, onRetry);
      expect(onRetry).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2000);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('stops retrying after MAX_RETRIES (3)', () => {
      const error = resolverError;

      // First 3 retries should succeed
      expect(handleSubscriptionError('TestSub', error)).toBe(true);
      jest.advanceTimersByTime(3000);
      expect(handleSubscriptionError('TestSub', error)).toBe(true);
      jest.advanceTimersByTime(5000);
      expect(handleSubscriptionError('TestSub', error)).toBe(true);

      // 4th should fail
      jest.advanceTimersByTime(10000);
      expect(handleSubscriptionError('TestSub', error)).toBe(false);
    });

    it('respects backoff period', () => {
      const error = resolverError;

      handleSubscriptionError('TestSub', error);
      // Immediate second call should be rejected (in backoff)
      const result = handleSubscriptionError('TestSub', error);
      expect(result).toBe(false);
    });

    it('uses separate retry state per operation', () => {
      const error = resolverError;

      handleSubscriptionError('Sub1', error);
      const result = handleSubscriptionError('Sub2', error);
      expect(result).toBe(true);
    });
  });

  describe('clearRetryState', () => {
    it('clears retry state for a specific operation', () => {
      const error = resolverError;
      handleSubscriptionError('TestSub', error);
      clearRetryState('TestSub');
      // After clearing, it should be able to retry again
      jest.advanceTimersByTime(2000);
      expect(handleSubscriptionError('TestSub', error)).toBe(true);
    });
  });

  describe('clearAllRetryStates', () => {
    it('clears all retry states', () => {
      const error = resolverError;
      handleSubscriptionError('Sub1', error);
      handleSubscriptionError('Sub2', error);
      clearAllRetryStates();
      jest.advanceTimersByTime(2000);
      expect(handleSubscriptionError('Sub1', error)).toBe(true);
      expect(handleSubscriptionError('Sub2', error)).toBe(true);
    });
  });

  describe('isPermanentSubscriptionRejection', () => {
    // The server validates subscription documents against depth 5 / cost 500,
    // and refuses a breach identically every time — so these must never retry.
    it('recognizes the depth rejection', () => {
      expect(
        isPermanentSubscriptionRejection({
          message: 'Syntax Error: Query depth limit of 5 exceeded, found 8.',
        }),
      ).toBe(true);
    });

    it('recognizes the cost rejection', () => {
      expect(
        isPermanentSubscriptionRejection({
          message: 'Syntax Error: Query Cost limit of 500 exceeded, found 812.',
        }),
      ).toBe(true);
    });

    it('recognizes the masked rejection message', () => {
      // `exposeLimits: false` replaces the numbers with this generic string.
      expect(
        isPermanentSubscriptionRejection({
          message: 'Syntax Error: Query validation error.',
        }),
      ).toBe(true);
    });

    it('recognizes a validation code carried on extensions', () => {
      const error = new CombinedGraphQLErrors({
        errors: [
          {
            message: 'Subscription refused',
            extensions: { code: 'BAD_USER_INPUT' },
          },
        ],
      });
      expect(isPermanentSubscriptionRejection(error)).toBe(true);
    });

    it('does NOT treat the concurrent-subscription cap as permanent', () => {
      // A capacity condition — it frees up as other devices disconnect.
      const error = new CombinedGraphQLErrors({
        errors: [
          {
            message: 'Maximum 20 concurrent subscriptions exceeded',
            extensions: { code: 'SUBSCRIPTION_LIMIT_EXCEEDED' },
          },
        ],
      });
      expect(isPermanentSubscriptionRejection(error)).toBe(false);
    });

    it('recognizes an armor rejection carried in a GraphQL error', () => {
      const error = new CombinedGraphQLErrors({
        errors: [
          {
            message: 'Syntax Error: Query depth limit of 5 exceeded, found 8.',
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          },
        ],
      });
      expect(isPermanentSubscriptionRejection(error)).toBe(true);
    });

    it('does NOT treat a transport failure as permanent', () => {
      expect(
        isPermanentSubscriptionRejection(
          new Error('Socket closed with event 1006 '),
        ),
      ).toBe(false);
    });
  });

  describe('isKnownServerError', () => {
    it('detects a non-iterable subscription resolver', () => {
      expect(isKnownServerError(resolverError)).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isKnownServerError(new Error('Unknown error'))).toBe(false);
    });
  });

  describe('classifyTransportTermination', () => {
    it('restarts after a socket failure with no close event', () => {
      expect(classifyTransportTermination(new Error('Socket closed'))).toEqual(
        {},
      );
    });

    it('carries a retryable close code', () => {
      expect(
        classifyTransportTermination(
          new Error('Socket closed with event 1006 '),
        ),
      ).toEqual({ code: 1006 });
    });

    it('does not restart a close that latched reconnection off', () => {
      expect(
        classifyTransportTermination(
          new Error('Socket closed with event 4400 Invalid message'),
        ),
      ).toBeNull();
    });

    it('returns null for anything that is not a socket close', () => {
      expect(
        classifyTransportTermination(
          new NetworkRequestError('Network request failed'),
        ),
      ).toBeNull();
    });
  });

  describe('isExpectedTransportError', () => {
    it.each([
      new Error('Socket closed with event 1006 '),
      new NetworkRequestError('Network request failed'),
      new TimeoutError('Request timeout after 10000ms'),
    ])('is true for %p', error => {
      expect(isExpectedTransportError(error)).toBe(true);
    });

    it('is false for a server error that mentions a websocket', () => {
      const error = new CombinedGraphQLErrors({
        errors: [{ message: 'WebSocket network connection refused upstream' }],
      });
      expect(isExpectedTransportError(error)).toBe(false);
    });
  });
});
