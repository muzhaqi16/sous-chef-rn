'use no memo';

import { renderHook } from '@testing-library/react-native';
import { usePreservedQueryData } from '../usePreservedQueryData';

describe('usePreservedQueryData', () => {
  it('returns initial value when current data is undefined', () => {
    const { result } = renderHook(() =>
      usePreservedQueryData(undefined, 'fallback'),
    );

    expect(result.current).toBe('fallback');
  });

  it('returns current data when it is defined', () => {
    const { result } = renderHook(() =>
      usePreservedQueryData('hello', 'fallback'),
    );

    expect(result.current).toBe('hello');
  });

  it('preserves the updated value when data becomes undefined', () => {
    // Start undefined, then get data, then lose it
    const { result, rerender } = renderHook(
      ({ data }: { data: string | undefined }) =>
        usePreservedQueryData(data, 'initial'),
      { initialProps: { data: undefined as string | undefined } },
    );

    expect(result.current).toBe('initial');

    // Data arrives
    rerender({ data: 'good-data' });
    expect(result.current).toBe('good-data');

    // Data lost (error) - should preserve 'good-data'
    rerender({ data: undefined });
    expect(result.current).toBe('good-data');
  });

  it('updates when new data becomes available after an error', () => {
    const { result, rerender } = renderHook(
      ({ data }: { data: string | undefined }) =>
        usePreservedQueryData(data, 'initial'),
      { initialProps: { data: undefined as string | undefined } },
    );

    rerender({ data: 'first' });
    expect(result.current).toBe('first');

    rerender({ data: undefined }); // error
    expect(result.current).toBe('first');

    rerender({ data: 'second' }); // recovery
    expect(result.current).toBe('second');
  });

  it('preserves the FIRST value when data starts defined (cold-start cache) then goes undefined', () => {
    // Cold start: the persisted cache resolves data synchronously on render #1,
    // so `currentData` is defined immediately. `prevData` initializes to
    // `undefined`, so the first defined value IS detected as a change and stored
    // — a subsequent network error then preserves it instead of wiping.
    const { result, rerender } = renderHook(
      ({ data }: { data: string | undefined }) =>
        usePreservedQueryData(data, 'initial'),
      { initialProps: { data: 'same' } },
    );

    expect(result.current).toBe('same');

    rerender({ data: undefined });
    // 'same' was stored on the first render, so it survives the error.
    expect(result.current).toBe('same');
  });

  it('works with object data when data changes', () => {
    const obj1 = { count: 5 };
    const obj2 = { count: 10 };

    const { result, rerender } = renderHook(
      ({ data }: { data: { count: number } | undefined }) =>
        usePreservedQueryData(data, { count: 0 }),
      { initialProps: { data: undefined as { count: number } | undefined } },
    );

    expect(result.current).toEqual({ count: 0 });

    rerender({ data: obj1 });
    expect(result.current).toBe(obj1);

    rerender({ data: undefined });
    expect(result.current).toBe(obj1);

    rerender({ data: obj2 });
    expect(result.current).toBe(obj2);
  });
});
