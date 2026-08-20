'use no memo';

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { BarcodeScannerScreen } from '../BarcodeScannerScreen';
import type { BarcodeSource } from '#/types/navigation';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

const mockRequestPermission = jest.fn();
const mockOpenSettings = jest.fn();
jest.mock('#hooks/permissions/usePermission', () => ({
  usePermission: jest.fn(() => ({
    isGranted: false,
    isBlocked: false,
    request: mockRequestPermission,
    openSettings: mockOpenSettings,
  })),
}));

jest.mock('../../hooks/useBarcodeScanner', () => ({
  useBarcodeScanner: jest.fn(() => ({
    setScannedBarcode: jest.fn(),
    setScanning: jest.fn(),
    resetScanner: jest.fn(),
    isScanning: false,
  })),
}));

interface CapturedCameraProps {
  torchMode?: 'on' | 'off';
  onStarted?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
}

// Captured so the torch tests can assert what the screen commands, and drive
// the session's started/stopped events the way the native camera would.
let mockCameraProps: CapturedCameraProps = {};

jest.mock('react-native-vision-camera', () => ({
  Camera: (props: CapturedCameraProps) => {
    mockCameraProps = props;
    return null;
  },
  useCameraDevices: jest.fn(() => []),
}));

// The screen reads from our platform-shimmed hook, not the underlying
// vision-camera packages, so mocking this single module is enough.
jest.mock('../../hooks/useBarcodeOutput', () => ({
  useBarcodeOutput: jest.fn(() => ({})),
}));

jest.mock('#components/organisms/BarcodeMask', () => 'BarcodeMask');

jest.mock('#components/base/Button', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
  }) => {
    const { Text, Pressable } = require('react-native');
    return (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    );
  },
}));

jest.mock('#components/atoms/IconButton', () => ({
  IconButton: ({
    name,
    onPress,
    accessibilityLabel,
  }: {
    name?: string;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) => {
    const { Text, Pressable } = require('react-native');
    return (
      <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress}>
        <Text>{name}</Text>
      </Pressable>
    );
  },
}));

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: { success: jest.fn() },
}));

// Override useFocusEffect to avoid infinite re-render loop in tests
// The global mock calls callback on every render; useEffect-style is needed here
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: jest.fn(),
  };
});

const source: BarcodeSource = 'pantry';
const defaultRoute = { params: { source, pantryId: 'p-1' } };

describe('BarcodeScannerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows permission request when camera not granted', () => {
    const { getByText } = render(<BarcodeScannerScreen route={defaultRoute} />);
    expect(
      getByText('Camera access is required to scan barcodes.'),
    ).toBeTruthy();
    expect(getByText('Grant Permission')).toBeTruthy();
  });

  it('shows Open Settings when permission is blocked', () => {
    const { usePermission } = jest.requireMock(
      '#hooks/permissions/usePermission',
    );
    usePermission.mockReturnValue({
      isGranted: false,
      isBlocked: true,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const { getByText } = render(<BarcodeScannerScreen route={defaultRoute} />);
    expect(getByText('Open Settings')).toBeTruthy();
  });

  it('shows no camera device message when no device found', () => {
    const { usePermission } = jest.requireMock(
      '#hooks/permissions/usePermission',
    );
    usePermission.mockReturnValue({
      isGranted: true,
      isBlocked: false,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const { useCameraDevices } = jest.requireMock('react-native-vision-camera');
    useCameraDevices.mockReturnValue([]);

    const { getByText } = render(<BarcodeScannerScreen route={defaultRoute} />);
    expect(getByText('No camera device found')).toBeTruthy();
  });

  it('renders camera scanner when permission granted and device found', () => {
    const { usePermission } = jest.requireMock(
      '#hooks/permissions/usePermission',
    );
    usePermission.mockReturnValue({
      isGranted: true,
      isBlocked: false,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const { useCameraDevices } = jest.requireMock('react-native-vision-camera');
    useCameraDevices.mockReturnValue([{ position: 'back', id: 'back-cam' }]);

    const { getByText } = render(<BarcodeScannerScreen route={defaultRoute} />);
    expect(getByText('Point your camera at a barcode')).toBeTruthy();
  });

  it('shows Cancel button on permission screen', () => {
    const { usePermission } = jest.requireMock(
      '#hooks/permissions/usePermission',
    );
    usePermission.mockReturnValue({
      isGranted: false,
      isBlocked: false,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const { getByText } = render(<BarcodeScannerScreen route={defaultRoute} />);
    expect(getByText('Cancel')).toBeTruthy();
  });

  describe('torch', () => {
    beforeEach(() => {
      mockCameraProps = {};
      const { usePermission } = jest.requireMock(
        '#hooks/permissions/usePermission',
      );
      usePermission.mockReturnValue({
        isGranted: true,
        isBlocked: false,
        request: mockRequestPermission,
        openSettings: mockOpenSettings,
      });

      const { useCameraDevices } = jest.requireMock(
        'react-native-vision-camera',
      );
      useCameraDevices.mockReturnValue([{ position: 'back', id: 'back-cam' }]);
    });

    // A defined torchMode makes VisionCamera call setTorchMode() as soon as the
    // controller exists — before the session has opened — which CameraX rejects
    // with "Camera is not active.".
    it('commands no torch mode before the session starts', () => {
      render(<BarcodeScannerScreen route={defaultRoute} />);

      expect(mockCameraProps.torchMode).toBeUndefined();
    });

    it('defers a flash press made while the session is still starting', () => {
      const { getByLabelText } = render(
        <BarcodeScannerScreen route={defaultRoute} />,
      );

      fireEvent.press(getByLabelText('Turn flash on'));
      expect(mockCameraProps.torchMode).toBeUndefined();

      act(() => {
        mockCameraProps.onStarted?.();
      });
      expect(mockCameraProps.torchMode).toBe('on');
    });

    it('stops commanding the torch once the session stops', () => {
      const { getByLabelText } = render(
        <BarcodeScannerScreen route={defaultRoute} />,
      );

      act(() => {
        mockCameraProps.onStarted?.();
      });
      fireEvent.press(getByLabelText('Turn flash on'));
      expect(mockCameraProps.torchMode).toBe('on');

      act(() => {
        mockCameraProps.onStopped?.();
      });
      expect(mockCameraProps.torchMode).toBeUndefined();
      // Back to the "off" affordance, so the next session starts dark.
      expect(getByLabelText('Turn flash on')).toBeTruthy();
    });
  });

  it('renders with undefined route params', () => {
    const { usePermission } = jest.requireMock(
      '#hooks/permissions/usePermission',
    );
    usePermission.mockReturnValue({
      isGranted: false,
      isBlocked: false,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const tree = render(<BarcodeScannerScreen route={{ params: undefined }} />);
    expect(tree.toJSON()).toBeTruthy();
  });
});
