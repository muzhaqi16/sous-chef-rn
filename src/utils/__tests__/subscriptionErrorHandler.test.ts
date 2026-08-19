import {
  handleSubscriptionError,
  clearRetryState,
  clearAllRetryStates,
  isKnownServerError,
  isPermanentSubscriptionRejection,
} from '../subscriptionErrorHandler';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { errorService } from '#/services/errorService';

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

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
    it('suppresses socket closed errors', () => {
      const result = handleSubscriptionError('TestSub', {
        message: 'socket closed',
      });
      expect(result).toBe(false);
    });

    it('suppresses network errors', () => {
      expect(
        handleSubscriptionError('TestSub', { message: 'network error' }),
      ).toBe(false);
    });

    it('suppresses connection errors', () => {
      expect(
        handleSubscriptionError('TestSub', { message: 'connection lost' }),
      ).toBe(false);
    });

    it('suppresses websocket errors', () => {
      expect(
        handleSubscriptionError('TestSub', { message: 'websocket closed' }),
      ).toBe(false);
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

    it('does NOT report suppressed network errors to telemetry', () => {
      handleSubscriptionError('TestSub', { message: 'socket closed' });
      handleSubscriptionError('TestSub', { message: 'network error' });
      expect(errorService.reportError).not.toHaveBeenCalled();
    });

    it('retries server resolver errors', () => {
      const onRetry = jest.fn();
      const result = handleSubscriptionError(
        'TestSub',
        { message: 'subscription field must return async iterable' },
        onRetry,
      );
      expect(result).toBe(true);
    });

    it('schedules retry callback with setTimeout', () => {
      const onRetry = jest.fn();
      handleSubscriptionError(
        'TestSub',
        { message: 'subscription field must return async iterable' },
        onRetry,
      );
      expect(onRetry).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2000);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('stops retrying after MAX_RETRIES (3)', () => {
      const error = {
        message: 'subscription field must return async iterable',
      };

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
      const error = {
        message: 'subscription field must return async iterable',
      };

      handleSubscriptionError('TestSub', error);
      // Immediate second call should be rejected (in backoff)
      const result = handleSubscriptionError('TestSub', error);
      expect(result).toBe(false);
    });

    it('uses separate retry state per operation', () => {
      const error = {
        message: 'subscription field must return async iterable',
      };

      handleSubscriptionError('Sub1', error);
      const result = handleSubscriptionError('Sub2', error);
      expect(result).toBe(true);
    });
  });

  describe('clearRetryState', () => {
    it('clears retry state for a specific operation', () => {
      const error = {
        message: 'subscription field must return async iterable',
      };
      handleSubscriptionError('TestSub', error);
      clearRetryState('TestSub');
      // After clearing, it should be able to retry again
      jest.advanceTimersByTime(2000);
      expect(handleSubscriptionError('TestSub', error)).toBe(true);
    });
  });

  describe('clearAllRetryStates', () => {
    it('clears all retry states', () => {
      const error = {
        message: 'subscription field must return async iterable',
      };
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

    it('does NOT treat a transport failure as permanent', () => {
      expect(
        isPermanentSubscriptionRejection({ message: 'socket closed' }),
      ).toBe(false);
    });
  });

  describe('isKnownServerError', () => {
    it('detects async iterable error', () => {
      expect(
        isKnownServerError({
          message: 'Subscription field must return Async Iterable',
        }),
      ).toBe(true);
    });

    it('detects undefined resolver error', () => {
      expect(
        isKnownServerError({
          message: 'Server-side resolver returned undefined',
        }),
      ).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isKnownServerError({ message: 'Unknown error' })).toBe(false);
    });

    it('handles missing message', () => {
      expect(isKnownServerError({})).toBe(false);
    });
  });
});
