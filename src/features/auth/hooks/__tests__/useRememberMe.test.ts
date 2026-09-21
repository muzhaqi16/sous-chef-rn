import { renderHook, act } from '@testing-library/react-native';
import { useRememberMe } from '../useRememberMe';

// Break circular dependency chain
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

// Mock useAuthPreferences
const mockMarkCredentialPromptDeclined = jest.fn();
jest.mock('#/hooks/navigation/useAuthPreferences', () => ({
  useAuthPreferences: () => ({
    markCredentialPromptDeclined: mockMarkCredentialPromptDeclined,
  }),
}));

const mockOnAccept = jest.fn().mockResolvedValue(undefined);
const mockOnDecline = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockOnAccept.mockResolvedValue(undefined);
});

describe('useRememberMe', () => {
  it('initializes with modal hidden and no pending credentials', () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    expect(result.current.showRememberMeModal).toBe(false);
    expect(result.current.pendingCredentials).toBeNull();
  });

  it('showRememberMePrompt sets credentials and shows modal', () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.showRememberMePrompt({
        email: 'test@test.com',
      });
    });

    expect(result.current.showRememberMeModal).toBe(true);
    expect(result.current.pendingCredentials).toEqual({
      email: 'test@test.com',
    });
  });

  it('handleRememberMeAccept calls onAccept with pending credentials', async () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.showRememberMePrompt({
        email: 'test@test.com',
      });
    });

    await act(async () => {
      await result.current.handleRememberMeAccept();
    });

    expect(mockOnAccept).toHaveBeenCalledWith({
      email: 'test@test.com',
    });
    expect(result.current.showRememberMeModal).toBe(false);
    expect(result.current.pendingCredentials).toBeNull();
  });

  it('handleRememberMeAccept hides modal even when no pending credentials', async () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    await act(async () => {
      await result.current.handleRememberMeAccept();
    });

    expect(mockOnAccept).not.toHaveBeenCalled();
    expect(result.current.showRememberMeModal).toBe(false);
  });

  it('handleRememberMeDecline hides modal and calls onDecline', () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.showRememberMePrompt({
        email: 'test@test.com',
      });
    });

    act(() => {
      result.current.handleRememberMeDecline();
    });

    expect(result.current.showRememberMeModal).toBe(false);
    expect(result.current.pendingCredentials).toBeNull();
    expect(mockOnDecline).toHaveBeenCalledTimes(1);
  });

  it('handleRememberMeDecline marks credential prompt as declined', () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.handleRememberMeDecline();
    });

    expect(mockMarkCredentialPromptDeclined).toHaveBeenCalledTimes(1);
  });
});
