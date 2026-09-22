import { renderHook } from '@testing-library/react-native';
import { alertService, type AlertButton } from '#/services/alertService';
import { useRememberMe } from '../useRememberMe';

// Break circular dependency chain
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockMarkCredentialPromptDeclined = jest.fn();
jest.mock('#/hooks/navigation/useAuthPreferences', () => ({
  useAuthPreferences: () => ({
    markCredentialPromptDeclined: mockMarkCredentialPromptDeclined,
  }),
}));

const mockOnAccept = jest.fn().mockResolvedValue(undefined);
const mockOnDecline = jest.fn();

/** Prompt, then return the buttons the alert was shown with. */
const prompt = (email = 'user@example.com'): AlertButton[] => {
  const alert = jest.spyOn(alertService, 'alert').mockImplementation(() => {});
  const { result } = renderHook(() =>
    useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
  );
  result.current.showRememberMePrompt({ email });
  const [call] = alert.mock.calls;
  if (!call) throw new Error('no alert shown');
  return call[2] ?? [];
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockOnAccept.mockResolvedValue(undefined);
});

describe('useRememberMe', () => {
  it('asks with the address being remembered', () => {
    const alert = jest
      .spyOn(alertService, 'alert')
      .mockImplementation(() => {});
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    result.current.showRememberMePrompt({ email: 'user@example.com' });

    expect(alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('user@example.com'),
      expect.any(Array),
    );
  });

  it('enrols the prompted address on accept', () => {
    const [, remember] = prompt('user@example.com');

    remember?.onPress?.();

    expect(mockOnAccept).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(mockOnDecline).not.toHaveBeenCalled();
  });

  it('declines, and is not asked again on this install', () => {
    const [notNow] = prompt();

    notNow?.onPress?.();

    expect(notNow?.style).toBe('cancel');
    expect(mockMarkCredentialPromptDeclined).toHaveBeenCalledTimes(1);
    expect(mockOnDecline).toHaveBeenCalledTimes(1);
    expect(mockOnAccept).not.toHaveBeenCalled();
  });
});
