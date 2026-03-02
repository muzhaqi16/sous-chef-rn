'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BiometricSetupScreen } from '../BiometricSetupScreen';

jest.mock('#/apollo/links/tokenScheduler', () => ({ tokenScheduler: { schedule: jest.fn(), cancel: jest.fn() } }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));

const mockNavigateToNextStep = jest.fn();
jest.mock('#hooks/navigation/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
  }),
}));

jest.mock('#store/useAppStore', () => {
  const selectUser = (s: any) => s.user;
  const fn = (selector: any) => selector({
    user: { id: 'u1', email: 'test@test.com' },
    setUserNavigationState: jest.fn(),
  });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return { useAppStore: fn, selectUser };
});

let mockBiometricInfo = { isAvailable: true, biometryType: 'Face ID' };

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({
    registrationPassword: 'password123',
    clearRegistrationPassword: jest.fn(),
    getBiometricInfo: jest.fn(() => Promise.resolve(mockBiometricInfo)),
    storeCredentials: jest.fn(() => Promise.resolve(true)),
  }),
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

jest.mock('#hooks/performance/useScreenTransition', () => ({
  useScreenTransition: jest.fn(),
}));

jest.mock('#/storage/keychain', () => ({
  loadTempRegistrationPassword: jest.fn(() => Promise.resolve(null)),
  clearTempRegistrationPassword: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: jest.fn((fn, setLoading, onError) => {
    setLoading(true);
    fn().then(() => setLoading(false)).catch((e: any) => { setLoading(false); if (onError) onError(e); });
  }),
}));

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
