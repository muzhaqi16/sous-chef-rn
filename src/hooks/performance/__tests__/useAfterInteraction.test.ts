'use no memo';

import { renderHook } from '@testing-library/react-native';
import { useAfterInteraction } from '../useAfterInteraction';

// Save originals
const origRequestIdleCallback = globalThis.requestIdleCallback;
const origCancelIdleCallback = globalThis.cancelIdleCallback;

// Replace globally for all tests - track calls manually
let requestIdleCalls: IdleRequestCallback[] = [];
let cancelIdleCalls: number[] = [];
let idleCounter = 0;

const mockDeadline: IdleDeadline = {
  didTimeout: false,
  timeRemaining: () => 50,
};

globalThis.requestIdleCallback = (cb: IdleRequestCallback): number => {
  const id = ++idleCounter;
  requestIdleCalls.push(cb);
  cb(mockDeadline); // execute immediately for test purposes
  return id;
};

globalThis.cancelIdleCallback = (id: number): void => {
  cancelIdleCalls.push(id);
};

afterAll(() => {
  globalThis.requestIdleCallback = origRequestIdleCallback;
  globalThis.cancelIdleCallback = origCancelIdleCallback;
});

describe('useAfterInteraction', () => {
  beforeEach(() => {
    requestIdleCalls = [];
    cancelIdleCalls = [];
    idleCounter = 0;
  });

  it('calls the callback via requestIdleCallback when enabled', () => {
    const callback = jest.fn();
    renderHook(() => useAfterInteraction(callback));

    expect(requestIdleCalls.length).toBeGreaterThan(0);
    expect(callback).toHaveBeenCalled();
  });

  it('does not call the callback when enabled is false', () => {
    const callback = jest.fn();
    renderHook(() => useAfterInteraction(callback, { enabled: false }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('defaults enabled to true', () => {
    const callback = jest.fn();
    renderHook(() => useAfterInteraction(callback));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancels idle callback on unmount', () => {
    const callback = jest.fn();
    const { unmount } = renderHook(() => useAfterInteraction(callback));

    unmount();

    expect(cancelIdleCalls.length).toBeGreaterThan(0);
  });

  it('re-invokes when enabled changes from false to true', () => {
    const callback = jest.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAfterInteraction(callback, { enabled }),
      { initialProps: { enabled: false } },
    );

    expect(callback).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
