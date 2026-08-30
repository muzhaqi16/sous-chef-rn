import { renderHook, act } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import {
  useEmailVerificationActions,
  useVerifiedEmailGate,
} from '../useEmailVerification';
import type { RootState } from '#store/index';

// Break circular dependency chain
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockSetUserNavigationState = jest.fn();
const mockSetNavigationState = jest.fn();
let mockUserId: string | undefined = 'u1';
let mockHasUnverifiedEmail = false;

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T>(selector: (state: RootState) => T): T =>
    selector({
      setUserNavigationState: mockSetUserNavigationState,
      setNavigationState: mockSetNavigationState,
    } as Partial<RootState> as RootState),
  useUserId: () => mockUserId,
  useHasUnverifiedEmail: () => mockHasUnverifiedEmail,
}));

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = (
  jest.requireMock('#hooks/navigation/useAppNavigation') as {
    useAppNavigation: jest.Mock;
  }
).useAppNavigation();

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'u1';
  mockHasUnverifiedEmail = false;
});

describe('useEmailVerificationActions', () => {
  it('flags verification as skipped for the signed-in user', () => {
    const { result } = renderHook(() => useEmailVerificationActions());

    act(() => result.current.skipVerification());

    expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
      verificationSkipped: true,
    });
  });

  it('does nothing without a signed-in user', () => {
    mockUserId = undefined;
    const { result } = renderHook(() => useEmailVerificationActions());

    act(() => result.current.skipVerification());

    expect(mockSetUserNavigationState).not.toHaveBeenCalled();
  });
});

describe('useVerifiedEmailGate', () => {
  it('allows the action when the address is verified', () => {
    const { result } = renderHook(() => useVerifiedEmailGate());

    expect(result.current.requireVerifiedEmail()).toBe(true);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('blocks the action and explains why when unverified', () => {
    mockHasUnverifiedEmail = true;
    const { result } = renderHook(() => useVerifiedEmailGate());

    expect(result.current.requireVerifiedEmail()).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      'Verify your email first',
      expect.stringContaining('verified email'),
      expect.any(Array),
    );
  });

  it('offers a route into verification from the block message', () => {
    mockHasUnverifiedEmail = true;
    const { result } = renderHook(() => useVerifiedEmailGate());

    act(() => {
      result.current.requireVerifiedEmail();
    });

    const buttons = (alertService.alert as jest.Mock).mock.lastCall?.[2] as {
      text: string;
      onPress?: () => void;
    }[];
    act(() => buttons.find(b => b.text === 'Verify Now')?.onPress?.());

    // A PUSH over the app, never the root navigator's `verification` group:
    // swapping groups here would strand the user on Home after verifying and
    // leave sign-out as the only way back.
    expect(mockNav.toVerifyEmail).toHaveBeenCalledTimes(1);
    expect(mockSetNavigationState).not.toHaveBeenCalled();
  });
});
