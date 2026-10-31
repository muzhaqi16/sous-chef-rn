import { act } from '@testing-library/react-native';

/**
 * Under fake timers: runs every timer, then every timer those renders and
 * answers started, until none is pending. What a test expects has landed by
 * then, and what it forbids has had its chance, whatever the worker's speed.
 * A repeating timer never drains: step past it with `advanceTimersByTimeAsync`.
 */
export async function drainTimers(): Promise<void> {
  // On a real clock nothing below runs, so an absence would pass unchecked.
  if (!('clock' in setTimeout)) {
    throw new Error('drainTimers runs the fake clock: call jest.useFakeTimers');
  }
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

/**
 * Under fake timers: starts work whose answer needs the clock, runs the clock
 * until nothing is pending, and hands back its result. `await act(async () =>
 * { await work(); })` hangs there, as the answer's timer never fires.
 */
export async function drained<T>(start: () => T): Promise<Awaited<T>> {
  let started: T | undefined;
  act(() => {
    started = start();
  });
  const outcome = Promise.resolve(started as T);
  // Read after the drain, when a rejection would otherwise count as unhandled.
  outcome.catch(() => undefined);
  await drainTimers();
  return outcome;
}
