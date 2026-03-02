import { renderHook, act } from '@testing-library/react-native';
import { useDeviceRegistration } from '../useDeviceRegistration';

const mockRegisterDeviceMutation = jest.fn();
const mockHandleApolloError = jest.fn(() => ({ message: 'Registration failed' }));
const mockCollectDeviceInformation = jest.fn();
const mockValidateDeviceInformation = jest.fn();

jest.mock('#generated', () => ({
  useRegisterDeviceMutation: jest.fn(() => [mockRegisterDeviceMutation]),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: jest.fn(() => ({
    handleApolloError: mockHandleApolloError,
  })),
}));

jest.mock('#/utils/deviceInfo', () => ({
  collectDeviceInformation: (...args: any[]) => mockCollectDeviceInformation(...args),
  validateDeviceInformation: (...args: any[]) => mockValidateDeviceInformation(...args),
}));

jest.mock('#/utils/environment', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutationWithErrorHandler: jest.fn(
    async (fn: () => Promise<any>, onError: (err: any) => void) => {
      try {
        return await fn();
      } catch (err) {
        onError(err);
        return false;
      }
    },
  ),
  executeQuery: jest.fn(async (fn: () => Promise<any>) => {
    try {
      return await fn();
    } catch {
      return null;
    }
  }),
}));

// Break circular dependency
jest.mock('../../apollo/links/tokenScheduler', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDeviceRegistration', () => {
  it('starts with default state', () => {
    const { result } = renderHook(() => useDeviceRegistration());

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
    mockRegisterDeviceMutation.mockResolvedValue({
      data: { registerDevice: { success: true } },
    });

    const { result } = renderHook(() => useDeviceRegistration());

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

    const { result } = renderHook(() => useDeviceRegistration());

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
    mockRegisterDeviceMutation.mockResolvedValue({
      data: { registerDevice: { success: true } },
    });

    const { result } = renderHook(() => useDeviceRegistration());

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

    const { result } = renderHook(() => useDeviceRegistration());

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

    const { result } = renderHook(() => useDeviceRegistration());

    let info: any;
    await act(async () => {
      info = await result.current.getDeviceInformation();
    });

    expect(info).toBeNull();
  });
});
