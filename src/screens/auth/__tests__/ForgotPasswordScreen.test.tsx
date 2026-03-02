import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';

// --- Mocks ---

const mockNavigateToLogin = jest.fn();
const mockForgotPasswordApi = jest.fn().mockResolvedValue({});

jest.mock('#hooks/navigation/useAuthNavigation', () => ({
  useAuthNavigation: () => ({
    navigateToLogin: mockNavigateToLogin,
  }),
}));

jest.mock('#generated', () => ({
  useForgotPasswordMutation: () => [mockForgotPasswordApi],
}));

jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: jest.fn(),
  },
}));

jest.mock('#utils/validation/auth', () => ({
  getForgotPasswordValidationSchema: () => ({}),
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

jest.mock('#components/atoms/EmailInput', () => ({
  EmailInput: 'EmailInput',
}));

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the forgot password screen', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByTestId('forgot-password-screen')).toBeTruthy();
  });

  it('renders the title', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByText('Forgot password')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByText('Enter your email to reset')).toBeTruthy();
  });

  it('renders the submit button', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByTestId('forgot-password-submit-button')).toBeTruthy();
    expect(screen.getByText('Send Reset Link')).toBeTruthy();
  });

  it('renders the footer text and sign in link', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByText('Remembered it?')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('navigates to login when Sign In footer link is pressed', () => {
    render(<ForgotPasswordScreen />);
    fireEvent.press(screen.getByTestId('forgot-password-login-link'));
    expect(mockNavigateToLogin).toHaveBeenCalledTimes(1);
  });
});
