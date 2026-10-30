import { act } from '@testing-library/react-native';

/**
 * Under fake timers: runs every timer, then every timer those renders and
 * answers started, until none is pending. What a test expects has landed by
 * then, and what it forbids has had its chance, whatever the worker's speed.
 * A repeating timer never drains: step past it with `advanceTimersByTimeAsync`.
 */
export async function drainTimers(): Promise<void> {
  do {
    await act(async () => {
      // `runAllTimersAsync` leaves a faked `nextTick` or `queueMicrotask`
      // unrun when no timer is pending, and `getTimerCount` counts it.
      jest.runAllTicks();
      await jest.runAllTimersAsync();
    });
    jest.runAllTicks();
  } while (jest.getTimerCount() > 0);
}
