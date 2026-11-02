'use no memo';
import React from 'react';
import { Platform, TextInput } from 'react-native';
import { Modal } from '#components/atoms/themedComponents';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { BiometricSetupModal } from '#features/profile/components/BiometricSetupModal';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { drained, drainTimers } from '#/test-utils/drainTimers';

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

jest.mock('#/services/biometric/deviceCredential', () => ({
  biometricService: {
    getBiometricInfo: jest.fn(),
    enrolDeviceCredential: jest.fn(),
    loadStoredCredentials: jest.fn(),
    checkStoredCredentials: jest.fn(),
  },
}));

// Get references to mock functions after the module mock is created
const { biometricService: mockBiometricService } = jest.requireMock(
  '#/services/biometric/deviceCredential',
);
const mockGetBiometricInfo = mockBiometricService.getBiometricInfo;
const mockEnrol = mockBiometricService.enrolDeviceCredential;
const mockCheckStoredCredentials = mockBiometricService.checkStoredCredentials;
const mockLoadStoredCredentials = mockBiometricService.loadStoredCredentials;

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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('BiometricSetupModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: true,
      biometryType: 'Face ID',
    });
    mockCheckStoredCredentials.mockResolvedValue(false);
    mockEnrol.mockResolvedValue('enrolled');
  });

  it('renders null when biometric is not available', async () => {
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: false,
      biometryType: null,
    });

    render(<BiometricSetupModal {...defaultProps} />);

    await drainTimers();
    expect(defaultProps.onComplete).toHaveBeenCalledWith(false);
  });

  it('renders the title with Face ID when biometryType is Face ID', async () => {
    render(<BiometricSetupModal {...defaultProps} />);

    await drainTimers();
    expect(screen.getByText('Enable Face ID Login')).toBeTruthy();
  });

  it('renders the description for Face ID', async () => {
    render(<BiometricSetupModal {...defaultProps} />);

    await drainTimers();
    expect(
      screen.getByText(
        /Use Face ID to securely and quickly log into your account/,
      ),
    ).toBeTruthy();
  });

  it('renders Enable Now and Set up later buttons', async () => {
    render(<BiometricSetupModal {...defaultProps} />);

    await drainTimers();
    expect(screen.getByText('Enable Now')).toBeTruthy();
    expect(screen.getByText('Set up later')).toBeTruthy();
  });

  it('calls onComplete(false) when Set up later is pressed', async () => {
    const user = userEvent.setup();
    render(<BiometricSetupModal {...defaultProps} />);

    await drainTimers();
    expect(screen.getByText('Set up later')).toBeTruthy();

    await user.press(screen.getByText('Set up later'));
    expect(defaultProps.onComplete).toHaveBeenCalledWith(false);
  });

  it('calls onComplete(true) when Enable Now succeeds', async () => {
    const user = userEvent.setup();
    render(<BiometricSetupModal {...defaultProps} />);

    await drainTimers();
    expect(screen.getByText('Enable Now')).toBeTruthy();

    await user.press(screen.getByText('Enable Now'));

    await drainTimers();
    expect(mockEnrol).toHaveBeenCalledWith('test@example.com');
    expect(defaultProps.onComplete).toHaveBeenCalledWith(true);
  });

  describe('in settings, with a sign-in already stored', () => {
    const enableWithSlot = async () => {
      mockCheckStoredCredentials.mockResolvedValue(true);
      const user = userEvent.setup();
      render(<BiometricSetupModal {...defaultProps} mode="settings" />);
      await drainTimers();
      expect(screen.getByText('Enable Now')).toBeTruthy();
      await user.press(screen.getByText('Enable Now'));
    };

    it('turns it on once the prompt unlocks the slot', async () => {
      mockLoadStoredCredentials.mockResolvedValue({
        status: 'read',
        email: 'test@example.com',
        credential: 'dc1:secret',
      });
      await enableWithSlot();

      await drainTimers();
      expect(defaultProps.onComplete).toHaveBeenCalledWith(true);
      expect(mockEnrol).not.toHaveBeenCalled();
    });

    // Dismissing the prompt is the person's answer, not a failure to explain.
    it('leaves it off without an alert when the prompt is dismissed', async () => {
      mockLoadStoredCredentials.mockResolvedValue({ status: 'cancelled' });
      await enableWithSlot();

      await drainTimers();
      expect(defaultProps.onComplete).toHaveBeenCalledWith(false);
      expect(alertService.alert).not.toHaveBeenCalled();
    });

    it('explains when the slot cannot be read', async () => {
      mockLoadStoredCredentials.mockResolvedValue({ status: 'unavailable' });
      await enableWithSlot();

      await drainTimers();
      expect(alertService.alert).toHaveBeenCalled();
      expect(defaultProps.onComplete).not.toHaveBeenCalled();
    });
  });

  // Back is the one dismissal the disabled Skip button does not cover: taken
  // mid-enrolment it completed false, then the enrolment completed true.
  it('ignores Android back while enrolment runs', async () => {
    let finishEnrolment: (outcome: string) => void = () => {};
    mockEnrol.mockReturnValue(
      new Promise<string>(resolve => {
        finishEnrolment = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<BiometricSetupModal {...defaultProps} mode="settings" />);

    await drainTimers();
    await user.press(screen.getByText('Enable Now'));
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    expect(defaultProps.onComplete).not.toHaveBeenCalled();

    await drained(() => finishEnrolment('enrolled'));
    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onComplete).toHaveBeenCalledWith(true);
  });

  it('takes Android back as a skip once nothing is running', async () => {
    render(<BiometricSetupModal {...defaultProps} mode="settings" />);

    await drainTimers();
    expect(screen.getByText('Enable Now')).toBeTruthy();
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');

    expect(defaultProps.onComplete).toHaveBeenCalledWith(false);
  });

  // The enrolment reports nothing itself, so this alert is the only message.
  it('says setup failed exactly once when the credential cannot be saved', async () => {
    mockEnrol.mockResolvedValue('unsaved');
    const user = userEvent.setup();
    render(<BiometricSetupModal {...defaultProps} mode="settings" />);

    await drainTimers();
    await user.press(screen.getByText('Enable Now'));

    await drainTimers();
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(toastService.error).not.toHaveBeenCalled();
  });

  // A field that gates on non-empty and is then discarded reads as a security
  // step and is not one, so the card carries no text input of any kind. Settings
  // mode with nothing stored is the case that asked for a current password.
  it.each(['onboarding', 'settings'] as const)(
    'renders no text input in %s mode',
    async mode => {
      mockCheckStoredCredentials.mockResolvedValue(false);
      render(<BiometricSetupModal {...defaultProps} mode={mode} />);

      await drainTimers();
      expect(screen.getByText('Enable Now')).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    },
  );

  it('renders Touch ID title when biometryType is Touch ID', async () => {
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: true,
      biometryType: 'Touch ID',
    });

    render(<BiometricSetupModal {...defaultProps} />);

    await drainTimers();
    expect(screen.getByText('Enable Touch ID Login')).toBeTruthy();
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

    await drainTimers();
    expect(screen.getByText('Enable Biometric Login')).toBeTruthy();
    expect(screen.queryByText('Enable Fingerprint Login')).toBeNull();
  });
});
