'use no memo';

import { Platform } from 'react-native';

// Override the global device-info mock with all methods needed by deviceInfo.ts
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '42'),
  getUniqueId: jest.fn(() => Promise.resolve('test-unique-id')),
  getDeviceId: jest.fn(() => 'iPhone15,2'),
  getDeviceName: jest.fn(() => Promise.resolve('Test iPhone')),
  getDeviceType: jest.fn(() => 'Handset'),
  getSystemName: jest.fn(() => 'iOS'),
  getSystemVersion: jest.fn(() => '17.0'),
  getBrand: jest.fn(() => 'Apple'),
  getModel: jest.fn(() => 'iPhone 15'),
  isEmulator: jest.fn(() => Promise.resolve(false)),
  isTablet: jest.fn(() => false),
  getBundleId: jest.fn(() => 'com.souschef.app'),
  getApplicationName: jest.fn(() => 'SousChef'),
  getManufacturer: jest.fn(() => Promise.resolve('Apple')),
  getReadableVersion: jest.fn(() => '1.0.0.42'),
  getSerialNumber: jest.fn(() => Promise.resolve('serial-123')),
  getAndroidId: jest.fn(() => Promise.resolve('android-id')),
  getInstanceId: jest.fn(() => Promise.resolve('instance-id')),
  getFingerprint: jest.fn(() => 'android-fingerprint'),
  getSecurityPatch: jest.fn(() => Promise.resolve('2024-01-01')),
  getApiLevel: jest.fn(() => Promise.resolve(34)),
  getFirstInstallTime: jest.fn(() => Promise.resolve(1700000000000)),
  getLastUpdateTime: jest.fn(() => Promise.resolve(1700100000000)),
  getTotalMemory: jest.fn(() => Promise.resolve(8000000)),
  getUsedMemory: jest.fn(() => Promise.resolve(4000000)),
  getMaxMemory: jest.fn(() => Promise.resolve(8000000)),
  getTotalDiskCapacity: jest.fn(() => Promise.resolve(256000000)),
  getFreeDiskStorage: jest.fn(() => Promise.resolve(128000000)),
  supportedAbis: jest.fn(() => Promise.resolve(['arm64'])),
  getCarrier: jest.fn(() => Promise.resolve('T-Mobile')),
  getIpAddress: jest.fn(() => Promise.resolve('192.168.1.1')),
  isAirplaneMode: jest.fn(() => Promise.resolve(false)),
  isLocationEnabled: jest.fn(() => Promise.resolve(true)),
  getAvailableLocationProviders: jest.fn(() =>
    Promise.resolve({ gps: true, network: true }),
  ),
  getHostNames: jest.fn(() => Promise.resolve(['localhost'])),
  getBatteryLevel: jest.fn(() => Promise.resolve(0.85)),
  isBatteryCharging: jest.fn(() => Promise.resolve(true)),
  getPowerState: jest.fn(() =>
    Promise.resolve({ batteryLevel: 0.85, lowPowerMode: false }),
  ),
  isHeadphonesConnected: jest.fn(() => Promise.resolve(false)),
  isKeyboardConnected: jest.fn(() => Promise.resolve(false)),
  isMouseConnected: jest.fn(() => Promise.resolve(false)),
  getSupportedMediaTypeList: jest.fn(() => Promise.resolve(['audio/mp3'])),
  getFontScale: jest.fn(() => Promise.resolve(1.0)),
  hasNotch: jest.fn(() => true),
  hasDynamicIsland: jest.fn(() => true),
  getUserAgent: jest.fn(() => Promise.resolve('test-user-agent')),
}));

// Mock environment logger
import DeviceInfo from 'react-native-device-info';
import { DeviceType, MobilePlatform } from '#/graphql/generated/schemaTypes';
import {
  generateDeviceFingerprint,
  collectDeviceInformation,
  validateDeviceInformation,
  type DeviceInformation,
} from '../deviceInfo';
import { storage } from '#/storage/mmkv';

describe('deviceInfo', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    Object.defineProperty(Platform, 'Version', {
      value: '17.0',
      configurable: true,
    });

    // Reset all DeviceInfo mocks to their default implementations
    (DeviceInfo.getVersion as jest.Mock).mockReturnValue('1.0.0');
    (DeviceInfo.getBuildNumber as jest.Mock).mockReturnValue('42');
    (DeviceInfo.getUniqueId as jest.Mock).mockResolvedValue('test-unique-id');
    (DeviceInfo.getDeviceId as jest.Mock).mockReturnValue('iPhone15,2');
    (DeviceInfo.getDeviceName as jest.Mock).mockResolvedValue('Test iPhone');
    (DeviceInfo.getDeviceType as jest.Mock).mockReturnValue('Handset');
    (DeviceInfo.getSystemName as jest.Mock).mockReturnValue('iOS');
    (DeviceInfo.getSystemVersion as jest.Mock).mockReturnValue('17.0');
    (DeviceInfo.getBrand as jest.Mock).mockReturnValue('Apple');
    (DeviceInfo.getModel as jest.Mock).mockReturnValue('iPhone 15');
    (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(false);
    (DeviceInfo.isTablet as jest.Mock).mockReturnValue(false);
    (DeviceInfo.getBundleId as jest.Mock).mockReturnValue('com.souschef.app');
    (DeviceInfo.getManufacturer as jest.Mock).mockResolvedValue('Apple');
    (DeviceInfo.getReadableVersion as jest.Mock).mockReturnValue('1.0.0.42');
    (DeviceInfo.getSerialNumber as jest.Mock).mockResolvedValue('serial-123');
    (DeviceInfo.getAndroidId as jest.Mock).mockResolvedValue('android-id');
    (DeviceInfo.getInstanceId as jest.Mock).mockResolvedValue('instance-id');
    (DeviceInfo.getFingerprint as jest.Mock).mockReturnValue(
      'android-fingerprint',
    );
    (DeviceInfo.getSecurityPatch as jest.Mock).mockResolvedValue('2024-01-01');
    (DeviceInfo.getApiLevel as jest.Mock).mockResolvedValue(34);
    (DeviceInfo.getFirstInstallTime as jest.Mock).mockResolvedValue(
      1700000000000,
    );
    (DeviceInfo.getLastUpdateTime as jest.Mock).mockResolvedValue(
      1700100000000,
    );
    (DeviceInfo.getTotalMemory as jest.Mock).mockResolvedValue(8000000);
    (DeviceInfo.getUsedMemory as jest.Mock).mockResolvedValue(4000000);
    (DeviceInfo.getMaxMemory as jest.Mock).mockResolvedValue(8000000);
    (DeviceInfo.getTotalDiskCapacity as jest.Mock).mockResolvedValue(256000000);
    (DeviceInfo.getFreeDiskStorage as jest.Mock).mockResolvedValue(128000000);
    (DeviceInfo.supportedAbis as jest.Mock).mockResolvedValue(['arm64']);
    (DeviceInfo.getCarrier as jest.Mock).mockResolvedValue('T-Mobile');
    (DeviceInfo.getIpAddress as jest.Mock).mockResolvedValue('192.168.1.1');
    (DeviceInfo.isAirplaneMode as jest.Mock).mockResolvedValue(false);
    (DeviceInfo.isLocationEnabled as jest.Mock).mockResolvedValue(true);
    (DeviceInfo.getAvailableLocationProviders as jest.Mock).mockResolvedValue({
      gps: true,
      network: true,
    });
    (DeviceInfo.getHostNames as jest.Mock).mockResolvedValue(['localhost']);
    (DeviceInfo.getBatteryLevel as jest.Mock).mockResolvedValue(0.85);
    (DeviceInfo.isBatteryCharging as jest.Mock).mockResolvedValue(true);
    (DeviceInfo.getPowerState as jest.Mock).mockResolvedValue({
      batteryLevel: 0.85,
      lowPowerMode: false,
    });
    (DeviceInfo.isHeadphonesConnected as jest.Mock).mockResolvedValue(false);
    (DeviceInfo.isKeyboardConnected as jest.Mock).mockResolvedValue(false);
    (DeviceInfo.isMouseConnected as jest.Mock).mockResolvedValue(false);
    (DeviceInfo.getSupportedMediaTypeList as jest.Mock).mockResolvedValue([
      'audio/mp3',
    ]);
    (DeviceInfo.getFontScale as jest.Mock).mockResolvedValue(1.0);
    (DeviceInfo.hasNotch as jest.Mock).mockReturnValue(true);
    (DeviceInfo.hasDynamicIsland as jest.Mock).mockReturnValue(true);
    (DeviceInfo.getUserAgent as jest.Mock).mockResolvedValue('test-user-agent');
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatformOS,
      configurable: true,
    });
  });

  // ==========================================================================
  // validateDeviceInformation
  // ==========================================================================
  describe('validateDeviceInformation', () => {
    it('returns true for valid device information', () => {
      const info: DeviceInformation = {
        deviceId: 'ios-abc123def456-xyz',
        deviceType: DeviceType.Mobile,
        platform: MobilePlatform.Ios,
        osName: 'iOS',
        osVersion: '17.0',
        appVersion: '1.0.0',
        timezone: 'UTC',
        language: 'en-US',
      };
      expect(validateDeviceInformation(info)).toBe(true);
    });

    it('returns false when required field is missing', () => {
      const info: Partial<DeviceInformation> = {
        deviceId: 'ios-abc123def456-xyz',
        deviceType: DeviceType.Mobile,
        platform: MobilePlatform.Ios,
        osName: 'iOS',
        // missing osVersion
        appVersion: '1.0.0',
        timezone: 'UTC',
        language: 'en-US',
      };
      expect(validateDeviceInformation(info as DeviceInformation)).toBe(false);
    });

    it('returns false when deviceId is too short', () => {
      const info: DeviceInformation = {
        deviceId: 'abc',
        deviceType: DeviceType.Mobile,
        platform: MobilePlatform.Ios,
        osName: 'iOS',
        osVersion: '17.0',
        appVersion: '1.0.0',
        timezone: 'UTC',
        language: 'en-US',
      };
      expect(validateDeviceInformation(info)).toBe(false);
    });

    it('returns false for empty deviceId', () => {
      const info: DeviceInformation = {
        deviceId: '',
        deviceType: DeviceType.Mobile,
        platform: MobilePlatform.Ios,
        osName: 'iOS',
        osVersion: '17.0',
        appVersion: '1.0.0',
        timezone: 'UTC',
        language: 'en-US',
      };
      expect(validateDeviceInformation(info)).toBe(false);
    });

    it('returns false when appVersion is missing', () => {
      const info: DeviceInformation = {
        deviceId: 'ios-abc123def456-xyz',
        deviceType: DeviceType.Mobile,
        platform: MobilePlatform.Ios,
        osName: 'iOS',
        osVersion: '17.0',
        appVersion: '',
        timezone: 'UTC',
        language: 'en-US',
      };
      expect(validateDeviceInformation(info)).toBe(false);
    });

    it('checks all required fields', () => {
      const base: DeviceInformation = {
        deviceId: 'ios-abc123def456-xyz',
        deviceType: DeviceType.Mobile,
        platform: MobilePlatform.Ios,
        osName: 'iOS',
        osVersion: '17.0',
        appVersion: '1.0.0',
        timezone: 'UTC',
        language: 'en-US',
      };
      // Each case empties one required field; validation must then fail.
      const emptyRequiredFieldCases: Partial<DeviceInformation>[] = [
        { deviceId: '' },
        { deviceType: '' as DeviceType },
        { platform: '' as MobilePlatform },
        { osName: '' },
        { osVersion: '' },
        { appVersion: '' },
      ];
      for (const override of emptyRequiredFieldCases) {
        expect(validateDeviceInformation({ ...base, ...override })).toBe(false);
      }
    });
  });

  // ==========================================================================
  // generateDeviceFingerprint
  // ==========================================================================
  describe('generateDeviceFingerprint', () => {
    // The fingerprint persists, so a case that varies the device mocks has to
    // start from an empty keystore or it reads the previous case's value.
    beforeEach(() => {
      storage.clearAll();
    });

    it('generates a fingerprint containing platform prefix', async () => {
      const fingerprint = await generateDeviceFingerprint();
      expect(fingerprint).toContain('ios-');
    });

    /**
     * The API keys `Device` rows on this value and updates the matching row
     * rather than inserting, so a fingerprint that varies between calls
     * registers a new device on every launch — 147 rows for one account.
     */
    it('returns the same fingerprint on repeated calls', async () => {
      const fp1 = await generateDeviceFingerprint();
      await new Promise(r => setTimeout(r, 5));
      const fp2 = await generateDeviceFingerprint();
      expect(fp2).toEqual(fp1);
    });

    it('reuses the persisted value rather than recomposing it', async () => {
      storage.set('device_fingerprint', 'ios-persisted');
      await expect(generateDeviceFingerprint()).resolves.toBe('ios-persisted');
    });

    it('persists a freshly composed fingerprint', async () => {
      const fingerprint = await generateDeviceFingerprint();
      expect(storage.getString('device_fingerprint')).toBe(fingerprint);
    });

    it('generates fingerprint for android platform', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      const fingerprint = await generateDeviceFingerprint();
      expect(fingerprint).toContain('android-');
    });

    it('returns fallback fingerprint when all identifiers are null', async () => {
      (DeviceInfo.getUniqueId as jest.Mock).mockResolvedValue(null);
      (DeviceInfo.getDeviceId as jest.Mock).mockReturnValue(null);
      (DeviceInfo.getBrand as jest.Mock).mockReturnValue(null);
      (DeviceInfo.getModel as jest.Mock).mockReturnValue(null);
      (DeviceInfo.getSystemName as jest.Mock).mockReturnValue(null);
      (DeviceInfo.getSystemVersion as jest.Mock).mockReturnValue(null);
      (DeviceInfo.getBuildNumber as jest.Mock).mockReturnValue(null);
      (DeviceInfo.getSerialNumber as jest.Mock).mockResolvedValue(null);
      Object.defineProperty(Platform, 'Version', {
        value: null,
        configurable: true,
      });

      const fingerprint = await generateDeviceFingerprint();
      expect(fingerprint).toContain('ios-');
    });

    it('returns emergency fallback on complete error', async () => {
      (DeviceInfo.getUniqueId as jest.Mock).mockImplementation(() => {
        throw new Error('fail');
      });
      (DeviceInfo.getDeviceId as jest.Mock).mockImplementation(() => {
        throw new Error('fail');
      });
      (DeviceInfo.getBrand as jest.Mock).mockImplementation(() => {
        throw new Error('fail');
      });
      (DeviceInfo.getModel as jest.Mock).mockImplementation(() => {
        throw new Error('fail');
      });
      (DeviceInfo.getSystemName as jest.Mock).mockImplementation(() => {
        throw new Error('fail');
      });
      (DeviceInfo.getSystemVersion as jest.Mock).mockImplementation(() => {
        throw new Error('fail');
      });
      (DeviceInfo.getBuildNumber as jest.Mock).mockImplementation(() => {
        throw new Error('fail');
      });
      (DeviceInfo.getSerialNumber as jest.Mock).mockImplementation(() => {
        throw new Error('fail');
      });

      const fingerprint = await generateDeviceFingerprint();
      expect(fingerprint).toContain('ios-emergency-');
    });
  });

  // ==========================================================================
  // collectDeviceInformation
  // ==========================================================================
  describe('collectDeviceInformation', () => {
    it('collects comprehensive device info on iOS', async () => {
      const info = await collectDeviceInformation();
      expect(info.deviceId).toBeTruthy();
      expect(info.platform).toBe('IOS');
      expect(info.osName).toBe('iOS');
      expect(info.osVersion).toBe('17.0');
      expect(info.appVersion).toBe('1.0.0');
      expect(info.deviceName).toBe('Test iPhone');
      expect(info.timezone).toBeTruthy();
      expect(info.language).toBeTruthy();
    });

    it('maps handset device type to Mobile', async () => {
      (DeviceInfo.getDeviceType as jest.Mock).mockReturnValue('Handset');
      const info = await collectDeviceInformation();
      expect(info.deviceType).toBe('MOBILE');
    });

    it('maps tablet device type to Tablet', async () => {
      (DeviceInfo.getDeviceType as jest.Mock).mockReturnValue('Tablet');
      const info = await collectDeviceInformation();
      expect(info.deviceType).toBe('TABLET');
    });

    it('maps tv device type to Tv', async () => {
      (DeviceInfo.getDeviceType as jest.Mock).mockReturnValue('Tv');
      const info = await collectDeviceInformation();
      expect(info.deviceType).toBe('TV');
    });

    it('maps desktop device type to Desktop', async () => {
      (DeviceInfo.getDeviceType as jest.Mock).mockReturnValue('Desktop');
      const info = await collectDeviceInformation();
      expect(info.deviceType).toBe('DESKTOP');
    });

    it('maps watch device type to Watch', async () => {
      (DeviceInfo.getDeviceType as jest.Mock).mockReturnValue('Watch');
      const info = await collectDeviceInformation();
      expect(info.deviceType).toBe('WATCH');
    });

    it('maps phone device type to Mobile', async () => {
      (DeviceInfo.getDeviceType as jest.Mock).mockReturnValue('Phone');
      const info = await collectDeviceInformation();
      expect(info.deviceType).toBe('MOBILE');
    });

    it('maps unknown device type to Mobile on iOS', async () => {
      (DeviceInfo.getDeviceType as jest.Mock).mockReturnValue(
        'SomeUnknownType',
      );
      const info = await collectDeviceInformation();
      expect(info.deviceType).toBe('MOBILE');
    });

    it('maps unknown device type to Unknown on non-mobile platform', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'web',
        configurable: true,
      });
      (DeviceInfo.getDeviceType as jest.Mock).mockReturnValue(
        'SomeUnknownType',
      );
      const info = await collectDeviceInformation();
      expect(info.deviceType).toBe('UNKNOWN');
    });

    it('collects android-specific info', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      const info = await collectDeviceInformation();
      expect(info.platform).toBe('ANDROID');
    });

    it('collects iOS vendor id', async () => {
      const info = await collectDeviceInformation();
      expect(info.iosVendorId).toBe('test-unique-id');
    });

    it('maps platform correctly for windows', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'windows',
        configurable: true,
      });
      const info = await collectDeviceInformation();
      expect(info.platform).toBe('WINDOWS');
    });

    it('maps platform correctly for macos', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'macos',
        configurable: true,
      });
      const info = await collectDeviceInformation();
      expect(info.platform).toBe('MACOS');
    });

    it('maps platform correctly for web', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'web',
        configurable: true,
      });
      const info = await collectDeviceInformation();
      expect(info.platform).toBe('LINUX');
    });

    it('maps platform correctly for unknown OS', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'fuchsia',
        configurable: true,
      });
      const info = await collectDeviceInformation();
      expect(info.platform).toBe('OTHER');
    });

    it('collects hardware info', async () => {
      const info = await collectDeviceInformation();
      expect(info.totalMemory).toBe('8000000');
      expect(info.usedMemory).toBe('4000000');
    });

    it('collects network info', async () => {
      const info = await collectDeviceInformation();
      expect(info.carrier).toBe('T-Mobile');
      expect(info.deviceIpAddress).toBe('192.168.1.1');
    });

    it('collects battery info', async () => {
      const info = await collectDeviceInformation();
      expect(info.batteryLevel).toBe(0.85);
      expect(info.isBatteryCharging).toBe(true);
    });

    it('collects peripheral info', async () => {
      const info = await collectDeviceInformation();
      expect(info.isHeadphonesConnected).toBe(false);
    });

    it('collects display info', async () => {
      const info = await collectDeviceInformation();
      expect(info.fontScale).toBe(1.0);
      expect(info.hasNotch).toBe(true);
    });

    it('collects locale info with fallback', async () => {
      const info = await collectDeviceInformation();
      expect(info.country).toBe('US');
      expect(info.currency).toBe('USD');
    });

    it('handles getDeviceName failure gracefully', async () => {
      (DeviceInfo.getDeviceName as jest.Mock).mockRejectedValue(
        new Error('fail'),
      );
      const info = await collectDeviceInformation();
      expect(info.deviceName).toBe('ios Device');
    });

    it('handles location providers as object', async () => {
      const info = await collectDeviceInformation();
      expect(info.availableLocationProviders).toEqual(['gps', 'network']);
    });

    it('returns fallback device info on complete failure', async () => {
      (DeviceInfo.getDeviceType as jest.Mock).mockImplementation(() => {
        throw new Error('total failure');
      });

      const info = await collectDeviceInformation();
      expect(info.deviceId).toBeTruthy();
      expect(info.osName).toBe('ios');
      expect(info.appVersion).toBe('1.0.0');
      expect(info.timezone).toBe('UTC');
    });

    it('collects android security info (androidId, instanceId, securityPatch, etc.)', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      // getFingerprint returns sync value so .catch() will fail, make it a promise
      (DeviceInfo.getFingerprint as jest.Mock).mockReturnValue(
        Promise.resolve('android-fingerprint'),
      );
      const info = await collectDeviceInformation();
      expect(info.androidId).toBe('android-id');
      expect(info.instanceId).toBe('instance-id');
      expect(info.deviceFingerprint).toBe('android-fingerprint');
      expect(info.securityPatch).toBe('2024-01-01');
      expect(info.serialNumber).toBe('serial-123');
      expect(info.apiLevel).toBe(34);
    });

    it('collects security info: manufacturer, model, brand, buildNumber', async () => {
      const info = await collectDeviceInformation();
      expect(info.manufacturer).toBe('Apple');
      expect(info.model).toBe('iPhone 15');
      expect(info.brand).toBe('Apple');
      expect(info.buildNumber).toBe('42');
      expect(info.systemVersion).toBe('17.0');
      expect(info.readableVersion).toBe('1.0.0.42');
    });

    it('collects firstInstallTime and lastUpdateTime as ISO strings', async () => {
      const info = await collectDeviceInformation();
      expect(info.firstInstallTime).toContain('2023-');
      expect(info.lastUpdateTime).toContain('2023-');
    });

    it('collects hardware info: memory, disk, bundleId', async () => {
      const info = await collectDeviceInformation();
      expect(info.totalMemory).toBe('8000000');
      expect(info.usedMemory).toBe('4000000');
      expect(info.maxMemory).toBe('8000000');
      expect(info.totalDiskCapacity).toBe('256000000');
      expect(info.freeDiskStorage).toBe('128000000');
      expect(info.bundleId).toBe('com.souschef.app');
    });

    it('collects supportedAbis on android', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      const info = await collectDeviceInformation();
      expect(info.supportedAbis).toEqual(['arm64']);
    });

    it('collects supportedAbis on ios', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });
      const info = await collectDeviceInformation();
      expect(info.supportedAbis).toEqual(['arm64']);
    });

    it('collects network info: airplane mode, location enabled', async () => {
      const info = await collectDeviceInformation();
      expect(info.isAirplaneMode).toBe(false);
      expect(info.isLocationEnabled).toBe(true);
    });

    it('collects host names', async () => {
      const info = await collectDeviceInformation();
      expect(info.hostNames).toEqual(['localhost']);
    });

    it('collects battery power state as JSON string', async () => {
      const info = await collectDeviceInformation();
      expect(info.powerState).toBeTruthy();
      expect(JSON.parse(info.powerState!)).toEqual({
        batteryLevel: 0.85,
        lowPowerMode: false,
      });
    });

    it('collects peripheral info: keyboard and mouse', async () => {
      const info = await collectDeviceInformation();
      expect(info.isKeyboardConnected).toBe(false);
      expect(info.isMouseConnected).toBe(false);
    });

    it('collects additional info: supportedMediaTypes', async () => {
      const info = await collectDeviceInformation();
      expect(info.supportedMediaTypes).toEqual(['audio/mp3']);
    });

    it('collects display info: hasDynamicIsland on iOS', async () => {
      const info = await collectDeviceInformation();
      expect(info.hasDynamicIsland).toBe(true);
    });

    it('collects screen resolution', async () => {
      const info = await collectDeviceInformation();
      expect(info.screenResolution).toBeTruthy();
    });

    it('collects browser info (userAgent) for non-web platform', async () => {
      const info = await collectDeviceInformation();
      expect(info.userAgent).toBe('test-user-agent');
      expect(info.browserName).toBe('Native App');
    });

    it('collects isEmulator and isTablet in security info', async () => {
      const info = await collectDeviceInformation();
      expect(info.isEmulator).toBe(false);
      expect(info.isTablet).toBe(false);
    });
  });
});
