import { renderHook } from '@testing-library/react-native';
import { usePushTapHandlers } from '../usePushTapHandlers';

const mockRegisterFcmTapHandlers = jest.fn(() => jest.fn());
const mockRegisterIosPushTapHandlers = jest.fn(() => jest.fn());

jest.mock('#/services/push/nativePushMessaging', () => ({
  registerFcmTapHandlers: () => mockRegisterFcmTapHandlers(),
}));
jest.mock('#/services/push/iosPushMessaging', () => ({
  registerIosPushTapHandlers: () => mockRegisterIosPushTapHandlers(),
}));

beforeEach(() => jest.clearAllMocks());

describe('usePushTapHandlers', () => {
  it('registers both platforms’ tap handlers for a session', () => {
    renderHook(() => usePushTapHandlers('user-1'));

    expect(mockRegisterFcmTapHandlers).toHaveBeenCalledTimes(1);
    expect(mockRegisterIosPushTapHandlers).toHaveBeenCalledTimes(1);
  });

  // Registering consumes the one-shot cold-start tap.
  it('registers nothing without a session', () => {
    renderHook(() => usePushTapHandlers(undefined));

    expect(mockRegisterFcmTapHandlers).not.toHaveBeenCalled();
    expect(mockRegisterIosPushTapHandlers).not.toHaveBeenCalled();
  });

  it('releases the handlers when the session ends', () => {
    const unsubscribeFcm = jest.fn();
    mockRegisterFcmTapHandlers.mockReturnValueOnce(unsubscribeFcm);
    const { rerender } = renderHook(
      ({ userId }: { userId: string | undefined }) =>
        usePushTapHandlers(userId),
      { initialProps: { userId: 'user-1' } },
    );

    rerender({ userId: undefined });

    expect(unsubscribeFcm).toHaveBeenCalledTimes(1);
  });
});
