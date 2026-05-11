import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SignUpScreen } from '../SignUpScreen';

// --- Mocks ---

const mockRegister = jest.fn();
const mockHandleAuthError = jest.fn();
const mockGoBack = jest.fn();
const mockNavigateToLogin = jest.fn();

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    handleAuthError: mockHandleAuthError,
    isLoading: false,
  }),
}));

jest.mock('#hooks/navigation/useAuthNavigation', () => ({
  useAuthNavigation: () => ({
    navigateToLogin: mockNavigateToLogin,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: jest.fn(),
    dispatch: jest.fn(),
    canGoBack: jest.fn(() => true),
    addListener: jest.fn(() => jest.fn()),
  }),
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
      onBackPress,
      footerText,
      footerLinkText,
      footerLinkTestID,
      onFooterLinkPress,
    }: any) => (
      <View testID="auth-form-template">
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        {onBackPress ? (
          <Pressable testID="back-button" onPress={onBackPress}>
            <Text>Back</Text>
          </Pressable>
        ) : null}
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

jest.mock('#components/atoms/PasswordInput', () => ({
  PasswordInput: 'PasswordInput',
}));

jest.mock('#components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: 'BaseInput',
}));

jest.mock('#/utils/validation/auth', () => ({
  getSignUpValidationSchema: () => ({}),
}));

describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the signup screen container', () => {
    render(<SignUpScreen />);
    expect(screen.getByTestId('signup-screen')).toBeTruthy();
  });

  it('renders the create account title', () => {
    render(<SignUpScreen />);
    expect(screen.getByText('Create account')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<SignUpScreen />);
    expect(screen.getByText('Join Sous Chef today')).toBeTruthy();
  });

  it('renders the Sign Up submit button', () => {
    render(<SignUpScreen />);
    expect(screen.getByTestId('signup-submit-button')).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('renders the back button', () => {
    render(<SignUpScreen />);
    expect(screen.getByTestId('back-button')).toBeTruthy();
  });

  it('calls goBack when back button is pressed', async () => {
    const user = userEvent.setup();
    render(<SignUpScreen />);
    await user.press(screen.getByTestId('back-button'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders sign in footer link', () => {
    render(<SignUpScreen />);
    expect(screen.getByText('Already have an account?')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('navigates to login when footer link is pressed', async () => {
    const user = userEvent.setup();
    render(<SignUpScreen />);
    await user.press(screen.getByTestId('signup-login-link'));
    expect(mockNavigateToLogin).toHaveBeenCalledTimes(1);
  });
});
