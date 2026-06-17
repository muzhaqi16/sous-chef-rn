import { act, renderHook } from '@testing-library/react-native';
import { useMinimumVisible } from '../useMinimumVisible';

describe('useMinimumVisible', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('stays visible for at least the minimum duration after a brief active blip', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useMinimumVisible(active, 280),
      { initialProps: { active: false } },
    );
    expect(result.current).toBe(false);

    // Active turns on, then off almost immediately (fast cache hit).
    rerender({ active: true });
    expect(result.current).toBe(true);
    rerender({ active: false });

    // Still held shortly after.
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);

    // Released once the minimum has elapsed.
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe(false);
  });

  it('never arms when active is false from the start (instant content not delayed)', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useMinimumVisible(active, 280),
      { initialProps: { active: false } },
    );
    expect(result.current).toBe(false);

    // A re-render with still-false active keeps it false — no artificial delay.
    rerender({ active: false });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);
  });

  it('releases immediately when active stays true past the minimum then turns off', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useMinimumVisible(active, 280),
      { initialProps: { active: true } },
    );
    expect(result.current).toBe(true);

    // Loading runs well past the minimum.
    act(() => {
      jest.advanceTimersByTime(500);
    });
    rerender({ active: false });

    // Minimum already satisfied → releases on the next tick without extra hold.
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current).toBe(false);
  });
});
