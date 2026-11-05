import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { EmailInput } from '#components/molecules/EmailInput';
import {
  PasswordInput,
  type PasswordInputProps,
} from '#components/molecules/PasswordInput';

const PURPOSES: [PasswordInputProps['purpose'], string, string][] = [
  ['current', 'current-password', 'password'],
  ['new', 'new-password', 'newPassword'],
];

describe('a labelled text field', () => {
  it('is named by its visible label, not its placeholder', () => {
    render(
      <BaseInput
        label="Email address"
        placeholder="e.g. john@example.com"
        testID="field"
      />,
    );

    expect(screen.getByTestId('field').props.accessibilityLabel).toBe(
      'Email address',
    );
  });

  it('announces the error it shows, and the one its form shows', () => {
    render(
      <>
        <BaseInput label="Email" errorMessage="Enter an email" testID="own" />
        <BaseInput label="Email" error="Enter an email" testID="form" />
      </>,
    );
    const hint = t('a11y.fieldError', { error: 'Enter an email' });

    expect(screen.getByTestId('own').props.accessibilityHint).toBe(hint);
    expect(screen.getByTestId('form').props.accessibilityHint).toBe(hint);
  });

  it("keeps a caller's own name for the field", () => {
    render(
      <BaseInput
        label="Email"
        accessibilityLabel="Work email"
        testID="field"
      />,
    );

    expect(screen.getByTestId('field').props.accessibilityLabel).toBe(
      'Work email',
    );
  });
});

describe('autofill', () => {
  it('offers saved emails on an email field', () => {
    render(<EmailInput testID="email" />);
    const input = screen.getByTestId('email');

    expect(input.props.autoComplete).toBe('email');
    expect(input.props.textContentType).toBe('emailAddress');
  });

  it.each(PURPOSES)(
    'asks for the %s password',
    (purpose, autoComplete, textContentType) => {
      render(<PasswordInput purpose={purpose} testID="password" />);
      const input = screen.getByTestId('password');

      expect(input.props.autoComplete).toBe(autoComplete);
      expect(input.props.textContentType).toBe(textContentType);
    },
  );
});
