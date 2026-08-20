import { jwtDecode } from 'jwt-decode';

// Mock jwt-decode before importing the module under test
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

// Mock the store
jest.mock('../../../store', () => ({
  useStore: {
    getState: jest.fn(() => ({ isOnline: true })),
  },
}));

import {
  scheduleTokenRefresh,
  cancelTokenRefresh,
  getScheduleState,
} from '../tokenScheduler';
import { useStore } from '#store';
import type { RootState } from '#store/index';
import { logger } from '#/utils/environment';

const mockedJwtDecode = jwtDecode as jest.MockedFunction<typeof jwtDecode>;
const mockedGetState = useStore.getState as jest.MockedFunction<
  typeof useStore.getState
>;

// The scheduler only reads `isOnline`; build a minimal RootState for the mock.
const stateWith = (overrides: Partial<RootState>): RootState =>
  overrides as RootState;

describe('tokenScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Cancel any outstanding timers from previous tests
    cancelTokenRefresh();
    jest.clearAllMocks();
    mockedGetState.mockReturnValue(stateWith({ isOnline: true }));
  });

  afterEach(() => {
    cancelTokenRefresh();
    jest.useRealTimers();
  });

  describe('getScheduleState', () => {
    it('returns isScheduled false when no timer is active', () => {
      expect(getScheduleState()).toEqual({ isScheduled: false });
    });

    it('returns isScheduled true when a timer is active', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      mockedJwtDecode.mockReturnValue({ exp: futureExp, iat: 0, userId: '1' });

      scheduleTokenRefresh('fake-token', jest.fn());

      expect(getScheduleState()).toEqual({ isScheduled: true });
    });
  });

  describe('scheduleTokenRefresh', () => {
    it('schedules a refresh when token has time remaining beyond the buffer', () => {
      // Token expires in 1 hour (3600s), buffer is 600s, so delay = 3000s
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      mockedJwtDecode.mockReturnValue({ exp: futureExp, iat: 0, userId: '1' });

      const callback = jest.fn().mockResolvedValue(undefined);
      scheduleTokenRefresh('fake-token', callback);

      expect(getScheduleState().isScheduled).toBe(true);
      expect(callback).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[TokenScheduler] Scheduling proactive refresh',
        ),
      );
    });

    it('refreshes immediately when the token is already inside the buffer window', () => {
      // Token expires in 5 minutes (300s), buffer is 600s, so the refresh is
      // already overdue. Scheduling nothing here would leave the exchange to a
      // request that has already been refused.
      const soonExp = Math.floor(Date.now() / 1000) + 300;
      mockedJwtDecode.mockReturnValue({ exp: soonExp, iat: 0, userId: '1' });

      const callback = jest.fn().mockResolvedValue(undefined);
      scheduleTokenRefresh('fake-token', callback);

      expect(getScheduleState().isScheduled).toBe(true);
      jest.advanceTimersByTime(0);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('refreshes immediately for a token that has already expired', () => {
      // What a token restored from storage looks like after the app has been
      // closed longer than the token's lifetime.
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      mockedJwtDecode.mockReturnValue({ exp: pastExp, iat: 0, userId: '1' });

      const callback = jest.fn().mockResolvedValue(undefined);
      scheduleTokenRefresh('fake-token', callback);

      expect(getScheduleState().isScheduled).toBe(true);
      jest.advanceTimersByTime(0);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('calls the callback when the timer fires and device is online', () => {
      // Token expires in 20 minutes => refresh at 10 minutes => delay ~600s
      const futureExp = Math.floor(Date.now() / 1000) + 1200;
      mockedJwtDecode.mockReturnValue({ exp: futureExp, iat: 0, userId: '1' });

      const callback = jest.fn().mockResolvedValue(undefined);
      scheduleTokenRefresh('fake-token', callback);

      // Advance timers to trigger the scheduled callback
      jest.advanceTimersByTime(700 * 1000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Proactive token refresh triggered'),
      );
    });

    it('skips callback when device is offline', () => {
      mockedGetState.mockReturnValue(stateWith({ isOnline: false }));

      const futureExp = Math.floor(Date.now() / 1000) + 1200;
      mockedJwtDecode.mockReturnValue({ exp: futureExp, iat: 0, userId: '1' });

      const callback = jest.fn().mockResolvedValue(undefined);
      scheduleTokenRefresh('fake-token', callback);

      jest.advanceTimersByTime(700 * 1000);

      expect(callback).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Skipping proactive refresh - device is offline',
        ),
      );
    });

    it('clears previous timer when scheduling a new one', () => {
      const futureExp1 = Math.floor(Date.now() / 1000) + 3600;
      mockedJwtDecode.mockReturnValue({ exp: futureExp1, iat: 0, userId: '1' });

      const callback1 = jest.fn().mockResolvedValue(undefined);
      scheduleTokenRefresh('token1', callback1);
      expect(getScheduleState().isScheduled).toBe(true);

      const futureExp2 = Math.floor(Date.now() / 1000) + 7200;
      mockedJwtDecode.mockReturnValue({ exp: futureExp2, iat: 0, userId: '1' });

      const callback2 = jest.fn().mockResolvedValue(undefined);
      scheduleTokenRefresh('token2', callback2);

      // Advance past the first timer's would-be fire time
      jest.advanceTimersByTime(3100 * 1000);

      // Only the second callback should be scheduled, not the first
      expect(callback1).not.toHaveBeenCalled();
      // Both schedule calls should log
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[TokenScheduler] Scheduling proactive refresh',
        ),
      );
    });

    it('handles jwt decode errors gracefully without throwing', () => {
      mockedJwtDecode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => {
        scheduleTokenRefresh('bad-token', jest.fn());
      }).not.toThrow();

      expect(getScheduleState().isScheduled).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to decode token for scheduling:'),
        expect.any(Error),
      );
    });

    it('handles callback errors gracefully', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 1200;
      mockedJwtDecode.mockReturnValue({ exp: futureExp, iat: 0, userId: '1' });

      const callback = jest.fn().mockRejectedValue(new Error('Refresh failed'));
      scheduleTokenRefresh('fake-token', callback);

      // Should not throw when callback fails
      jest.advanceTimersByTime(700 * 1000);
      await Promise.resolve(); // flush the rejected promise
      expect(callback).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Proactive refresh failed:'),
        expect.any(Error),
      );
    });
  });

  describe('cancelTokenRefresh', () => {
    it('cancels a scheduled refresh', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      mockedJwtDecode.mockReturnValue({ exp: futureExp, iat: 0, userId: '1' });

      const callback = jest.fn();
      scheduleTokenRefresh('fake-token', callback);
      expect(getScheduleState().isScheduled).toBe(true);

      cancelTokenRefresh();
      expect(getScheduleState().isScheduled).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Scheduled refresh cancelled'),
      );
    });

    it('is safe to call when no timer is active', () => {
      expect(() => cancelTokenRefresh()).not.toThrow();
      expect(getScheduleState().isScheduled).toBe(false);
    });

    it('prevents the callback from being called', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 1200;
      mockedJwtDecode.mockReturnValue({ exp: futureExp, iat: 0, userId: '1' });

      const callback = jest.fn();
      scheduleTokenRefresh('fake-token', callback);
      cancelTokenRefresh();

      jest.advanceTimersByTime(700 * 1000);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
