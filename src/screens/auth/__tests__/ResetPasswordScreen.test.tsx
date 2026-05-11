import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { ResetPasswordScreen } from '../ResetPasswordScreen';

// --- Mocks ---

const mockGoBack = jest.fn();
const mockNavigateToLogin = jest.fn();
const mockClearAuth = jest.fn();
const mockToast = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: jest.fn(() => ({
    params: { token: 'valid-token-0123456789' },
    key: 'test-key',
    name: 'ResetPassword',
  })),
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: jest.fn(),
    dispatch: jest.fn(),
    canGoBack: jest.fn(() => true),
    addListener: jest.fn(() => jest.fn()),
  }),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      clearAuth: mockClearAuth,
    }),
}));

jest.mock('#hooks/navigation/useAuthNavigation', () => ({
  useAuthNavigation: () => ({
    navigateToLogin: mockNavigateToLogin,
  }),
}));

jest.mock('#/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/molecules/Header', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    Header: ({ onClose }: any) => (
      <View testID="header">
        {onClose ? (
          <Pressable testID="header-close" onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

jest.mock('#components/atoms/PasswordInput', () => {
  const { TextInput } = require('react-native');
  return {
    PasswordInput: ({
      value,
      onChangeText,
      placeholder,
      errorMessage,
    }: any) => (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        testID={`password-input-${placeholder}`}
        accessibilityHint={errorMessage}
      />
    ),
  };
});

jest.mock('#components/base/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ children, onPress, disabled, loading }: any) => (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        testID={`button-${children}`}
      >
        <Text>{loading ? 'Loading...' : children}</Text>
      </Pressable>
    ),
  };
});

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the reset password form when token is valid', () => {
    renderWithApollo(<ResetPasswordScreen />);
    expect(screen.getByText('Reset Your Password')).toBeTruthy();
  });

  it('renders password fields', () => {
    renderWithApollo(<ResetPasswordScreen />);
    expect(screen.getByText('New Password')).toBeTruthy();
    expect(screen.getByText('Confirm Password')).toBeTruthy();
  });

  it('renders the reset password button', () => {
    renderWithApollo(<ResetPasswordScreen />);
    expect(screen.getByText('Reset Password')).toBeTruthy();
  });

  it('renders description text', () => {
    renderWithApollo(<ResetPasswordScreen />);
    expect(screen.getByText(/Enter your new password below/)).toBeTruthy();
  });

  it('calls clearAuth on mount', () => {
    renderWithApollo(<ResetPasswordScreen />);
    expect(mockClearAuth).toHaveBeenCalled();
  });

  it('calls goBack when header close button is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<ResetPasswordScreen />);
    await user.press(screen.getByTestId('header-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('ResetPasswordScreen - invalid token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useRoute } = require('@react-navigation/native');
    (useRoute as jest.Mock).mockReturnValue({
      params: { token: 'short' },
      key: 'test-key',
      name: 'ResetPassword',
    });
  });

  it('renders invalid reset link view when token is too short', () => {
    renderWithApollo(<ResetPasswordScreen />);
    expect(screen.getByText('Invalid Reset Link')).toBeTruthy();
  });

  it('renders Return to Login button in invalid state', () => {
    renderWithApollo(<ResetPasswordScreen />);
    expect(screen.getByText('Return to Login')).toBeTruthy();
  });

  it('navigates to login when Return to Login is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<ResetPasswordScreen />);
    await user.press(screen.getByText('Return to Login'));
    expect(mockNavigateToLogin).toHaveBeenCalledTimes(1);
  });
});
