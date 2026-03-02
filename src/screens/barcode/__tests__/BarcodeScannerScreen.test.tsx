'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { BarcodeScannerScreen } from '../BarcodeScannerScreen';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('#/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockGetParent = jest.fn(() => ({
  canGoBack: () => true,
  goBack: jest.fn(),
}));
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    navigation: {
      getParent: mockGetParent,
    },
  })),
}));

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

jest.mock('#hooks/useBarcodeScanner', () => ({
  useBarcodeScanner: jest.fn(() => ({
    setScannedBarcode: jest.fn(),
    setScanning: jest.fn(),
    resetScanner: jest.fn(),
    isScanning: false,
  })),
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevices: jest.fn(() => []),
  useCodeScanner: jest.fn(() => ({})),
}));

jest.mock('#components/organisms/BarcodeMask', () => 'BarcodeMask');

jest.mock('#components/base/Button', () => ({
  Button: ({ children, onPress }: any) => {
    const { Text, Pressable } = require('react-native');
    return (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    );
  },
}));

jest.mock('#components/atoms/IconButton', () => ({
  IconButton: () => null,
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

const defaultRoute = { params: { source: 'pantry' as const, pantryId: 'p-1' } };

describe('BarcodeScannerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows permission request when camera not granted', () => {
    const { getByText } = render(
      <BarcodeScannerScreen route={defaultRoute} />,
    );
    expect(
      getByText('Camera access is required to scan barcodes.'),
    ).toBeTruthy();
    expect(getByText('Grant Permission')).toBeTruthy();
  });

  it('shows Open Settings when permission is blocked', () => {
    const { usePermission } = jest.requireMock('#hooks/permissions/usePermission');
    usePermission.mockReturnValue({
      isGranted: false,
      isBlocked: true,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const { getByText } = render(
      <BarcodeScannerScreen route={defaultRoute} />,
    );
    expect(getByText('Open Settings')).toBeTruthy();
  });

  it('shows no camera device message when no device found', () => {
    const { usePermission } = jest.requireMock('#hooks/permissions/usePermission');
    usePermission.mockReturnValue({
      isGranted: true,
      isBlocked: false,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const { useCameraDevices } = jest.requireMock('react-native-vision-camera');
    useCameraDevices.mockReturnValue([]);

    const { getByText } = render(
      <BarcodeScannerScreen route={defaultRoute} />,
    );
    expect(getByText('No camera device found')).toBeTruthy();
  });

  it('renders camera scanner when permission granted and device found', () => {
    const { usePermission } = jest.requireMock('#hooks/permissions/usePermission');
    usePermission.mockReturnValue({
      isGranted: true,
      isBlocked: false,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const { useCameraDevices } = jest.requireMock('react-native-vision-camera');
    useCameraDevices.mockReturnValue([{ position: 'back', id: 'back-cam' }]);

    const { getByText } = render(
      <BarcodeScannerScreen route={defaultRoute} />,
    );
    expect(getByText('Point your camera at a barcode')).toBeTruthy();
  });

  it('shows Cancel button on permission screen', () => {
    const { usePermission } = jest.requireMock('#hooks/permissions/usePermission');
    usePermission.mockReturnValue({
      isGranted: false,
      isBlocked: false,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const { getByText } = render(
      <BarcodeScannerScreen route={defaultRoute} />,
    );
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('renders with undefined route params', () => {
    const { usePermission } = jest.requireMock('#hooks/permissions/usePermission');
    usePermission.mockReturnValue({
      isGranted: false,
      isBlocked: false,
      request: mockRequestPermission,
      openSettings: mockOpenSettings,
    });

    const tree = render(
      <BarcodeScannerScreen route={{ params: undefined }} />,
    );
    expect(tree.toJSON()).toBeTruthy();
  });
});
