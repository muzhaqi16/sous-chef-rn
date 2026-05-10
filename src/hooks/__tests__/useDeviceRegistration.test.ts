import { act } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { RegisterDeviceDocument } from '#operations/auth/device.generated';
import { useDeviceRegistration } from '../useDeviceRegistration';

const mockHandleApolloError = jest.fn(() => ({
  message: 'Registration failed',
}));
const mockCollectDeviceInformation = jest.fn();
const mockValidateDeviceInformation = jest.fn();

jest.mock('#/services/errorService', () => ({
  useErrorService: jest.fn(() => ({
    handleApolloError: mockHandleApolloError,
  })),
}));

jest.mock('#/utils/deviceInfo', () => ({
  collectDeviceInformation: (...args: any[]) =>
    mockCollectDeviceInformation(...args),
  validateDeviceInformation: (...args: any[]) =>
    mockValidateDeviceInformation(...args),
}));

jest.mock('#/utils/environment', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

// Build a full DeviceRegistrationInput from a partial deviceInfo, mirroring
// the transform inside `registerDeviceImpl`. We need this so the
// `MockedResponse` variables match exactly what the hook sends to Apollo.
function buildDeviceInput(deviceInfo: any) {
  return {
    deviceId: deviceInfo.deviceId,
    deviceName: deviceInfo.deviceName,
    deviceType: deviceInfo.deviceType,
    platform: deviceInfo.platform,
    appVersion: deviceInfo.appVersion,
    pushToken: undefined,
    details: {
      browserOs: {
        osName: deviceInfo.osName,
        osVersion: deviceInfo.osVersion,
        userAgent: deviceInfo.userAgent,
        browserName: deviceInfo.browserName,
        browserVersion: deviceInfo.browserVersion,
        screenResolution: deviceInfo.screenResolution,
      },
      characteristics: {
        hasNotch: deviceInfo.hasNotch,
        hasDynamicIsland: deviceInfo.hasDynamicIsland,
        isEmulator: deviceInfo.isEmulator,
        isTablet: deviceInfo.isTablet,
      },
      identification: {
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        brand: deviceInfo.brand,
        androidId: deviceInfo.androidId,
        instanceId: deviceInfo.instanceId,
        apiLevel: deviceInfo.apiLevel,
        deviceFingerprint: deviceInfo.deviceFingerprint,
        iosVendorId: deviceInfo.iosVendorId,
        securityPatch: deviceInfo.securityPatch,
        firstInstallTime: deviceInfo.firstInstallTime,
        lastUpdateTime: deviceInfo.lastUpdateTime,
        systemVersion: deviceInfo.systemVersion,
        readableVersion: deviceInfo.readableVersion,
        buildNumber: deviceInfo.buildNumber,
        bundleId: deviceInfo.bundleId,
      },
      hardware: {
        totalMemory: deviceInfo.totalMemory,
        usedMemory: deviceInfo.usedMemory,
        maxMemory: deviceInfo.maxMemory,
        totalDiskCapacity: deviceInfo.totalDiskCapacity,
        freeDiskStorage: deviceInfo.freeDiskStorage,
        supportedAbis: deviceInfo.supportedAbis,
      },
      connectivity: {
        carrier: deviceInfo.carrier,
        isAirplaneMode: deviceInfo.isAirplaneMode,
        isLocationEnabled: deviceInfo.isLocationEnabled,
      },
      power: {
        batteryLevel: deviceInfo.batteryLevel,
        isBatteryCharging: deviceInfo.isBatteryCharging,
        powerState: deviceInfo.powerState
          ? JSON.parse(deviceInfo.powerState)
          : undefined,
      },
      peripherals: {
        isHeadphonesConnected: deviceInfo.isHeadphonesConnected,
        isKeyboardConnected: deviceInfo.isKeyboardConnected,
        isMouseConnected: deviceInfo.isMouseConnected,
      },
      availableLocationProviders: deviceInfo.availableLocationProviders,
      hostNames: deviceInfo.hostNames,
      supportedMediaTypes: deviceInfo.supportedMediaTypes,
    },
    location: {
      ipAddress: deviceInfo.deviceIpAddress,
      ipCountry: deviceInfo.country,
      timezone: deviceInfo.timezone,
      language: deviceInfo.language,
    },
  };
}

function buildRegisterDeviceMock(
  deviceInfo: any,
  success: boolean = true,
): MockedResponse {
  return {
    request: {
      query: RegisterDeviceDocument,
      variables: { input: buildDeviceInput(deviceInfo) },
    },
    result: {
      data: {
        registerDevice: {
          __typename: 'DevicePayload',
          success,
          message: success ? 'OK' : 'Failed',
          code: success ? 'OK' : 'ERROR',
        },
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDeviceRegistration', () => {
  it('starts with default state', () => {
    const { result } = renderHookWithApollo(() => useDeviceRegistration());

    expect(result.current.isRegistering).toBe(false);
    expect(result.current.lastRegisteredDevice).toBeNull();
    expect(result.current.registrationError).toBeNull();
  });

  it('registerDevice succeeds with valid device info', async () => {
    const deviceInfo = {
      deviceId: 'test-device-id',
      deviceName: 'Test Phone',
      deviceType: 'MOBILE',
      platform: 'IOS',
      appVersion: '1.0.0',
    };

    mockCollectDeviceInformation.mockResolvedValue(deviceInfo);
    mockValidateDeviceInformation.mockReturnValue(true);

    const { result } = renderHookWithApollo(() => useDeviceRegistration(), {
      operationMocks: [buildRegisterDeviceMock(deviceInfo, true)],
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.registerDevice();
    });

    expect(success).toBe(true);
    expect(result.current.lastRegisteredDevice).toBe('test-device-id');
    expect(result.current.registrationError).toBeNull();
  });

  it('registerDevice fails when validation fails', async () => {
    const deviceInfo = { deviceId: '' };

    mockCollectDeviceInformation.mockResolvedValue(deviceInfo);
    mockValidateDeviceInformation.mockReturnValue(false);

    const { result } = renderHookWithApollo(() => useDeviceRegistration());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.registerDevice();
    });

    expect(success).toBe(false);
  });

  it('clearDeviceRegistrationState resets state', async () => {
    const deviceInfo = {
      deviceId: 'dev-1',
      deviceName: 'Phone',
      deviceType: 'MOBILE',
      platform: 'IOS',
      appVersion: '1.0.0',
    };
    mockCollectDeviceInformation.mockResolvedValue(deviceInfo);
    mockValidateDeviceInformation.mockReturnValue(true);

    const { result } = renderHookWithApollo(() => useDeviceRegistration(), {
      operationMocks: [buildRegisterDeviceMock(deviceInfo, true)],
    });

    await act(async () => {
      await result.current.registerDevice();
    });

    expect(result.current.lastRegisteredDevice).toBe('dev-1');

    act(() => {
      result.current.clearDeviceRegistrationState();
    });

    expect(result.current.isRegistering).toBe(false);
    expect(result.current.lastRegisteredDevice).toBeNull();
    expect(result.current.registrationError).toBeNull();
  });

  it('getDeviceInformation returns device info when valid', async () => {
    const deviceInfo = { deviceId: 'dev-1', platform: 'IOS' };
    mockCollectDeviceInformation.mockResolvedValue(deviceInfo);
    mockValidateDeviceInformation.mockReturnValue(true);

    const { result } = renderHookWithApollo(() => useDeviceRegistration());

    let info: any;
    await act(async () => {
      info = await result.current.getDeviceInformation();
    });

    expect(info).toEqual(deviceInfo);
  });

  it('getDeviceInformation returns null when invalid', async () => {
    const deviceInfo = { deviceId: '' };
    mockCollectDeviceInformation.mockResolvedValue(deviceInfo);
    mockValidateDeviceInformation.mockReturnValue(false);

    const { result } = renderHookWithApollo(() => useDeviceRegistration());

    let info: any;
    await act(async () => {
      info = await result.current.getDeviceInformation();
    });

    expect(info).toBeNull();
  });
});
