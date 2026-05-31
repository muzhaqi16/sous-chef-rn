import { renderHook } from '@testing-library/react-native';
import {
  useIsAuth,
  useIsVerification,
  useIsOnboarding,
  useIsMainApp,
} from '../useNavigationGuards';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

let mockNavigationState = 'auth';

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: { navigationState: string }) => unknown) =>
    selector({
      navigationState: mockNavigationState,
    }),
  useNavigationState: () => mockNavigationState,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigationState = 'auth';
});

describe('useIsAuth', () => {
  it('returns true when navigationState is auth', () => {
    mockNavigationState = 'auth';
    const { result } = renderHook(() => useIsAuth());
    expect(result.current).toBe(true);
  });

  it('returns false when navigationState is not auth', () => {
    mockNavigationState = 'main_app';
    const { result } = renderHook(() => useIsAuth());
    expect(result.current).toBe(false);
  });
});

describe('useIsVerification', () => {
  it('returns true when navigationState is verification', () => {
    mockNavigationState = 'verification';
    const { result } = renderHook(() => useIsVerification());
    expect(result.current).toBe(true);
  });

  it('returns false when navigationState is not verification', () => {
    mockNavigationState = 'auth';
    const { result } = renderHook(() => useIsVerification());
    expect(result.current).toBe(false);
  });
});

describe('useIsOnboarding', () => {
  it('returns true when navigationState is onboarding', () => {
    mockNavigationState = 'onboarding';
    const { result } = renderHook(() => useIsOnboarding());
    expect(result.current).toBe(true);
  });

  it('returns false when navigationState is not onboarding', () => {
    mockNavigationState = 'main_app';
    const { result } = renderHook(() => useIsOnboarding());
    expect(result.current).toBe(false);
  });
});

describe('useIsMainApp', () => {
  it('returns true when navigationState is main_app', () => {
    mockNavigationState = 'main_app';
    const { result } = renderHook(() => useIsMainApp());
    expect(result.current).toBe(true);
  });

  it('returns false when navigationState is not main_app', () => {
    mockNavigationState = 'auth';
    const { result } = renderHook(() => useIsMainApp());
    expect(result.current).toBe(false);
  });
});
