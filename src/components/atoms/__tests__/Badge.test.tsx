import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('has accessibility role "text"', () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByRole('text')).toBeTruthy();
  });

  it('sets accessibilityLabel for string children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByLabelText('Active')).toBeTruthy();
  });

  it('renders with default variant', () => {
    const { toJSON } = render(<Badge>Default</Badge>);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with primary variant', () => {
    const { toJSON } = render(<Badge variant="primary">Primary</Badge>);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with success variant', () => {
    const { toJSON } = render(<Badge variant="success">Success</Badge>);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with warning variant', () => {
    const { toJSON } = render(<Badge variant="warning">Warning</Badge>);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with danger variant', () => {
    const { toJSON } = render(<Badge variant="danger">Danger</Badge>);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with medium size', () => {
    const { toJSON } = render(<Badge size="medium">Medium</Badge>);
    expect(toJSON()).toBeTruthy();
  });
});
