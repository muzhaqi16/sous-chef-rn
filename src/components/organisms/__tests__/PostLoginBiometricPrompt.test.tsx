'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PostLoginBiometricPrompt } from '../PostLoginBiometricPrompt';

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({
    getBiometricInfo: jest.fn(() => Promise.resolve({ isAvailable: true, biometryType: 'Face ID' })),
    storeCredentials: jest.fn(() => Promise.resolve(true)),
  })),
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: (fn: () => Promise<void>, setLoading: (v: boolean) => void, onError: (e: unknown) => void) => {
    setLoading(true);
    fn().then(() => setLoading(false)).catch((e: unknown) => { setLoading(false); onError(e); });
  },
}));

describe('PostLoginBiometricPrompt', () => {
  const defaultProps = {
    visible: true,
    onComplete: jest.fn(),
    userEmail: 'test@example.com',
    userPassword: 'password123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the prompt when visible', () => {
    render(<PostLoginBiometricPrompt {...defaultProps} />);
    expect(screen.getByTestId('post-login-biometric-prompt')).toBeTruthy();
  });

  it('renders Enable Now button', () => {
    render(<PostLoginBiometricPrompt {...defaultProps} />);
    expect(screen.getByText('Enable Now')).toBeTruthy();
  });

  it('renders Not now button', () => {
    render(<PostLoginBiometricPrompt {...defaultProps} />);
    expect(screen.getByText('Not now')).toBeTruthy();
  });

  it('calls onComplete with false and declined when Not now is pressed', () => {
    render(<PostLoginBiometricPrompt {...defaultProps} />);
    fireEvent.press(screen.getByText('Not now'));
    expect(defaultProps.onComplete).toHaveBeenCalledWith(false, true);
  });

  it('renders biometric title', () => {
    render(<PostLoginBiometricPrompt {...defaultProps} />);
    expect(screen.getByText(/Set up.*Login/)).toBeTruthy();
  });

  it('renders description text', () => {
    render(<PostLoginBiometricPrompt {...defaultProps} />);
    expect(screen.getByText(/faster, more secure login/)).toBeTruthy();
  });
});
