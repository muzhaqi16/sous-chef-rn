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

  it('clears the flag and routes back when verification resumes', () => {
    const { result } = renderHook(() => useEmailVerificationActions());

    act(() => result.current.resumeVerification());

    // Order matters: clearing the flag first is what stops resolveNavTarget
    // from routing straight back out of the screen we are entering.
    expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
      verificationSkipped: false,
    });
    expect(mockSetNavigationState).toHaveBeenCalledWith('verification');
  });

  it('does nothing without a signed-in user', () => {
    mockUserId = undefined;
    const { result } = renderHook(() => useEmailVerificationActions());

    act(() => result.current.skipVerification());
    act(() => result.current.resumeVerification());

    expect(mockSetUserNavigationState).not.toHaveBeenCalled();
    expect(mockSetNavigationState).not.toHaveBeenCalled();
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

    expect(mockSetNavigationState).toHaveBeenCalledWith('verification');
  });
});
