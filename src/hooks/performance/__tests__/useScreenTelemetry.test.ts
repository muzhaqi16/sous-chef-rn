import { renderHook } from '@testing-library/react-native';
import { useScreenTelemetry } from '../useScreenTelemetry';
import { Telemetry } from '#/services/telemetry';

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackScreen: jest.fn(),
  },
}));

// Mock requestIdleCallback / cancelIdleCallback for the test environment
const mockRequestIdleCallback = jest.fn((cb: (deadline: IdleDeadline) => void) => {
  cb({ didTimeout: false, timeRemaining: () => 50 });
  return 1;
});
const mockCancelIdleCallback = jest.fn();

beforeAll(() => {
  (globalThis as any).requestIdleCallback = mockRequestIdleCallback;
  (globalThis as any).cancelIdleCallback = mockCancelIdleCallback;
});

afterAll(() => {
  delete (globalThis as any).requestIdleCallback;
  delete (globalThis as any).cancelIdleCallback;
});

describe('useScreenTelemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tracks screen view on mount when isReady is true (default)', () => {
    const getProperties = () => ({ home_id: '123', item_count: 5 });

    renderHook(() => useScreenTelemetry('PantryMain', getProperties));

    expect(Telemetry.trackScreen).toHaveBeenCalledTimes(1);
    expect(Telemetry.trackScreen).toHaveBeenCalledWith('PantryMain', {
      home_id: '123',
      item_count: 5,
    });
  });

  it('does not track screen view when isReady is false', () => {
    const getProperties = () => ({ home_id: '123' });

    renderHook(() =>
      useScreenTelemetry('PantryMain', getProperties, false),
    );

    expect(Telemetry.trackScreen).not.toHaveBeenCalled();
  });

  it('tracks screen view once isReady transitions from false to true', () => {
    const getProperties = () => ({ tab: 'recipes' });

    const { rerender } = renderHook(
      (props: { ready: boolean }) =>
        useScreenTelemetry('HomeScreen', getProperties, props.ready),
      { initialProps: { ready: false } },
    );

    expect(Telemetry.trackScreen).not.toHaveBeenCalled();

    rerender({ ready: true });

    expect(Telemetry.trackScreen).toHaveBeenCalledTimes(1);
    expect(Telemetry.trackScreen).toHaveBeenCalledWith('HomeScreen', {
      tab: 'recipes',
    });
  });

  it('fires only once even if isReady toggles multiple times', () => {
    const getProperties = () => ({ count: 10 });

    const { rerender } = renderHook(
      (props: { ready: boolean }) =>
        useScreenTelemetry('ListScreen', getProperties, props.ready),
      { initialProps: { ready: true } },
    );

    expect(Telemetry.trackScreen).toHaveBeenCalledTimes(1);

    // Toggle off and on
    rerender({ ready: false });
    rerender({ ready: true });

    // Should still have been called only once due to firedRef guard
    expect(Telemetry.trackScreen).toHaveBeenCalledTimes(1);
  });

  it('reads properties lazily from the ref at fire time', () => {
    let counter = 0;
    const getProperties = () => {
      counter += 1;
      return { call_number: counter };
    };

    renderHook(() => useScreenTelemetry('DetailScreen', getProperties));

    expect(Telemetry.trackScreen).toHaveBeenCalledWith(
      'DetailScreen',
      expect.objectContaining({ call_number: expect.any(Number) }),
    );
  });

  it('calls cancelIdleCallback on unmount', () => {
    const getProperties = () => ({});

    // Override requestIdleCallback to return handle but not execute immediately
    mockRequestIdleCallback.mockImplementationOnce(() => 42);

    const { unmount } = renderHook(() =>
      useScreenTelemetry('CleanupScreen', getProperties),
    );

    unmount();

    expect(mockCancelIdleCallback).toHaveBeenCalledWith(42);
  });

  it('uses requestIdleCallback to defer tracking', () => {
    const getProperties = () => ({ deferred: true });

    renderHook(() => useScreenTelemetry('DeferredScreen', getProperties));

    expect(mockRequestIdleCallback).toHaveBeenCalled();
  });
});
