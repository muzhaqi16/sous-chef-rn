import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  LoadingOverlay,
  AuthLoadingOverlay,
  NavigationLoadingOverlay,
  BiometricLoadingOverlay,
} from '../LoadingOverlay';

describe('LoadingOverlay', () => {
  it('renders nothing when not visible', () => {
    const { toJSON } = render(<LoadingOverlay visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('renders modal when visible', () => {
    const { toJSON } = render(<LoadingOverlay visible={true} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders message text when provided', () => {
    render(<LoadingOverlay visible={true} message="Saving..." />);
    expect(screen.getByText('Saving...')).toBeTruthy();
  });

  it('does not render message when not provided', () => {
    render(<LoadingOverlay visible={true} />);
    expect(screen.queryByText('Saving...')).toBeNull();
  });
});

describe('AuthLoadingOverlay', () => {
  it('renders "Authenticating..." message when visible', () => {
    render(<AuthLoadingOverlay visible={true} />);
    expect(screen.getByText('Authenticating...')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    const { toJSON } = render(<AuthLoadingOverlay visible={false} />);
    expect(toJSON()).toBeNull();
  });
});

describe('NavigationLoadingOverlay', () => {
  it('renders "Loading..." message when visible', () => {
    render(<NavigationLoadingOverlay visible={true} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});

describe('BiometricLoadingOverlay', () => {
  it('renders waiting message when visible', () => {
    render(<BiometricLoadingOverlay visible={true} />);
    expect(screen.getByText('Waiting for authentication...')).toBeTruthy();
  });
});
