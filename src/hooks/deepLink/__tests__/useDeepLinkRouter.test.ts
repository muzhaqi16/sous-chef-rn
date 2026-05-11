'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { useDeepLinkRouter } from '../useDeepLinkRouter';

// Mock dependencies
const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    dispatch: mockDispatch,
    navigate: mockNavigate,
  })),
  CommonActions: {
    navigate: jest.fn((screen: string, params?: any) => ({
      type: 'NAVIGATE',
      payload: { name: screen, params },
    })),
  },
}));

const mockSetPending = jest.fn();
const mockClearPending = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) => {
    const state = {
      isHydrated: true,
      pendingDeepLinkAction: null,
      setPendingDeepLinkAction: mockSetPending,
      clearPendingDeepLinkAction: mockClearPending,
    };
    return selector(state);
  }),
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: true,
  })),
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('#store/slices/navigationSlice', () => ({}));

// Helper to create a valid JWT token (3 parts separated by dots)
const createMockToken = (payload: Record<string, any> = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const defaultPayload = { exp: now + 3600, iat: now, ...payload };
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(defaultPayload));
  const signature = 'mock-signature';
  return `${header}.${body}.${signature}`;
};

describe('useDeepLinkRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns expected API', () => {
    const { result } = renderHook(() => useDeepLinkRouter());

    expect(result.current).toHaveProperty('triggerDeepLinkAction');
    expect(result.current).toHaveProperty('handleEmailVerification');
    expect(result.current).toHaveProperty('handlePasswordReset');
    expect(result.current).toHaveProperty('handleAcceptInvitation');
    expect(result.current).toHaveProperty('pendingDeepLinkAction');
  });

  it('handleEmailVerification dispatches navigate for authenticated user', () => {
    const { result } = renderHook(() => useDeepLinkRouter());
    const token = createMockToken({ type: 'email_verification' });

    act(() => {
      result.current.handleEmailVerification(token);
    });

    expect(mockDispatch).toHaveBeenCalled();
  });

  it('handlePasswordReset dispatches navigate', () => {
    const { result } = renderHook(() => useDeepLinkRouter());
    const token = createMockToken({ type: 'password_reset' });

    act(() => {
      result.current.handlePasswordReset(token);
    });

    expect(mockDispatch).toHaveBeenCalled();
  });

  it('handleAcceptInvitation dispatches navigate for authenticated user', () => {
    const { result } = renderHook(() => useDeepLinkRouter());
    const token = createMockToken({ type: 'invitation' });

    act(() => {
      result.current.handleAcceptInvitation(token);
    });

    expect(mockDispatch).toHaveBeenCalled();
  });

  it('rejects expired tokens', () => {
    const { toastService } = jest.requireMock('#/services/toastService');
    const { result } = renderHook(() => useDeepLinkRouter());

    const expiredToken = createMockToken({
      exp: Math.floor(Date.now() / 1000) - 3600,
      type: 'email_verification',
    });

    act(() => {
      result.current.handleEmailVerification(expiredToken);
    });

    expect(toastService.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or expired'),
    );
  });

  it('triggerDeepLinkAction queues action when not hydrated', () => {
    const { useAppStore } = jest.requireMock('#store/useAppStore');
    useAppStore.mockImplementation((selector: any) =>
      selector({
        isHydrated: false,
        pendingDeepLinkAction: null,
        setPendingDeepLinkAction: mockSetPending,
        clearPendingDeepLinkAction: mockClearPending,
      }),
    );

    const { result } = renderHook(() => useDeepLinkRouter());

    act(() => {
      result.current.triggerDeepLinkAction({
        type: 'email_verification',
        token: 'test',
        timestamp: Date.now(),
      });
    });

    expect(mockSetPending).toHaveBeenCalled();
  });

  it('rejects tokens issued in the future', () => {
    const { toastService } = jest.requireMock('#/services/toastService');
    const { result } = renderHook(() => useDeepLinkRouter());

    const futureToken = createMockToken({
      iat: Math.floor(Date.now() / 1000) + 600, // 10 minutes in future
      type: 'email_verification',
    });

    act(() => {
      result.current.handleEmailVerification(futureToken);
    });

    expect(toastService.error).toHaveBeenCalled();
  });

  it('rejects tokens with wrong type', () => {
    const { toastService } = jest.requireMock('#/services/toastService');
    const { result } = renderHook(() => useDeepLinkRouter());

    // Token says password_reset but handler expects email_verification
    const token = createMockToken({ type: 'password_reset' });

    act(() => {
      result.current.handleEmailVerification(token);
    });

    expect(toastService.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or expired'),
    );
  });
});
