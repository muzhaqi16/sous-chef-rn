import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useToday } from '../useToday';

describe('useToday', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 22, 23, 59, 30));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is the local date key', () => {
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-09-22');
  });

  it('turns over at local midnight', () => {
    const { result } = renderHook(() => useToday());

    act(() => {
      jest.advanceTimersByTime(31_000);
    });

    expect(result.current).toBe('2026-09-23');
  });

  // A backgrounded timer may not fire, so coming back re-reads the date.
  it('re-reads the date when the app returns to the foreground', () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest
      .mocked(AppState.addEventListener)
      .mockImplementation((_type, listener) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      });
    const { result } = renderHook(() => useToday());

    jest.setSystemTime(new Date(2026, 8, 24, 9, 0));
    act(() => listeners.forEach(listener => listener('active')));

    expect(result.current).toBe('2026-09-24');
  });
});
