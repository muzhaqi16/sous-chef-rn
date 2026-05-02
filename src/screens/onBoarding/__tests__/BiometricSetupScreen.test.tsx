'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BiometricSetupScreen } from '../BiometricSetupScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockNavigateToNextStep = jest.fn();
jest.mock('#hooks/navigation/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
  }),
}));

const mockClearRegistrationPassword = jest.fn();
jest.mock('#store/useAppStore', () => {
  const mockState = {
    user: { id: 'u1', email: 'test@test.com' },
    setUserNavigationState: jest.fn(),
    registrationPassword: 'password123',
    clearRegistrationPassword: mockClearRegistrationPassword,
  };
  const fn = jest.fn((selector: any) => selector(mockState));
  (fn as any).getState = jest.fn(() => ({}));
  (fn as any).setState = jest.fn();
  (fn as any).subscribe = jest.fn();
  return { useAppStore: fn, useUser: jest.fn(() => mockState.user) };
});

let mockBiometricInfo = { isAvailable: true, biometryType: 'Face ID' };

jest.mock('#/services/authService', () => ({
  authService: {
    getBiometricInfo: jest.fn(() => Promise.resolve(mockBiometricInfo)),
    storeCredentials: jest.fn(() => Promise.resolve(true)),
  },
}));

jest.mock('#hooks/navigation/useUserPreferences', () => ({
  useUserPreferences: () => ({
    markBiometricDeclined: jest.fn(),
    markBiometricEnabled: jest.fn(),
  }),
}));

jest.mock('#components/organisms/modal/useTextInputModal', () => ({
  useTextInputModal: () => ({
    show: jest.fn(),
    TextModalComponent: null,
  }),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#/storage/keychain', () => ({
  loadTempRegistrationPassword: jest.fn(() => Promise.resolve(null)),
  clearTempRegistrationPassword: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/templates/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({ title, subtitle, children, testID }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID || 'onboarding-wrapper'}>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {children}
      </View>
    );
  },
}));

describe('BiometricSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBiometricInfo = { isAvailable: true, biometryType: 'Face ID' };
    // Restore mocks after clearAllMocks
    const storeModule = require('#store/useAppStore');
    const mockState = {
      user: { id: 'u1', email: 'test@test.com' },
      setUserNavigationState: jest.fn(),
      registrationPassword: 'password123',
      clearRegistrationPassword: mockClearRegistrationPassword,
    };
    storeModule.useAppStore.mockImplementation((selector: any) =>
      selector(mockState),
    );
    storeModule.useUser.mockReturnValue(mockState.user);
  });

  it('renders biometric setup screen when available', async () => {
    render(<BiometricSetupScreen />);

    // Initially shows checking state, then resolves
    // After microtask, shows setup screen
    await screen.findByTestId('biometric-setup-screen');
    expect(screen.getByText('Enable Face ID Login')).toBeTruthy();
  });

  it('shows enable button', async () => {
    render(<BiometricSetupScreen />);
    await screen.findByTestId('biometric-setup-enable');
    expect(screen.getByText('Enable Now')).toBeTruthy();
  });

  it('shows skip button', async () => {
    render(<BiometricSetupScreen />);
    await screen.findByTestId('biometric-setup-skip');
    expect(screen.getByText('Set up later')).toBeTruthy();
  });

  it('shows benefit items', async () => {
    render(<BiometricSetupScreen />);
    await screen.findByText('Quick and secure access');
    expect(screen.getByText('No password required')).toBeTruthy();
    expect(screen.getByText('Enhanced security')).toBeTruthy();
  });

  it('shows footer text', async () => {
    render(<BiometricSetupScreen />);
    await screen.findByText('You can always enable this later in Settings');
  });

  it('auto-skips when biometric not available', async () => {
    mockBiometricInfo = { isAvailable: false, biometryType: null as any };
    render(<BiometricSetupScreen />);

    // Should auto-navigate to next step
    await new Promise(r => setTimeout(r, 50));
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('BiometricSetup');
  });
});
