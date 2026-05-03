'use no memo';
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { BiometricSetupModal } from '../BiometricSetupModal';

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/atoms/PasswordInput', () => ({
  PasswordInput: ({ value, onChangeText, placeholder }: any) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        testID="password-input"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    );
  },
}));

jest.mock('#/services/authService', () => ({
  authService: {
    getBiometricInfo: jest.fn(),
    storeCredentials: jest.fn(),
    loadStoredCredentials: jest.fn(),
    checkStoredCredentials: jest.fn(),
  },
}));

// Get references to mock functions after the module mock is created
const { authService: mockAuthService } = jest.requireMock(
  '#/services/authService',
) as {
  authService: {
    getBiometricInfo: jest.Mock;
    storeCredentials: jest.Mock;
    loadStoredCredentials: jest.Mock;
    checkStoredCredentials: jest.Mock;
  };
};
const mockGetBiometricInfo = mockAuthService.getBiometricInfo;
const mockStoreCredentials = mockAuthService.storeCredentials;
const mockCheckStoredCredentials = mockAuthService.checkStoredCredentials;

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutation: async (fn: () => Promise<any>, onError?: any) => {
    try {
      return await fn();
    } catch (error) {
      if (typeof onError === 'function') onError(error);
      return false;
    }
  },
  executeWithLoadingState: async (
    fn: () => Promise<void>,
    setLoading: (v: boolean) => void,
    onError?: (e: unknown) => void,
  ) => {
    setLoading(true);
    try {
      await fn();
    } catch (error) {
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  },
}));

const defaultProps: {
  visible: boolean;
  onComplete: jest.Mock;
  userEmail: string;
  userPassword: string;
  mode: 'onboarding' | 'settings';
} = {
  visible: true,
  onComplete: jest.fn(),
  userEmail: 'test@example.com',
  userPassword: 'password123',
  mode: 'onboarding',
};

describe('BiometricSetupModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: true,
      biometryType: 'Face ID',
    });
    mockCheckStoredCredentials.mockResolvedValue(false);
    mockStoreCredentials.mockResolvedValue(true);
  });

  it('renders null when biometric is not available', async () => {
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: false,
      biometryType: null,
    });

    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalledWith(false);
    });
  });

  it('renders the title with Face ID when biometryType is Face ID', async () => {
    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Enable Face ID Login')).toBeTruthy();
    });
  });

  it('renders the description for Face ID', async () => {
    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Use Face ID to securely and quickly log into your account/,
        ),
      ).toBeTruthy();
    });
  });

  it('renders Enable Now and Set up later buttons', async () => {
    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Enable Now')).toBeTruthy();
      expect(screen.getByText('Set up later')).toBeTruthy();
    });
  });

  it('calls onComplete(false) when Set up later is pressed', async () => {
    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Set up later')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Set up later'));
    expect(defaultProps.onComplete).toHaveBeenCalledWith(false);
  });

  it('calls onComplete(true) when Enable Now succeeds', async () => {
    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Enable Now')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Enable Now'));

    await waitFor(() => {
      expect(mockStoreCredentials).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(defaultProps.onComplete).toHaveBeenCalledWith(true);
    });
  });

  it('does not show password input when userPassword is provided in onboarding mode', async () => {
    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByTestId('password-input')).toBeNull();
    });
  });

  it('shows password input when userPassword is not provided in onboarding mode', async () => {
    render(<BiometricSetupModal {...defaultProps} userPassword={undefined} />);

    await waitFor(() => {
      expect(screen.getByTestId('password-input')).toBeTruthy();
    });
  });

  it('renders Touch ID title when biometryType is Touch ID', async () => {
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: true,
      biometryType: 'Touch ID',
    });

    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Enable Touch ID Login')).toBeTruthy();
    });
  });
});
