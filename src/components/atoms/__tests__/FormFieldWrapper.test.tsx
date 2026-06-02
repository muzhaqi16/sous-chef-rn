import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FormFieldWrapper } from '../FormFieldWrapper';
import { Text } from '#components/atoms/Text';

describe('FormFieldWrapper', () => {
  it('renders the label text', () => {
    render(
      <FormFieldWrapper label="Email">
        <Text>input</Text>
      </FormFieldWrapper>,
    );
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('renders children', () => {
    render(
      <FormFieldWrapper label="Name">
        <Text>Child content</Text>
      </FormFieldWrapper>,
    );
    expect(screen.getByText('Child content')).toBeTruthy();
  });

  it('renders required indicator when required', () => {
    render(
      <FormFieldWrapper label="Password" required>
        <Text>input</Text>
      </FormFieldWrapper>,
    );
    expect(screen.getByText(' *')).toBeTruthy();
  });

  it('does not render required indicator by default', () => {
    render(
      <FormFieldWrapper label="Optional">
        <Text>input</Text>
      </FormFieldWrapper>,
    );
    expect(screen.queryByText(' *')).toBeNull();
  });

  it('renders error message when error prop is provided', () => {
    render(
      <FormFieldWrapper label="Email" error="Invalid email">
        <Text>input</Text>
      </FormFieldWrapper>,
    );
    expect(screen.getByText('Invalid email')).toBeTruthy();
  });

  it('does not render error message when no error', () => {
    render(
      <FormFieldWrapper label="Email">
        <Text>input</Text>
      </FormFieldWrapper>,
    );
    expect(screen.queryByText('Invalid email')).toBeNull();
  });

  it('uses label as default accessibility label', () => {
    render(
      <FormFieldWrapper label="Username">
        <Text>input</Text>
      </FormFieldWrapper>,
    );
    expect(screen.getByLabelText('Username')).toBeTruthy();
  });

  it('uses custom accessibility label when provided', () => {
    render(
      <FormFieldWrapper label="Email" accessibilityLabel="Email address field">
        <Text>input</Text>
      </FormFieldWrapper>,
    );
    expect(screen.getByLabelText('Email address field')).toBeTruthy();
  });
});
