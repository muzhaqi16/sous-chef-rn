import { renderHook, act } from '@testing-library/react-native';
import { useStoreReset, useSession } from '../useStoreReset';

const mockResetStore = jest.fn();
const mockGetIsAuthenticated = jest.fn(() => true);

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      resetStore: mockResetStore,
      user: { id: 'user-1', email: 'test@test.com' },
      getIsAuthenticated: mockGetIsAuthenticated,
    }),
}));

jest.mock('#store/resetManager', () => ({
  RESET_SCENARIOS: {
    LOGOUT: { auth: true, ui: true, preferences: false, clearApolloCache: true },
    SESSION_EXPIRED: { auth: true, ui: false, preferences: false, clearApolloCache: false },
    FULL_RESET: { auth: true, ui: true, preferences: true, clearApolloCache: true },
    ONBOARDING_RESET: { auth: false, ui: true, preferences: false, clearApolloCache: false },
  },
}));

// Break circular dependency
jest.mock('../../apollo/links/tokenScheduler', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useStoreReset', () => {
  it('logout calls resetStore with LOGOUT', () => {
    const { result } = renderHook(() => useStoreReset());

    act(() => {
      result.current.logout();
    });

    expect(mockResetStore).toHaveBeenCalledWith('LOGOUT');
  });

  it('fullReset calls resetStore with FULL_RESET', () => {
    const { result } = renderHook(() => useStoreReset());

    act(() => {
      result.current.fullReset();
    });

    expect(mockResetStore).toHaveBeenCalledWith('FULL_RESET');
  });

  it('sessionExpired calls resetStore with SESSION_EXPIRED', () => {
    const { result } = renderHook(() => useStoreReset());

    act(() => {
      result.current.sessionExpired();
    });

    expect(mockResetStore).toHaveBeenCalledWith('SESSION_EXPIRED');
  });

  it('resetOnboarding calls resetStore with ONBOARDING_RESET', () => {
    const { result } = renderHook(() => useStoreReset());

    act(() => {
      result.current.resetOnboarding();
    });

    expect(mockResetStore).toHaveBeenCalledWith('ONBOARDING_RESET');
  });

  it('customReset calls resetStore with custom options', () => {
    const { result } = renderHook(() => useStoreReset());

    const customOptions = { auth: true, ui: false, preferences: true };

    act(() => {
      result.current.customReset(customOptions);
    });

    expect(mockResetStore).toHaveBeenCalledWith(customOptions);
  });

  it('exposes RESET_SCENARIOS', () => {
    const { result } = renderHook(() => useStoreReset());

    expect(result.current.scenarios).toEqual({
      LOGOUT: expect.objectContaining({ auth: true }),
      SESSION_EXPIRED: expect.objectContaining({ auth: true }),
      FULL_RESET: expect.objectContaining({ auth: true, preferences: true }),
      ONBOARDING_RESET: expect.objectContaining({ auth: false }),
    });
  });
});

describe('useSession', () => {
  it('handleSessionExpiry calls resetStore with SESSION_EXPIRED', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.handleSessionExpiry();
    });

    expect(mockResetStore).toHaveBeenCalledWith('SESSION_EXPIRED');
  });
});
