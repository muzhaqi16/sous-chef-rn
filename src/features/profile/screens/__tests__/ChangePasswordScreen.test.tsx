'use no memo';
import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import {
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { ChangePasswordDocument } from '#operations/auth/auth.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import type { Header } from '#components/molecules/Header';
import type { PasswordInputProps } from '#components/atoms/PasswordInput';
import { ChangePasswordScreen } from '../ChangePasswordScreen';

type HeaderProps = React.ComponentProps<typeof Header>;

const mockToast = jest.fn();

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = (
  jest.requireMock('#hooks/navigation/useAppNavigation') as {
    useAppNavigation: jest.Mock;
  }
).useAppNavigation();

jest.mock('#hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#utils/validation/auth', () => ({
  changePasswordSchema: {
    __isYupSchema: true,
    validate: jest.fn().mockResolvedValue({}),
    validateSync: jest.fn(),
    cast: jest.fn((v: unknown) => v),
    describe: jest.fn(() => ({ type: 'object', fields: {} })),
  },
}));

jest.mock('@hookform/resolvers/yup', () => ({
  yupResolver: () => jest.fn().mockResolvedValue({ values: {}, errors: {} }),
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/molecules/Header', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Header: ({ title, onBack }: Pick<HeaderProps, 'title' | 'onBack'>) => (
      <View testID="header">
        <Text>{title}</Text>
        {onBack ? (
          <Pressable testID="header-back" onPress={onBack}>
            <Text>Back</Text>
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
    }: Pick<
      PasswordInputProps,
      'value' | 'onChangeText' | 'placeholder' | 'errorMessage'
    >) => (
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

describe('ChangePasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with title', () => {
    renderWithApollo(<ChangePasswordScreen />);
    expect(screen.getByTestId('header')).toBeTruthy();
    // Both header and button contain "Change Password" text
    expect(
      screen.getAllByText('Change Password').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders the description text', () => {
    renderWithApollo(<ChangePasswordScreen />);
    expect(
      screen.getByText(
        /Enter your current password and choose a new secure password/,
      ),
    ).toBeTruthy();
  });

  it('renders Current Password field', () => {
    renderWithApollo(<ChangePasswordScreen />);
    expect(screen.getByText('Current Password')).toBeTruthy();
  });

  it('renders New Password field', () => {
    renderWithApollo(<ChangePasswordScreen />);
    expect(screen.getByText('New Password')).toBeTruthy();
  });

  it('renders Confirm New Password field', () => {
    renderWithApollo(<ChangePasswordScreen />);
    expect(screen.getByText('Confirm New Password')).toBeTruthy();
  });

  it('renders the submit button text', () => {
    renderWithApollo(<ChangePasswordScreen />);
    // "Change Password" appears in both header title and submit button
    const elements = screen.getAllByText('Change Password');
    expect(elements.length).toBe(2);
  });

  it('calls goBack when header back button is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<ChangePasswordScreen />);
    await user.press(screen.getByTestId('header-back'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  // The server refuses a weak password with a ValidationError naming the field.
  // Its `message` is English by construction, so the copy has to come from the
  // field key — and it belongs on the input, not in a toast that covers the
  // form and, once dismissed, cannot say which input it meant.
  it('reports a refused password on the field, in the reader’s language', async () => {
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

    const SERVER_PROSE = 'Password must contain an uppercase letter';
    const operationMocks: MockedResponse[] = [
      {
        request: {
          query: ChangePasswordDocument,
          variables: () => true,
        },
        result: {
          data: {
            changePassword: {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              message: SERVER_PROSE,
              field: 'newPassword',
            },
          },
        },
      },
    ];

    const user = userEvent.setup();
    renderWithApollo(<ChangePasswordScreen />, { operationMocks });

    await user.type(
      screen.getByTestId('password-input-Enter your current password'),
      'OldPass1',
    );
    await user.type(
      screen.getByTestId('password-input-Enter your new password'),
      'NewPass1',
    );
    await user.type(
      screen.getByTestId('password-input-Confirm your new password'),
      'NewPass1',
    );
    await user.press(screen.getByRole('button', { name: 'Change Password' }));

    // The mocked PasswordInput surfaces its errorMessage as the a11y hint.
    await waitFor(() =>
      expect(
        screen.getByTestId('password-input-Enter your new password').props
          .accessibilityHint,
      ).toBe(
        'That password doesn’t meet the rules: 8–72 characters, with an uppercase letter, a lowercase letter and a number.',
      ),
    );

    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: SERVER_PROSE }),
    );
  });

  it('renders password input placeholders', () => {
    renderWithApollo(<ChangePasswordScreen />);
    expect(
      screen.getByPlaceholderText('Enter your current password'),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your new password')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Confirm your new password'),
    ).toBeTruthy();
  });
});
