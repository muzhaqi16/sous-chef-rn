import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { AuthFormTemplate } from '../AuthFormTemplate';
import type { FieldDef } from '#components/molecules/DynamicFormFields';

type AuthFormValues = { email: string; password: string };

jest.mock('#components/molecules/DynamicFormFields', () => {
  const { View, Text } = require('react-native');
  return {
    DynamicFormFields: ({
      fields,
    }: {
      fields: Array<{ name: string; label?: string }>;
    }) => (
      <View testID="dynamic-form-fields">
        {fields.map(f => (
          <Text key={f.name}>{f.label || f.name}</Text>
        ))}
      </View>
    ),
  };
});

jest.mock('#components/molecules/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      title,
      onPress,
      disabled,
      testID,
    }: {
      title?: string;
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
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

// Helper wrapper to provide react-hook-form control
interface WrapperProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string | React.ReactNode;
  footerText?: string;
  footerLinkText?: string;
  footerLinkTestID?: string;
  onFooterLinkPress?: () => void;
  onLinkPress?: () => void;
  linkText?: string;
  linkTestID?: string;
}

function Wrapper({ children: _children, ...overrides }: WrapperProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<AuthFormValues>({
    defaultValues: { email: '', password: '' },
  });

  const fields: FieldDef<AuthFormValues>[] = [
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

  it('carries no back control — the screen header owns it', () => {
    render(<Wrapper />);
    expect(screen.queryByLabelText('Go Back')).toBeNull();
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
