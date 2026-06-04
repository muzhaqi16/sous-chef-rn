'use no memo';
import React from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { PostLoginBiometricScreen } from '../PostLoginBiometricScreen';

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/atoms/PasswordInput', () => ({
  PasswordInput: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock('#hooks/performance/useScreenTransition', () => ({
  useScreenTransition: jest.fn(),
}));

jest.mock('#/services/authService', () => ({
  authService: {
    getBiometricInfo: jest.fn(() =>
      Promise.resolve({ isAvailable: true, biometryType: 'Face ID' }),
    ),
    storeCredentials: jest.fn(() => Promise.resolve(true)),
    checkStoredCredentials: jest.fn(() => Promise.resolve(false)),
    loadStoredCredentials: jest.fn(),
  },
}));

const { authService: mockAuthService } = jest.requireMock(
  '#/services/authService',
) as { authService: { storeCredentials: jest.Mock } };

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: async (
    fn: () => Promise<void>,
    setLoading: (v: boolean) => void,
    onError?: (e: unknown) => void,
  ) => {
    setLoading(true);
    try {
      await fn();
    } catch (error) {
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  },
}));

const mockSetNavigationState = jest.fn();
const mockSetShowBiometricSetup = jest.fn();
const mockSetPostLoginCredentials = jest.fn();
jest.mock('#store/useAppStore', () => ({
  usePostLoginState: jest.fn(() => ({
    postLoginCredentials: {
      email: 'test@example.com',
      password: 'password123',
    },
    setNavigationState: mockSetNavigationState,
    setShowBiometricSetup: mockSetShowBiometricSetup,
    setPostLoginCredentials: mockSetPostLoginCredentials,
  })),
}));

const mockRecordResponse = jest.fn();
jest.mock('#hooks/auth/useBiometricPrompting', () => ({
  useBiometricPrompting: () => ({
    recordBiometricPromptResponse: mockRecordResponse,
  }),
}));

const mockMarkEnabled = jest.fn();
const mockMarkDeclined = jest.fn();
jest.mock('#hooks/navigation/useAuthPreferences', () => ({
  useAuthPreferences: () => ({
    markBiometricEnabled: mockMarkEnabled,
    markBiometricDeclined: mockMarkDeclined,
  }),
}));

describe('PostLoginBiometricScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the post-login biometric gate as a screen', async () => {
    render(<PostLoginBiometricScreen />);
    expect(
      await screen.findByTestId('post-login-biometric-screen'),
    ).toBeTruthy();
    expect(await screen.findByText('Set up Face ID Login?')).toBeTruthy();
  });

  it('renders Enable Now and Not now', async () => {
    render(<PostLoginBiometricScreen />);
    expect(await screen.findByText('Enable Now')).toBeTruthy();
    expect(screen.getByText('Not now')).toBeTruthy();
  });

  it('declines and enters the app when Not now is pressed', async () => {
    const user = userEvent.setup();
    render(<PostLoginBiometricScreen />);
    await user.press(await screen.findByText('Not now'));

    expect(mockRecordResponse).toHaveBeenCalledWith(false, true);
    expect(mockMarkDeclined).toHaveBeenCalled();
    expect(mockSetShowBiometricSetup).toHaveBeenCalledWith(false);
    expect(mockSetPostLoginCredentials).toHaveBeenCalledWith(null);
    expect(mockSetNavigationState).toHaveBeenCalledWith('main_app');
  });

  it('stores credentials and enters the app when Enable Now succeeds', async () => {
    const user = userEvent.setup();
    render(<PostLoginBiometricScreen />);
    await user.press(await screen.findByText('Enable Now'));

    await waitFor(() => {
      expect(mockAuthService.storeCredentials).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(mockRecordResponse).toHaveBeenCalledWith(true, undefined);
      expect(mockMarkEnabled).toHaveBeenCalled();
      expect(mockSetNavigationState).toHaveBeenCalledWith('main_app');
    });
  });
});
