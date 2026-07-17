import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { SignUpScreen } from '../SignUpScreen';

// --- Mocks ---

const mockGoBack = jest.fn();
const mockNavigateToLogin = jest.fn();
const mockRegister = jest.fn();

jest.mock('#/services/authService', () => ({
  authService: {
    register: (...args: unknown[]) => mockRegister(...args),
    handleAuthError: jest.fn(),
  },
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
      onBackPress,
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
      onBackPress?: () => void;
      footerText?: string;
      footerLinkText?: string;
      footerLinkTestID?: string;
      onFooterLinkPress?: () => void;
    }) => (
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
  // A permissive real schema so `handleSubmit` passes validation and invokes
  // `onSubmit` (the default `() => ({})` isn't a yup schema and blocks submit).
  getSignUpValidationSchema: () => require('yup').object({}),
}));

beforeEach(() => {
  mockRegister.mockReset();
});

describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the signup screen container', () => {
    renderWithApollo(<SignUpScreen />);
    expect(screen.getByTestId('signup-screen')).toBeTruthy();
  });

  it('renders the create account title', () => {
    renderWithApollo(<SignUpScreen />);
    expect(screen.getByText('Create account')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    renderWithApollo(<SignUpScreen />);
    expect(screen.getByText('Join Sous Chef today')).toBeTruthy();
  });

  it('renders the Sign Up submit button', () => {
    renderWithApollo(<SignUpScreen />);
    expect(screen.getByTestId('signup-submit-button')).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('renders the back button', () => {
    renderWithApollo(<SignUpScreen />);
    expect(screen.getByTestId('back-button')).toBeTruthy();
  });

  it('calls goBack when back button is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<SignUpScreen />);
    await user.press(screen.getByTestId('back-button'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders sign in footer link', () => {
    renderWithApollo(<SignUpScreen />);
    expect(screen.getByText('Already have an account?')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('navigates to login when footer link is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<SignUpScreen />);
    await user.press(screen.getByTestId('signup-login-link'));
    expect(mockNavigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('shows the inline "check your inbox" confirmation on successful registration', async () => {
    mockRegister.mockResolvedValue(true);
    const user = userEvent.setup();
    renderWithApollo(<SignUpScreen />);

    await user.press(screen.getByTestId('signup-submit-button'));

    // Registration succeeded → the form is replaced by the verification-sent
    // confirmation (no navigation into the app, no auth).
    await waitFor(() => {
      expect(screen.getByTestId('signup-verification-sent')).toBeTruthy();
    });
    expect(screen.getByText('Check your inbox')).toBeTruthy();
    // Resend is available on the confirmation (spec: verification hand-off).
    expect(screen.getByTestId('signup-resend-button')).toBeTruthy();
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('stays on the form (no confirmation) when registration is rejected', async () => {
    mockRegister.mockResolvedValue(false);
    const user = userEvent.setup();
    renderWithApollo(<SignUpScreen />);

    await user.press(screen.getByTestId('signup-submit-button'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('signup-verification-sent')).toBeNull();
    expect(screen.getByTestId('signup-screen')).toBeTruthy();
  });
});
