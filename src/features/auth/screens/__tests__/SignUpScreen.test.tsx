import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { ResendVerificationEmailDocument } from '#operations/auth/auth.generated';
import { SignUpScreen } from '../SignUpScreen';

// --- Mocks ---

const mockNavigateToLogin = jest.fn();
const mockRegister = jest.fn();

jest.mock('#/services/authService', () => ({
  authService: {
    register: (...args: unknown[]) => mockRegister(...args),
    handleAuthError: jest.fn(),
  },
}));

jest.mock('#features/auth/hooks/useAuthNavigation', () => ({
  useAuthNavigation: () => ({
    navigateToLogin: mockNavigateToLogin,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
    dispatch: jest.fn(),
    canGoBack: jest.fn(() => true),
    addListener: jest.fn(() => jest.fn()),
  }),
}));

jest.mock('#features/auth/components/AuthWrapper', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    AuthWrapper: ({
      children,
      testID,
      onBack,
    }: {
      children?: React.ReactNode;
      testID?: string;
      onBack?: () => void;
    }) => (
      <View testID={testID}>
        {onBack ? (
          <Pressable testID="back-button" onPress={onBack}>
            <Text>Back</Text>
          </Pressable>
        ) : null}
        {children}
      </View>
    ),
  };
});

jest.mock('#features/auth/components/AuthFormTemplate', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    AuthFormTemplate: ({
      title,
      subtitle,
      submitText,
      submitButtonTestID,
      onSubmit,
      submitDisabled,
      submitCountdown,
      footerText,
      footerLinkText,
      footerLinkTestID,
      onFooterLinkPress,
      linkText,
      linkTestID,
      onLinkPress,
      linkDisabled,
      linkCountdown,
    }: {
      title?: string;
      subtitle?: string;
      submitText?: string;
      submitButtonTestID?: string;
      onSubmit?: () => void;
      submitDisabled?: boolean;
      submitCountdown?: number;
      footerText?: string;
      footerLinkText?: string;
      footerLinkTestID?: string;
      onFooterLinkPress?: () => void;
      linkText?: string;
      linkTestID?: string;
      onLinkPress?: () => void;
      linkDisabled?: boolean;
      linkCountdown?: number;
    }) => (
      <View testID="auth-form-template">
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        <Pressable
          testID={submitButtonTestID}
          onPress={onSubmit}
          disabled={submitDisabled}
          accessibilityState={{ disabled: !!submitDisabled }}
        >
          <Text>
            {submitCountdown && submitCountdown > 0
              ? `${submitText} (${submitCountdown}s)`
              : submitText}
          </Text>
        </Pressable>
        {linkText ? (
          <Pressable
            testID={linkTestID}
            onPress={onLinkPress}
            disabled={linkDisabled}
            accessibilityState={{ disabled: !!linkDisabled }}
          >
            <Text>
              {linkCountdown && linkCountdown > 0
                ? `${linkText} (${linkCountdown}s)`
                : linkText}
            </Text>
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

jest.mock('#components/molecules/EmailInput', () => ({
  EmailInput: 'EmailInput',
}));

jest.mock('#components/molecules/PasswordInput', () => ({
  PasswordInput: 'PasswordInput',
}));

jest.mock('#components/molecules/BaseInput/BaseInput', () => ({
  BaseInput: 'BaseInput',
}));

jest.mock('#/utils/validation/auth', () => {
  const yup = require('yup');
  return {
    // A permissive real schema so `handleSubmit` passes validation and invokes
    // `onSubmit` (the default `() => ({})` isn't a yup schema and blocks
    // submit). The inputs are string mocks and cannot be typed into, so the
    // address is seeded through the cast — `onSubmit` reads the resolver's
    // output, and the confirmation needs a real one to resend to.
    getSignUpValidationSchema: () =>
      yup.object({
        email: yup.string().transform(() => 'new@example.com'),
      }),
    // The success branch renders CodeVerificationScreen, which builds its own
    // resolver. A partial factory here would leave that undefined.
    getEmailVerificationValidationSchema: () => yup.object({}),
  };
});

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

  it('renders no back button, like the other root auth screens', () => {
    renderWithApollo(<SignUpScreen />);
    expect(screen.queryByTestId('back-button')).toBeNull();
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

  it('offers code entry when the new account cannot sign in', async () => {
    mockRegister.mockResolvedValue('verificationSent');
    const user = userEvent.setup();
    renderWithApollo(<SignUpScreen />);

    await user.press(screen.getByTestId('signup-submit-button'));

    // The address refused the password (taken, or a deleted account), so the
    // form is replaced by the code screen. The activation mail carries a code
    // AND a link, so the user can finish here instead of leaving for their inbox.
    await waitFor(() => {
      expect(screen.getByTestId('code-verification-screen')).toBeTruthy();
    });
    expect(screen.getByText('Enter Code')).toBeTruthy();
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('opens the resend cooldown as soon as the activation mail is sent', async () => {
    // The mail has already gone out, so the first resend tap must not be able
    // to fire a duplicate send seconds later.
    const recordedVariables: Record<string, unknown>[] = [];
    mockRegister.mockResolvedValue('verificationSent');
    const user = userEvent.setup();
    renderWithApollo(<SignUpScreen />, {
      operationMocks: [
        {
          request: {
            query: ResendVerificationEmailDocument,
            variables: variables => {
              recordedVariables.push(variables);
              return true;
            },
          },
          result: {
            data: {
              resendVerificationEmail: {
                __typename: 'ResendVerificationEmailPayload',
                user: { __typename: 'User', id: '1' },
              },
            },
          },
        },
      ],
    });

    await user.press(screen.getByTestId('signup-submit-button'));
    await waitFor(() => {
      expect(screen.getByTestId('code-verification-screen')).toBeTruthy();
    });

    // Resend sits in the link slot on this context and opens inside the first
    // cooldown, so the tap cannot fire a duplicate send.
    expect(screen.getByTestId('resend-code')).toBeDisabled();
    await user.press(screen.getByTestId('resend-code'));

    expect(recordedVariables).toHaveLength(0);
  });

  it('leaves a signed-in registration to the verification gate', async () => {
    // The root navigator swaps the auth group for the gate, which offers the
    // skip; code entry here would be a second, skip-less copy of it.
    mockRegister.mockResolvedValue('signedIn');
    const user = userEvent.setup();
    renderWithApollo(<SignUpScreen />);

    await user.press(screen.getByTestId('signup-submit-button'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('code-verification-screen')).toBeNull();
  });

  it('stays on the form (no code entry) when registration is rejected', async () => {
    mockRegister.mockResolvedValue('failed');
    const user = userEvent.setup();
    renderWithApollo(<SignUpScreen />);

    await user.press(screen.getByTestId('signup-submit-button'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('code-verification-screen')).toBeNull();
    expect(screen.getByTestId('signup-screen')).toBeTruthy();
  });
});
