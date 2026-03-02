import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Label } from '../Label';

describe('Label', () => {
  it('renders children text', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toBeTruthy();
  });

  it('renders required indicator when required is true', () => {
    render(<Label required>Email</Label>);
    expect(screen.getByText(' *')).toBeTruthy();
  });

  it('does not render required indicator by default', () => {
    render(<Label>Optional</Label>);
    expect(screen.queryByText(' *')).toBeNull();
  });

  it('renders with different sizes', () => {
    const { toJSON: sm } = render(<Label size="sm">Small</Label>);
    const { toJSON: lg } = render(<Label size="lg">Large</Label>);
    expect(sm()).toBeTruthy();
    expect(lg()).toBeTruthy();
  });

  it('renders with different weights', () => {
    const { toJSON: reg } = render(<Label weight="regular">Regular</Label>);
    const { toJSON: semi } = render(<Label weight="semibold">Semibold</Label>);
    expect(reg()).toBeTruthy();
    expect(semi()).toBeTruthy();
  });
});
