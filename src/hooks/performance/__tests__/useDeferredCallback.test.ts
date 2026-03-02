import { renderHook, act } from '@testing-library/react-native';
import { useDeferredCallback } from '../useDeferredCallback';

describe('useDeferredCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls callback after timeout when enabled', () => {
    const callback = jest.fn();

    renderHook(() => useDeferredCallback(callback, true, 500));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call callback when enabled is false', () => {
    const callback = jest.fn();

    renderHook(() => useDeferredCallback(callback, false, 500));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('clears timeout on unmount', () => {
    const callback = jest.fn();

    const { unmount } = renderHook(() =>
      useDeferredCallback(callback, true, 500),
    );

    act(() => {
      jest.advanceTimersByTime(200);
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('uses custom timeout value', () => {
    const callback = jest.fn();

    renderHook(() => useDeferredCallback(callback, true, 2000));

    act(() => {
      jest.advanceTimersByTime(1999);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('updates callback ref when callback changes', () => {
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();

    const { rerender } = renderHook(
      (props: { cb: () => void }) => useDeferredCallback(props.cb, true, 500),
      { initialProps: { cb: firstCallback } },
    );

    rerender({ cb: secondCallback });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    // The ref should point to the latest callback
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });

  it('defaults timeout to 1000ms when not specified', () => {
    const callback = jest.fn();

    renderHook(() => useDeferredCallback(callback));

    act(() => {
      jest.advanceTimersByTime(999);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
