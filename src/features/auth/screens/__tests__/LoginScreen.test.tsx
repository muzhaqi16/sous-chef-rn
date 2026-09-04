import React from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { authService } from '#/services/authService';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { LoginScreen } from '../LoginScreen';

// --- Mocks ---

const mockHandleRememberMeAccept = jest.fn();
const mockHandleRememberMeDecline = jest.fn();

// LoginScreen drives login/biometric through `authService` directly; it only
// consumes `useRememberMe` for the RememberMe modal.
jest.mock('#features/auth/hooks/useRememberMe', () => ({
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

jest.mock('#features/auth/hooks/useAuthNavigation', () => ({
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

jest.mock('#features/auth/components/AuthWrapper', () => {
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

jest.mock('#features/auth/components/AuthFormTemplate', () => {
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

jest.mock('#features/auth/components/RememberMeModal', () => {
  const { View } = require('react-native');
  return {
    RememberMeModal: ({ visible }: { visible?: boolean }) =>
      visible ? <View testID="remember-me-modal" /> : null,
  };
});

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

// A REAL yup schema, permissive: `yupResolver` calls schema methods, so a plain
// `{}` throws the moment a submit actually validates — which no test did until
// the refusal tests below. Permissive because the mocked AuthFormTemplate
// renders no inputs to type into; the login rules themselves are covered by
// `utils/validation/__tests__/auth`.
jest.mock('#/utils/validation/auth', () => {
  const yup = jest.requireActual('yup');
  return {
    // Spread, not replace: the screen this routes to on a refusal builds its
    // own schema from the same module.
    ...jest.requireActual('#/utils/validation/auth'),
    getLoginValidationSchema: () => yup.object({}),
  };
});

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

  // AUTH_EMAIL_NOT_VERIFIED is a 403 that leaves the credential valid, and the
  // emailed code is what clears it. Left as a toast on this form, the only
  // thing the reader can do is submit the same password again.
  it('offers code entry when the mailbox is unverified', async () => {
    const loginSpy = jest
      .spyOn(authService, 'login')
      .mockImplementation(async (_input, options) => {
        options?.onRefusal?.('AUTH_EMAIL_NOT_VERIFIED');
        return false;
      });
    const user = userEvent.setup();
    // Apollo-wrapped: the screen it routes to owns the verify mutation.
    renderWithApollo(<LoginScreen />);

    await user.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('code-verification-screen')).toBeTruthy();
    });
    // Not a sign-out: nothing cleared the stored credentials on the way here.
    expect(loginSpy).toHaveBeenCalledTimes(1);
    loginSpy.mockRestore();
  });

  it('stays on the form for a refusal with nowhere to go', async () => {
    const loginSpy = jest
      .spyOn(authService, 'login')
      .mockImplementation(async (_input, options) => {
        options?.onRefusal?.('AUTH_CREDENTIALS_INVALID');
        return false;
      });
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => expect(loginSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('code-verification-screen')).toBeNull();
    expect(screen.getByTestId('login-screen')).toBeTruthy();
    loginSpy.mockRestore();
  });
});
