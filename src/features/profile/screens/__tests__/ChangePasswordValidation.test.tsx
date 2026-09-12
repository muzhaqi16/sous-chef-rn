'use no memo';
import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import type { PasswordInputProps } from '#components/molecules/PasswordInput';
import { ChangePasswordScreen } from '../ChangePasswordScreen';

/**
 * The cross-field rules run for real here — the sibling suite mocks the schema
 * and the resolver, which is what let a rule reporting on ANOTHER field go
 * unnoticed. react-hook-form writes back only the changed field's error, and
 * Submit is gated on whole-schema `isValid`, so a message left un-run disables
 * the button with nothing on screen.
 */

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#/utils/finallyHelpers');

jest.mock('#services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/molecules/PasswordInput', () => {
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

const CURRENT = 'password-input-Enter your current password';
const NEW = 'password-input-Enter your new password';
const CONFIRM = 'password-input-Confirm your new password';

const confirmError = () =>
  screen.getByTestId(CONFIRM).props.accessibilityHint as string | undefined;

describe('ChangePasswordScreen — cross-field rules', () => {
  it('clears the mismatch once the new password is edited to match', async () => {
    const user = userEvent.setup();
    renderWithApollo(<ChangePasswordScreen />, { operationMocks: [] });

    await user.type(screen.getByTestId(CURRENT), 'OldPass123');
    await user.type(screen.getByTestId(NEW), 'NewPass123');
    await user.type(screen.getByTestId(CONFIRM), 'NewPass1234');

    await waitFor(() => expect(confirmError()).toBe('Passwords must match'));

    // The fix belongs to the OTHER field: the rule reports on the confirmation
    // while reading the new password.
    await user.clear(screen.getByTestId(NEW));
    await user.type(screen.getByTestId(NEW), 'NewPass1234');

    await waitFor(() => expect(confirmError()).toBeUndefined());
  });

  it('raises the mismatch when the new password is edited away from it', async () => {
    const user = userEvent.setup();
    renderWithApollo(<ChangePasswordScreen />, { operationMocks: [] });

    await user.type(screen.getByTestId(CURRENT), 'OldPass123');
    await user.type(screen.getByTestId(NEW), 'NewPass123');
    await user.type(screen.getByTestId(CONFIRM), 'NewPass123');
    await waitFor(() => expect(confirmError()).toBeUndefined());

    await user.type(screen.getByTestId(NEW), '4');

    await waitFor(() => expect(confirmError()).toBe('Passwords must match'));
  });
});
