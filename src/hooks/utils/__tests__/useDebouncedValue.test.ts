'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { useDebouncedValue } from '../useDebouncedValue';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update before delay expires', () => {
    const { result, rerender } = renderHook(
      (props: { value: string }) => useDebouncedValue(props.value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a');
  });

  it('updates after delay expires', () => {
    const { result, rerender } = renderHook(
      (props: { value: string }) => useDebouncedValue(props.value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('b');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      (props: { value: string }) => useDebouncedValue(props.value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a');

    rerender({ value: 'c' });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    // Still 'a' because timer was reset for 'c'
    expect(result.current).toBe('a');

    act(() => {
      jest.advanceTimersByTime(100);
    });
    // Now 300ms have passed since 'c' was set
    expect(result.current).toBe('c');
  });

  it('works with non-string types', () => {
    const { result, rerender } = renderHook(
      (props: { value: number }) => useDebouncedValue(props.value, 300),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 42 });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe(42);
  });
});
