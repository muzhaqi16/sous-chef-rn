import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderWithApollo, recordMock } from '#/test-utils/apolloMockProvider';
import { RequestPasswordResetDocument } from '#operations/auth/auth.generated';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';

// --- Mocks ---

const TEST_EMAIL = 'ada@example.com';

const mockNavigateToLogin = jest.fn();

jest.mock('#hooks/navigation/useAuthNavigation', () => ({
  useAuthNavigation: () => ({
    navigateToLogin: mockNavigateToLogin,
  }),
}));

const mockToast = jest.fn();
jest.mock('#/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: jest.fn(),
    getUserFriendlyMessage: (code: string, fallback?: string) =>
      fallback ?? code,
  },
}));

// A real (permissive) schema, not `{}` — yupResolver has to be able to run it,
// or handleSubmit routes every press to the validation-error branch and the
// mutation never fires. AuthFormTemplate is mocked below, so the email field
// never renders; the transform stands in for what the user would have typed.
jest.mock('#utils/validation/auth', () => {
  const yup = require('yup');
  return {
    getForgotPasswordValidationSchema: () =>
      yup.object({
        email: yup.string().transform((value: string) => value || TEST_EMAIL),
      }),
  };
});

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
      footerText,
      footerLinkText,
      footerLinkTestID,
      onFooterLinkPress,
      footerLinkDisabled,
      footerLinkCountdown,
    }: {
      title?: string;
      subtitle?: string | React.ReactNode;
      submitText?: string;
      submitButtonTestID?: string;
      onSubmit?: () => void;
      footerText?: string;
      footerLinkText?: string;
      footerLinkTestID?: string;
      onFooterLinkPress?: () => void;
      footerLinkDisabled?: boolean;
      footerLinkCountdown?: number;
    }) => (
      <View testID="auth-form-template">
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        <Pressable testID={submitButtonTestID} onPress={onSubmit}>
          <Text>{submitText}</Text>
        </Pressable>
        {footerText ? <Text>{footerText}</Text> : null}
        {footerLinkText ? (
          <Pressable
            testID={footerLinkTestID}
            onPress={onFooterLinkPress}
            disabled={footerLinkDisabled}
          >
            <Text>{footerLinkText}</Text>
            <Text testID="footer-link-disabled">
              {String(!!footerLinkDisabled)}
            </Text>
            <Text testID="footer-link-countdown">{footerLinkCountdown}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

jest.mock('#components/atoms/EmailInput', () => ({
  EmailInput: 'EmailInput',
}));

// --- Helpers ---

const sentPayload = {
  requestPasswordReset: {
    __typename: 'RequestPasswordResetPayload',
    status: 'SENT',
  },
};

const submit = async (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByTestId('forgot-password-submit-button'));

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form with title, subtitle, submit and sign-in link', () => {
    renderWithApollo(<ForgotPasswordScreen />);
    expect(screen.getByTestId('forgot-password-screen')).toBeTruthy();
    expect(screen.getByText('Forgot password')).toBeTruthy();
    expect(screen.getByText('Enter your email to reset')).toBeTruthy();
    expect(screen.getByText('Send Reset Link')).toBeTruthy();
    expect(screen.getByText('Remembered it?')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('navigates to login when the Sign In footer link is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<ForgotPasswordScreen />);
    await user.press(screen.getByTestId('forgot-password-login-link'));
    expect(mockNavigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('confirms the send instead of navigating away on success', async () => {
    const user = userEvent.setup();
    const { mock } = recordMock(RequestPasswordResetDocument, {
      data: sentPayload,
    });
    renderWithApollo(<ForgotPasswordScreen />, { operationMocks: [mock] });

    await submit(user);

    // The headline fix: the user gets confirmation and stays put, rather than
    // being bounced to sign-in with no feedback either way.
    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeTruthy();
    });
    expect(screen.getByText(TEST_EMAIL)).toBeTruthy();
    expect(mockNavigateToLogin).not.toHaveBeenCalled();
  });

  it('offers a manual way back to sign in once the link is sent', async () => {
    const user = userEvent.setup();
    const { mock } = recordMock(RequestPasswordResetDocument, {
      data: sentPayload,
    });
    renderWithApollo(<ForgotPasswordScreen />, { operationMocks: [mock] });

    await submit(user);
    await waitFor(() => {
      expect(screen.getByText('Back to Sign In')).toBeTruthy();
    });

    await user.press(
      screen.getByTestId('forgot-password-back-to-login-button'),
    );
    expect(mockNavigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('stays on the form and toasts when the server refuses', async () => {
    const user = userEvent.setup();
    const { mock } = recordMock(RequestPasswordResetDocument, {
      data: {
        requestPasswordReset: {
          __typename: 'ValidationError',
          code: 'VALIDATION',
          message: 'Email is invalid.',
        },
      },
    });
    renderWithApollo(<ForgotPasswordScreen />, { operationMocks: [mock] });

    await submit(user);

    // A union refusal resolves 200 with no transport error — the old
    // presence-only check reported it as a successful send.
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        message: 'Email is invalid.',
        type: 'error',
      });
    });
    expect(screen.getByText('Forgot password')).toBeTruthy();
    expect(screen.queryByText('Check your email')).toBeNull();
    expect(mockNavigateToLogin).not.toHaveBeenCalled();
  });

  it('locks the resend link behind a countdown after sending', async () => {
    const user = userEvent.setup();
    const { mock } = recordMock(RequestPasswordResetDocument, {
      data: sentPayload,
      maxUsageCount: 2,
    });
    renderWithApollo(<ForgotPasswordScreen />, { operationMocks: [mock] });

    await submit(user);
    await waitFor(() => {
      expect(screen.getByText('Resend link')).toBeTruthy();
    });

    // First send opens the 30s window, so an immediate resend is refused.
    expect(screen.getByTestId('footer-link-disabled')).toHaveTextContent(
      'true',
    );
    expect(screen.getByTestId('footer-link-countdown')).toHaveTextContent('30');
  });

  it('resends to the same address the link was sent to', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { mock, fired } = recordMock(RequestPasswordResetDocument, {
      data: sentPayload,
      maxUsageCount: 2,
    });
    renderWithApollo(<ForgotPasswordScreen />, { operationMocks: [mock] });

    await submit(user);
    await waitFor(() => {
      expect(screen.getByText('Resend link')).toBeTruthy();
    });

    // Let the 30s cooldown elapse, then resend.
    jest.advanceTimersByTime(31000);
    await waitFor(() => {
      expect(screen.getByTestId('footer-link-disabled')).toHaveTextContent(
        'false',
      );
    });

    await user.press(screen.getByTestId('forgot-password-resend-link'));

    await waitFor(() => {
      expect(fired).toHaveLength(2);
    });
    // The resend targets the address the link already went to, rather than
    // re-reading a form the user can no longer see.
    expect(fired[0]).toEqual({ input: { email: TEST_EMAIL } });
    expect(fired[1]).toEqual(fired[0]);
    jest.useRealTimers();
  });
});
