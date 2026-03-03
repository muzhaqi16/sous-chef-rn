import {
  handleSubscriptionError,
  clearRetryState,
  clearAllRetryStates,
  isKnownServerError,
} from '../subscriptionErrorHandler';

beforeEach(() => {
  clearAllRetryStates();
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

    it('returns false for non-resolver errors', () => {
      const result = handleSubscriptionError('TestSub', {
        message: 'Unknown server error',
      });
      expect(result).toBe(false);
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
      const error = { message: 'subscription field must return async iterable' };

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
      const error = { message: 'subscription field must return async iterable' };

      handleSubscriptionError('TestSub', error);
      // Immediate second call should be rejected (in backoff)
      const result = handleSubscriptionError('TestSub', error);
      expect(result).toBe(false);
    });

    it('uses separate retry state per operation', () => {
      const error = { message: 'subscription field must return async iterable' };

      handleSubscriptionError('Sub1', error);
      const result = handleSubscriptionError('Sub2', error);
      expect(result).toBe(true);
    });
  });

  describe('clearRetryState', () => {
    it('clears retry state for a specific operation', () => {
      const error = { message: 'subscription field must return async iterable' };
      handleSubscriptionError('TestSub', error);
      clearRetryState('TestSub');
      // After clearing, it should be able to retry again
      jest.advanceTimersByTime(2000);
      expect(handleSubscriptionError('TestSub', error)).toBe(true);
    });
  });

  describe('clearAllRetryStates', () => {
    it('clears all retry states', () => {
      const error = { message: 'subscription field must return async iterable' };
      handleSubscriptionError('Sub1', error);
      handleSubscriptionError('Sub2', error);
      clearAllRetryStates();
      jest.advanceTimersByTime(2000);
      expect(handleSubscriptionError('Sub1', error)).toBe(true);
      expect(handleSubscriptionError('Sub2', error)).toBe(true);
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
