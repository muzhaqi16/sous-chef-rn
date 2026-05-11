import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { AuthFormTemplate } from '../AuthFormTemplate';

jest.mock('../../molecules/DynamicFormFields', () => {
  const { View, Text } = require('react-native');
  return {
    DynamicFormFields: ({ fields }: any) => (
      <View testID="dynamic-form-fields">
        {fields.map((f: any) => (
          <Text key={f.name}>{f.label || f.name}</Text>
        ))}
      </View>
    ),
  };
});

jest.mock('../../base/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ title, onPress, disabled, testID }: any) => (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        testID={testID}
        accessibilityRole="button"
      >
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});

jest.mock('../../atoms/BackButton', () => {
  const { Pressable, Text } = require('react-native');
  return {
    BackButton: ({ onPress }: any) => (
      <Pressable onPress={onPress} testID="back-button">
        <Text>Back</Text>
      </Pressable>
    ),
  };
});

// Helper wrapper to provide react-hook-form control
function Wrapper({ children: _children, ...overrides }: any) {
  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm({
    defaultValues: { email: '', password: '' },
  });

  const fields = [
    { name: 'email', label: 'Email', placeholder: 'Enter email' },
    { name: 'password', label: 'Password', placeholder: 'Enter password' },
  ];

  return (
    <AuthFormTemplate
      title="Sign In"
      fields={fields}
      control={control}
      errors={errors}
      submitText="Log In"
      onSubmit={handleSubmit(() => {})}
      {...overrides}
    />
  );
}

describe('AuthFormTemplate', () => {
  it('renders the title', () => {
    render(<Wrapper />);
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<Wrapper subtitle="Welcome back" />);
    expect(screen.getByText('Welcome back')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<Wrapper />);
    expect(screen.queryByText('Welcome back')).toBeNull();
  });

  it('renders submit button with correct text', () => {
    render(<Wrapper />);
    expect(screen.getByText('Log In')).toBeTruthy();
  });

  it('renders form fields', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('dynamic-form-fields')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
  });

  it('renders back button when onBackPress is provided', async () => {
    const user = userEvent.setup();
    const onBackPress = jest.fn();
    render(<Wrapper onBackPress={onBackPress} />);
    expect(screen.getByTestId('back-button')).toBeTruthy();
    await user.press(screen.getByTestId('back-button'));
    expect(onBackPress).toHaveBeenCalledTimes(1);
  });

  it('does not render back button when onBackPress is not provided', () => {
    render(<Wrapper />);
    expect(screen.queryByTestId('back-button')).toBeNull();
  });

  it('renders footer link when all footer props provided', () => {
    const onFooterLinkPress = jest.fn();
    render(
      <Wrapper
        footerText="Don't have an account?"
        footerLinkText="Sign Up"
        onFooterLinkPress={onFooterLinkPress}
        footerLinkTestID="footer-link"
      />,
    );
    expect(screen.getByText(/Don't have an account/)).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('renders link when linkText and onLinkPress provided', async () => {
    const user = userEvent.setup();
    const onLinkPress = jest.fn();
    render(
      <Wrapper
        linkText="Forgot Password?"
        onLinkPress={onLinkPress}
        linkTestID="link"
      />,
    );
    expect(screen.getByText('Forgot Password?')).toBeTruthy();
    await user.press(screen.getByTestId('link'));
    expect(onLinkPress).toHaveBeenCalledTimes(1);
  });
});