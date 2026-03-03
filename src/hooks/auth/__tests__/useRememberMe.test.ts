import { renderHook, act } from '@testing-library/react-native';
import { useRememberMe } from '../useRememberMe';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

// Mock useToast
const mockToast = jest.fn();
jest.mock('#/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

// Mock useUserPreferences
const mockMarkCredentialPromptDeclined = jest.fn();
jest.mock('#/hooks/navigation/useUserPreferences', () => ({
  useUserPreferences: () => ({
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
      result.current.showRememberMePrompt({ email: 'test@test.com', password: 'pw' });
    });

    expect(result.current.showRememberMeModal).toBe(true);
    expect(result.current.pendingCredentials).toEqual({ email: 'test@test.com', password: 'pw' });
  });

  it('handleRememberMeAccept calls onAccept with pending credentials', async () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.showRememberMePrompt({ email: 'test@test.com', password: 'pw' });
    });

    await act(async () => {
      await result.current.handleRememberMeAccept();
    });

    expect(mockOnAccept).toHaveBeenCalledWith({ email: 'test@test.com', password: 'pw' });
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

  it('handleRememberMeAccept shows error toast on onAccept failure', async () => {
    mockOnAccept.mockRejectedValue(new Error('Store failed'));
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.showRememberMePrompt({ email: 'test@test.com', password: 'pw' });
    });

    await act(async () => {
      await result.current.handleRememberMeAccept();
    });

    expect(mockToast).toHaveBeenCalledWith({
      message: 'Failed to save login information',
      type: 'error',
    });
    // Modal should still be hidden after error
    expect(result.current.showRememberMeModal).toBe(false);
  });

  it('handleRememberMeDecline hides modal and calls onDecline', () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.showRememberMePrompt({ email: 'test@test.com', password: 'pw' });
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

  it('setShowRememberMeModal directly controls modal visibility', () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.setShowRememberMeModal(true);
    });
    expect(result.current.showRememberMeModal).toBe(true);

    act(() => {
      result.current.setShowRememberMeModal(false);
    });
    expect(result.current.showRememberMeModal).toBe(false);
  });

  it('setPendingCredentials directly controls pending credentials', () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.setPendingCredentials({ email: 'direct@test.com', password: 'directpw' });
    });

    expect(result.current.pendingCredentials).toEqual({ email: 'direct@test.com', password: 'directpw' });
  });

  it('clearing pending credentials sets them to null', () => {
    const { result } = renderHook(() =>
      useRememberMe({ onAccept: mockOnAccept, onDecline: mockOnDecline }),
    );

    act(() => {
      result.current.setPendingCredentials({ email: 'x@y.com', password: 'p' });
    });
    expect(result.current.pendingCredentials).not.toBeNull();

    act(() => {
      result.current.setPendingCredentials(null);
    });
    expect(result.current.pendingCredentials).toBeNull();
  });
});
