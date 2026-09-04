import { act, renderHook } from '@testing-library/react-native';
import { useResendBackoff } from '../useResendBackoff';

// Restated rather than imported from the hook: asserting against the same array
// the implementation indexes would pass for any schedule it happened to have.
// These are the delays the UI promises the user, in seconds.
const FIRST_DELAY = 30;
const LONGEST_DELAY = 300;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useResendBackoff', () => {
  it('allows the first attempt immediately', () => {
    const { result } = renderHook(() => useResendBackoff());

    expect(result.current.canResend).toBe(true);
    expect(result.current.countdown).toBe(0);
  });

  it('opens a 30s window after the first attempt', () => {
    const { result } = renderHook(() => useResendBackoff());

    act(() => result.current.registerAttempt());

    expect(result.current.canResend).toBe(false);
    expect(result.current.countdown).toBe(FIRST_DELAY);
  });

  it('counts the window down and reopens when it elapses', () => {
    const { result } = renderHook(() => useResendBackoff());

    act(() => result.current.registerAttempt());
    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current.countdown).toBe(20);

    act(() => jest.advanceTimersByTime(20_000));
    expect(result.current.countdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it('lengthens the window on each successive attempt', () => {
    const { result } = renderHook(() => useResendBackoff());

    act(() => result.current.registerAttempt());
    expect(result.current.countdown).toBe(30);

    act(() => jest.advanceTimersByTime(30_000));
    act(() => result.current.registerAttempt());
    expect(result.current.countdown).toBe(60);

    act(() => jest.advanceTimersByTime(60_000));
    act(() => result.current.registerAttempt());
    expect(result.current.countdown).toBe(180);
  });

  it('caps the window at the longest configured delay', () => {
    const { result } = renderHook(() => useResendBackoff());

    for (let i = 0; i < 8; i++) {
      act(() => result.current.registerAttempt());
      act(() => jest.advanceTimersByTime(LONGEST_DELAY * 1000));
    }

    act(() => result.current.registerAttempt());
    expect(result.current.countdown).toBe(LONGEST_DELAY);
  });

  it('measures the window against elapsed real time, not tick count', () => {
    // A backgrounded app or a blocked JS thread drops interval ticks. A
    // decrementing counter would then hold the user past the delay they were
    // promised; reading the deadline off the clock lets the window close on
    // schedule as soon as ticks resume.
    const { result } = renderHook(() => useResendBackoff());

    act(() => result.current.registerAttempt());
    expect(result.current.countdown).toBe(30);

    // Jump the clock past the deadline while only a single tick fires.
    const realNow = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(realNow + 31_000);
    act(() => jest.advanceTimersByTime(1000));
    spy.mockRestore();

    expect(result.current.countdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });
});
