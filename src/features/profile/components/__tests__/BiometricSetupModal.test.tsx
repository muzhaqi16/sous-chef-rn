'use no memo';
import React from 'react';
import { Platform, TextInput } from 'react-native';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { BiometricSetupModal } from '#features/profile/components/BiometricSetupModal';

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/services/authService', () => ({
  authService: {
    getBiometricInfo: jest.fn(),
    enrolDeviceCredential: jest.fn(),
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
    enrolDeviceCredential: jest.Mock;
    loadStoredCredentials: jest.Mock;
    checkStoredCredentials: jest.Mock;
  };
};
const mockGetBiometricInfo = mockAuthService.getBiometricInfo;
const mockEnrol = mockAuthService.enrolDeviceCredential;
const mockCheckStoredCredentials = mockAuthService.checkStoredCredentials;

jest.mock('#/utils/finallyHelpers', () => ({
  executeMutation: async <T,>(
    fn: () => Promise<T>,
    onError?: string | ((error: unknown) => void | Promise<void>),
  ) => {
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
  mode: 'onboarding' | 'settings';
} = {
  visible: true,
  onComplete: jest.fn(),
  userEmail: 'test@example.com',
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
    mockEnrol.mockResolvedValue(true);
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
    const user = userEvent.setup();
    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Set up later')).toBeTruthy();
    });

    await user.press(screen.getByText('Set up later'));
    expect(defaultProps.onComplete).toHaveBeenCalledWith(false);
  });

  it('calls onComplete(true) when Enable Now succeeds', async () => {
    const user = userEvent.setup();
    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Enable Now')).toBeTruthy();
    });

    await user.press(screen.getByText('Enable Now'));

    await waitFor(() => {
      // The live session authorises the enrolment, so the email is the whole
      // input and no password is read on this path.
      expect(mockEnrol).toHaveBeenCalledWith('test@example.com');
      expect(defaultProps.onComplete).toHaveBeenCalledWith(true);
    });
  });

  // A field that gates on non-empty and is then discarded reads as a security
  // step and is not one, so the card carries no text input of any kind. Settings
  // mode with nothing stored is the case that asked for a current password.
  it.each(['onboarding', 'settings'] as const)(
    'renders no text input in %s mode',
    async mode => {
      mockCheckStoredCredentials.mockResolvedValue(false);
      render(<BiometricSetupModal {...defaultProps} mode={mode} />);

      await waitFor(() => {
        expect(screen.getByText('Enable Now')).toBeTruthy();
      });
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    },
  );

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

  // Android's `getSupportedBiometryType` answers with the first SENSOR it finds,
  // so a phone carrying both readers says "Fingerprint" for a face unlock. The
  // prompt takes any strong biometric, and the copy has to say so.
  it('names no modality on Android, where the type is a guess', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: true,
      biometryType: 'Fingerprint',
    });

    render(<BiometricSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Enable Biometric Login')).toBeTruthy();
    });
    expect(screen.queryByText('Enable Fingerprint Login')).toBeNull();
  });
});
