'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ChangePasswordScreen } from '../ChangePasswordScreen';

// --- Mocks ---

const mockChangePassword = jest.fn().mockResolvedValue({
  data: { changePassword: { success: true } },
});
const mockToast = jest.fn();

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = (
  jest.requireMock('#hooks/navigation/useAppNavigation') as {
    useAppNavigation: jest.Mock;
  }
).useAppNavigation();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useChangePasswordMutation: () => [mockChangePassword],
}));

jest.mock('#hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#utils/validation/auth', () => ({
  changePasswordSchema: {
    __isYupSchema: true,
    validate: jest.fn().mockResolvedValue({}),
    validateSync: jest.fn(),
    cast: jest.fn((v: any) => v),
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
    Header: ({ title, onBack }: any) => (
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
    PasswordInput: ({ value, onChangeText, placeholder }: any) => (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        testID={`password-input-${placeholder}`}
      />
    ),
  };
});

describe('ChangePasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with title', () => {
    render(<ChangePasswordScreen />);
    expect(screen.getByTestId('header')).toBeTruthy();
    // Both header and button contain "Change Password" text
    expect(
      screen.getAllByText('Change Password').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders the description text', () => {
    render(<ChangePasswordScreen />);
    expect(
      screen.getByText(
        /Enter your current password and choose a new secure password/,
      ),
    ).toBeTruthy();
  });

  it('renders Current Password field', () => {
    render(<ChangePasswordScreen />);
    expect(screen.getByText('Current Password')).toBeTruthy();
  });

  it('renders New Password field', () => {
    render(<ChangePasswordScreen />);
    expect(screen.getByText('New Password')).toBeTruthy();
  });

  it('renders Confirm New Password field', () => {
    render(<ChangePasswordScreen />);
    expect(screen.getByText('Confirm New Password')).toBeTruthy();
  });

  it('renders the submit button text', () => {
    render(<ChangePasswordScreen />);
    // "Change Password" appears in both header title and submit button
    const elements = screen.getAllByText('Change Password');
    expect(elements.length).toBe(2);
  });

  it('calls goBack when header back button is pressed', () => {
    render(<ChangePasswordScreen />);
    fireEvent.press(screen.getByTestId('header-back'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('renders password input placeholders', () => {
    render(<ChangePasswordScreen />);
    expect(
      screen.getByPlaceholderText('Enter your current password'),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your new password')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Confirm your new password'),
    ).toBeTruthy();
  });
});
