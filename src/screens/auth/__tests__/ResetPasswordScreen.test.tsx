import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { useRoute } from '@react-navigation/native';
import {
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import type { RootState } from '#store';
import {
  ResetPasswordDocument,
  ValidatePasswordResetTokenDocument,
} from '#operations/auth/auth.generated';
import { PasswordActionStatus } from '#/graphql/generated/schemaTypes';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
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
  useAppStore: (selector: (s: Pick<RootState, 'clearAuth'>) => unknown) =>
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

jest.mock('#/utils/finallyHelpers');

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/molecules/Header', () => {
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

jest.mock('#components/atoms/PasswordInput', () => {
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

jest.mock('#components/base/Button', () => {
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
): MockedResponse => {
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

const NEW_PASSWORD_INPUT = () =>
  screen.getByTestId('password-input-Enter your new password');
const CONFIRM_PASSWORD_INPUT = () =>
  screen.getByTestId('password-input-Confirm your new password');

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  // Opening a link must not end a session by itself — any web page can present
  // one. These four cover the whole rule: the session survives until the SERVER
  // says the token is genuine, and survives outright if it says otherwise.
  it('does NOT clear the session before the token is validated', () => {
    renderWithApollo(<ResetPasswordScreen />, {
      operationMocks: [validateMock()],
    });

    expect(screen.getByTestId('reset-password-checking')).toBeTruthy();
    expect(mockClearAuth).not.toHaveBeenCalled();
  });

  it('clears the session only once the server accepts the token', async () => {
    await renderOnForm();
    expect(mockClearAuth).toHaveBeenCalledTimes(1);
  });

  it('keeps the session and shows the invalid-link view for a spent token', async () => {
    renderWithApollo(<ResetPasswordScreen />, {
      operationMocks: [validateMock(PasswordActionStatus.InvalidOrExpired)],
    });

    expect(await screen.findByText('Invalid Reset Link')).toBeTruthy();
    expect(mockClearAuth).not.toHaveBeenCalled();
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
    expect(mockClearAuth).not.toHaveBeenCalled();
  });

  it('keeps the session when the token cannot be checked at all', async () => {
    // An unreachable server is not proof the link is good — fail closed.
    renderWithApollo(<ResetPasswordScreen />, {
      operationMocks: [validateMock('error')],
    });

    expect(await screen.findByText('Invalid Reset Link')).toBeTruthy();
    expect(mockClearAuth).not.toHaveBeenCalled();
  });

  it('calls goBack when header close button is pressed', async () => {
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
    // The auto-mocked wrapper swallows the submit, so run the callback for real
    // to exercise the mutation and its result handling.
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

    const operationMocks: MockedResponse[] = [
      {
        request: {
          query: ResetPasswordDocument,
          variables: {
            input: {
              token: 'valid-token-0123456789',
              newPassword: 'Test123!',
            },
          },
        },
        result: {
          data: {
            resetPassword: {
              __typename: 'ResetPasswordPayload',
              status: PasswordActionStatus.InvalidOrExpired,
            },
          },
        },
      },
    ];

    const user = userEvent.setup();
    await renderOnForm(operationMocks);

    await user.type(NEW_PASSWORD_INPUT(), 'Test123!');
    await user.type(CONFIRM_PASSWORD_INPUT(), 'Test123!');
    await user.press(screen.getByTestId('button-Reset Password'));

    // A spent link must take the user off the form — it can never succeed.
    expect(await screen.findByText('Invalid Reset Link')).toBeTruthy();
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
