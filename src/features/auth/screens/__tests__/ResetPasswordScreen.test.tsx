import { toastService } from '#/services/toastService';
import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { useRoute } from '@react-navigation/native';
import type { MockDataFor, MockFor } from '#/test-utils/apolloMockProvider';
import {
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import { authService } from '#/services/authService';
import {
  ResetPasswordDocument,
  ValidatePasswordResetTokenDocument,
} from '#operations/auth/auth.generated';
import {
  ErrorCode,
  PasswordActionStatus,
} from '#/graphql/generated/schemaTypes';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { ResetPasswordScreen } from '../ResetPasswordScreen';

// --- Mocks ---

const mockGoBack = jest.fn();
const mockReplaceWithLogin = jest.fn();
const mockToastError = jest.mocked(toastService.error);
const mockLogout = jest
  .spyOn(authService, 'logout')
  .mockResolvedValue(undefined);

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

jest.mock('#features/auth/screens/useAuthNavigation', () => ({
  useAuthNavigation: () => ({
    replaceWithLogin: mockReplaceWithLogin,
  }),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#components/atoms/Icon', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/organisms/Header', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    Header: ({ onClose }: { onClose?: () => void }) => (
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

jest.mock('#components/molecules/PasswordInput', () => {
  const { TextInput } = require('react-native');
  return {
    PasswordInput: ({
      value,
      onChangeText,
      placeholder,
      errorMessage,
    }: {
      value?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
      errorMessage?: string;
    }) => (
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

jest.mock('#components/molecules/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      children,
      onPress,
      disabled,
      loading,
    }: {
      children?: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
      loading?: boolean;
    }) => (
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

const TOKEN = 'valid-token-0123456789';

/**
 * The screen validates the link's token before it does anything
 * session-affecting, so every render needs a verdict for that call.
 */
const validateMock = (
  status: PasswordActionStatus | 'error' = PasswordActionStatus.Sent,
): MockFor<typeof ValidatePasswordResetTokenDocument> => {
  const request = {
    query: ValidatePasswordResetTokenDocument,
    variables: { input: { token: TOKEN } },
  };
  return status === 'error'
    ? { request, error: new Error('network down'), maxUsageCount: 99 }
    : {
        request,
        maxUsageCount: 99,
        result: {
          data: {
            validatePasswordResetToken: {
              __typename: 'ValidatePasswordResetTokenPayload',
              status,
            },
          },
        },
      };
};

/** Render with an accepted token and wait for the form to appear. */
const renderOnForm = async (extraMocks: MockedResponse[] = []) => {
  const result = renderWithApollo(<ResetPasswordScreen />, {
    operationMocks: [validateMock(), ...extraMocks],
  });
  await screen.findByText('Reset Your Password');
  return result;
};

/** The auto-mocked wrapper swallows a submit; this runs it for real. */
const runSubmitForReal = () =>
  (executeWithLoadingState as jest.Mock).mockImplementation(
    async (
      fn: () => Promise<void>,
      setLoading: (v: boolean) => void,
      onError?: (e: unknown) => void,
    ) => {
      setLoading(true);
      try {
        await fn();
      } catch (error) {
        onError?.(error);
      } finally {
        setLoading(false);
      }
    },
  );

const resetMock = (
  resetPassword: MockDataFor<typeof ResetPasswordDocument>['resetPassword'],
): MockFor<typeof ResetPasswordDocument> => ({
  request: {
    query: ResetPasswordDocument,
    variables: { input: { token: TOKEN, newPassword: 'Test123!' } },
  },
  result: { data: { resetPassword } },
});

const submitNewPassword = async () => {
  const user = userEvent.setup();
  await user.type(NEW_PASSWORD_INPUT(), 'Test123!');
  await user.type(CONFIRM_PASSWORD_INPUT(), 'Test123!');
  await user.press(screen.getByTestId('button-Reset Password'));
  return user;
};

const NEW_PASSWORD_INPUT = () =>
  screen.getByTestId('password-input-Enter your new password');
const CONFIRM_PASSWORD_INPUT = () =>
  screen.getByTestId('password-input-Confirm your new password');

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Signed in: the case the rule below is about.
    useStore.setState({ accessToken: 'live-access', refreshToken: 'live' });
    // clearAllMocks wipes calls but keeps implementations, and one test below
    // swaps the route params — restore the default link for every test.
    (useRoute as jest.Mock).mockImplementation(() => ({
      params: { token: TOKEN },
      key: 'test-key',
      name: 'ResetPassword',
    }));
  });

  it('renders the reset password form when token is valid', async () => {
    await renderOnForm();
    expect(screen.getByText('Reset Your Password')).toBeTruthy();
  });

  it('shows no mismatch under a confirmation the user has not reached', async () => {
    await renderOnForm();
    const user = userEvent.setup();

    await user.type(NEW_PASSWORD_INPUT(), 'N');
    await waitFor(() => expect(NEW_PASSWORD_INPUT().props.value).toBe('N'));

    expect(CONFIRM_PASSWORD_INPUT().props.accessibilityHint).toBeUndefined();
  });

  it('reports the mismatch under the confirmation once it has been reached', async () => {
    await renderOnForm();
    const user = userEvent.setup();

    await user.type(NEW_PASSWORD_INPUT(), 'NewPass123');
    await user.type(CONFIRM_PASSWORD_INPUT(), 'NewPass123');
    await waitFor(() =>
      expect(CONFIRM_PASSWORD_INPUT().props.accessibilityHint).toBeUndefined(),
    );

    // The fix belongs to the OTHER field: the rule reports on the
    // confirmation while reading the new password.
    await user.type(NEW_PASSWORD_INPUT(), '4');

    await waitFor(() =>
      expect(CONFIRM_PASSWORD_INPUT().props.accessibilityHint).toBe(
        'Passwords must match',
      ),
    );
  });

  it('renders password fields', async () => {
    await renderOnForm();
    expect(screen.getByText('New Password')).toBeTruthy();
    expect(screen.getByText('Confirm Password')).toBeTruthy();
  });

  it('renders the reset password button', async () => {
    await renderOnForm();
    expect(screen.getByText('Reset Password')).toBeTruthy();
  });

  it('renders description text', async () => {
    await renderOnForm();
    expect(screen.getByText(/Enter your new password below/)).toBeTruthy();
  });

  // Any web page can present a link, and it may be another account's: opening
  // one, genuine or not, leaves the session alone. Only a completed reset ends it.
  it('keeps the session while the token is checked', () => {
    renderWithApollo(<ResetPasswordScreen />, {
      operationMocks: [validateMock()],
    });

    expect(screen.getByTestId('reset-password-checking')).toBeTruthy();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('keeps the session when the server accepts the token', async () => {
    await renderOnForm();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('tells a signed-in reader that finishing signs them out here', async () => {
    await renderOnForm();
    expect(screen.getByTestId('reset-password-signs-out-note')).toBeTruthy();
  });

  it('has nothing to warn about when nobody is signed in', async () => {
    useStore.setState({ accessToken: null, refreshToken: null });
    await renderOnForm();
    expect(screen.queryByTestId('reset-password-signs-out-note')).toBeNull();
  });

  it('keeps the session and shows the invalid-link view for a spent token', async () => {
    renderWithApollo(<ResetPasswordScreen />, {
      operationMocks: [validateMock(PasswordActionStatus.InvalidOrExpired)],
    });

    expect(await screen.findByText('Invalid Reset Link')).toBeTruthy();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('keeps the session and shows the invalid-link view when the link carries no token', () => {
    // The invalid-link guard runs before the checking guard, so a malformed
    // link never reaches the server and never touches the session.
    (useRoute as jest.Mock).mockReturnValue({
      params: {},
      key: 'test-key',
      name: 'ResetPassword',
    });

    renderWithApollo(<ResetPasswordScreen />);

    expect(screen.getByText('Invalid Reset Link')).toBeTruthy();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('keeps the session when the token cannot be checked at all', async () => {
    // An unreachable server is not proof the link is good — fail closed.
    renderWithApollo(<ResetPasswordScreen />, {
      operationMocks: [validateMock('error')],
    });

    expect(await screen.findByText('Invalid Reset Link')).toBeTruthy();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('goes back to where the link was opened from when closed', async () => {
    const user = userEvent.setup();
    await renderOnForm();
    await user.press(screen.getByTestId('header-close'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the submit button disabled until the confirmation is filled in', async () => {
    const user = userEvent.setup();
    await renderOnForm();

    const submit = screen.getByTestId('button-Reset Password');
    expect(submit).toBeDisabled();

    // A valid password alone is not enough — confirmation is still empty.
    await user.type(NEW_PASSWORD_INPUT(), 'Test123!');
    expect(submit).toBeDisabled();
  });

  it('enables the submit button once both passwords are valid and match', async () => {
    const user = userEvent.setup();
    await renderOnForm();

    await user.type(NEW_PASSWORD_INPUT(), 'Test123!');
    await user.type(CONFIRM_PASSWORD_INPUT(), 'Test123!');

    expect(screen.getByTestId('button-Reset Password')).toBeEnabled();
  });

  it('keeps the submit button disabled when the passwords do not match', async () => {
    const user = userEvent.setup();
    await renderOnForm();

    await user.type(NEW_PASSWORD_INPUT(), 'Test123!');
    await user.type(CONFIRM_PASSWORD_INPUT(), 'Test123?');

    expect(screen.getByTestId('button-Reset Password')).toBeDisabled();
  });

  it('keeps the submit button disabled for a password that fails complexity', async () => {
    const user = userEvent.setup();
    await renderOnForm();

    await user.type(NEW_PASSWORD_INPUT(), 'alllowercase');
    await user.type(CONFIRM_PASSWORD_INPUT(), 'alllowercase');

    expect(screen.getByTestId('button-Reset Password')).toBeDisabled();
  });

  it('shows the invalid-link view when the server reports the token spent', async () => {
    runSubmitForReal();
    await renderOnForm([
      resetMock({
        __typename: 'ResetPasswordPayload',
        status: PasswordActionStatus.InvalidOrExpired,
      }),
    ]);

    await submitNewPassword();

    // A spent link must take the user off the form — it can never succeed.
    expect(await screen.findByText('Invalid Reset Link')).toBeTruthy();
  });

  // The server ended every session of the link's account, perhaps this one, so
  // the session here ends through the one sign-out, without its discards.
  it('signs the session out once the reset completes, keeping its work, and offers sign-in', async () => {
    runSubmitForReal();
    await renderOnForm([
      resetMock({
        __typename: 'ResetPasswordPayload',
        status: PasswordActionStatus.Completed,
      }),
    ]);

    const user = await submitNewPassword();

    expect(await screen.findByText('Password reset')).toBeTruthy();
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledWith({
      keepBiometricCredentials: true,
      keepQueuedWrites: true,
    });

    await user.press(screen.getByTestId('button-Sign In'));
    expect(mockReplaceWithLogin).toHaveBeenCalledTimes(1);
  });

  it('signs nobody out after a reset when no session is held', async () => {
    useStore.setState({ accessToken: null, refreshToken: null });
    runSubmitForReal();
    await renderOnForm([
      resetMock({
        __typename: 'ResetPasswordPayload',
        status: PasswordActionStatus.Completed,
      }),
    ]);

    await submitNewPassword();

    expect(await screen.findByText('Password reset')).toBeTruthy();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('reports a refused password on the field, in the reader’s language', async () => {
    runSubmitForReal();

    const SERVER_PROSE = 'Password must contain an uppercase letter';
    await renderOnForm([
      resetMock({
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: SERVER_PROSE,
        field: 'newPassword',
      }),
    ]);

    await submitNewPassword();

    // The mocked PasswordInput surfaces its errorMessage as the a11y hint.
    await waitFor(() =>
      expect(NEW_PASSWORD_INPUT().props.accessibilityHint).toBe(
        'That password doesn’t meet the rules: 8–72 characters, with an uppercase letter, a lowercase letter and a number.',
      ),
    );

    // The server's own prose is English by construction and must never render.
    expect(screen.queryByText(SERVER_PROSE)).toBeNull();
    expect(mockToastError).not.toHaveBeenCalledWith(SERVER_PROSE);
  });
});

describe('ResetPasswordScreen - invalid token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStore.setState({ accessToken: null, refreshToken: null });
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

  it('takes a signed-out reader to sign-in', async () => {
    const user = userEvent.setup();
    renderWithApollo(<ResetPasswordScreen />);
    await user.press(screen.getByText('Return to Login'));
    expect(mockReplaceWithLogin).toHaveBeenCalledTimes(1);
  });

  // Signed in, there is no sign-in screen to return to.
  it('takes a signed-in reader back to where the link was opened', async () => {
    useStore.setState({ accessToken: 'live-access', refreshToken: 'live' });
    const user = userEvent.setup();
    renderWithApollo(<ResetPasswordScreen />);
    await user.press(screen.getByText('Go Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockReplaceWithLogin).not.toHaveBeenCalled();
  });
});
