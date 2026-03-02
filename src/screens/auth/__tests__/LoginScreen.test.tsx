import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';

// --- Mocks ---

const mockLogin = jest.fn();
const mockHandleAuthError = jest.fn();
const mockLoadStoredCredentials = jest.fn();
const mockCheckStoredCredentials = jest.fn().mockResolvedValue(false);
const mockGetBiometricInfo = jest.fn().mockResolvedValue({
  isAvailable: false,
  biometryType: null,
});
const mockHandleRememberMeAccept = jest.fn();
const mockHandleRememberMeDecline = jest.fn();

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    handleAuthError: mockHandleAuthError,
    isLoading: false,
    loadStoredCredentials: mockLoadStoredCredentials,
    checkStoredCredentials: mockCheckStoredCredentials,
    getBiometricInfo: mockGetBiometricInfo,
    showRememberMeModal: false,
    pendingCredentials: null,
    handleRememberMeAccept: mockHandleRememberMeAccept,
    handleRememberMeDecline: mockHandleRememberMeDecline,
  }),
}));

const mockNavigateToForgotPassword = jest.fn();
const mockNavigateToSignUp = jest.fn();

jest.mock('#hooks/navigation/useAuthNavigation', () => ({
  useAuthNavigation: () => ({
    navigateToForgotPassword: mockNavigateToForgotPassword,
    navigateToSignUp: mockNavigateToSignUp,
  }),
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackScreen: jest.fn(),
    trackEvent: jest.fn(),
    trackError: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: jest.fn(
    async (fn: () => Promise<any>, _setLoading: any, _onError: any) => {
      await fn();
    },
  ),
  executeMutationWithErrorHandler: jest.fn(
    async (fn: () => Promise<any>, _onError: any) => {
      await fn();
    },
  ),
}));

jest.mock('#components/templates/AuthWrapper', () => {
  const { View } = require('react-native');
  return {
    AuthWrapper: ({ children, testID }: any) => (
      <View testID={testID}>{children}</View>
    ),
  };
});

jest.mock('#components/templates/AuthFormTemplate', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    AuthFormTemplate: ({
      title,
      subtitle,
      submitText,
      submitButtonTestID,
      onSubmit,
      linkText,
      linkTestID,
      onLinkPress,
      footerText,
      footerLinkText,
      footerLinkTestID,
      onFooterLinkPress,
    }: any) => (
      <View testID="auth-form-template">
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        <Pressable testID={submitButtonTestID} onPress={onSubmit}>
          <Text>{submitText}</Text>
        </Pressable>
        {linkText ? (
          <Pressable testID={linkTestID} onPress={onLinkPress}>
            <Text>{linkText}</Text>
          </Pressable>
        ) : null}
        {footerText ? <Text>{footerText}</Text> : null}
        {footerLinkText ? (
          <Pressable testID={footerLinkTestID} onPress={onFooterLinkPress}>
            <Text>{footerLinkText}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

jest.mock('#components/organisms/RememberMeModal', () => {
  const { View } = require('react-native');
  return {
    RememberMeModal: ({ visible }: any) =>
      visible ? <View testID="remember-me-modal" /> : null,
  };
});

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#/utils/validation/auth', () => ({
  getLoginValidationSchema: () => ({}),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the login screen container', () => {
    render(<LoginScreen />);
    expect(screen.getByTestId('login-screen')).toBeTruthy();
  });

  it('renders the sign in title', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Sign in to Sous Chef')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Access your pantry and more')).toBeTruthy();
  });

  it('renders the submit button with Log In text', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Log In')).toBeTruthy();
    expect(screen.getByTestId('login-submit-button')).toBeTruthy();
  });

  it('renders the forgot password link', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });

  it('navigates to forgot password when link is pressed', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByTestId('login-forgot-password-link'));
    expect(mockNavigateToForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('renders sign up footer link', () => {
    render(<LoginScreen />);
    expect(screen.getByText("Don't have an account?")).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('navigates to sign up when footer link is pressed', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByTestId('login-signup-link'));
    expect(mockNavigateToSignUp).toHaveBeenCalledTimes(1);
  });
});
