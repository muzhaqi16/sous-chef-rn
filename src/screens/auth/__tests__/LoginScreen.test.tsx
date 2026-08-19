import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';

// --- Mocks ---

const mockHandleRememberMeAccept = jest.fn();
const mockHandleRememberMeDecline = jest.fn();

// LoginScreen drives login/biometric through `authService` directly; it only
// consumes `useRememberMe` for the RememberMe modal.
jest.mock('#hooks/auth/useRememberMe', () => ({
  useRememberMe: () => ({
    showRememberMeModal: false,
    pendingCredentials: null,
    handleRememberMeAccept: mockHandleRememberMeAccept,
    handleRememberMeDecline: mockHandleRememberMeDecline,
    showRememberMePrompt: jest.fn(),
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

jest.mock('#/utils/finallyHelpers');

jest.mock('#components/templates/AuthWrapper', () => {
  const { View } = require('react-native');
  return {
    AuthWrapper: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => <View testID={testID}>{children}</View>,
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
    }: {
      title?: string;
      subtitle?: string;
      submitText?: string;
      submitButtonTestID?: string;
      onSubmit?: () => void;
      linkText?: string;
      linkTestID?: string;
      onLinkPress?: () => void;
      footerText?: string;
      footerLinkText?: string;
      footerLinkTestID?: string;
      onFooterLinkPress?: () => void;
    }) => (
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
    RememberMeModal: ({ visible }: { visible?: boolean }) =>
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

  it('navigates to forgot password when link is pressed', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.press(screen.getByTestId('login-forgot-password-link'));
    expect(mockNavigateToForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('renders sign up footer link', () => {
    render(<LoginScreen />);
    expect(screen.getByText("Don't have an account?")).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('navigates to sign up when footer link is pressed', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.press(screen.getByTestId('login-signup-link'));
    expect(mockNavigateToSignUp).toHaveBeenCalledTimes(1);
  });
});
