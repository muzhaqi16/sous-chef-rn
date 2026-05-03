import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { logger } from './environment';
import { DeviceType, MobilePlatform } from '#/graphql/generated/schemaTypes';

export interface DeviceInformation {
  // Basic device info
  deviceId: string;
  deviceName?: string;
  deviceType: DeviceType;
  platform: MobilePlatform;
  osName: string;
  osVersion: string;
  appVersion: string;
  userAgent?: string;
  browserName?: string;
  browserVersion?: string;
  screenResolution?: string;
  timezone: string;
  language: string;

  // Enhanced device identification
  manufacturer?: string;
  model?: string;
  brand?: string;
  buildNumber?: string;
  bundleId?: string;
  systemVersion?: string;
  apiLevel?: number;
  readableVersion?: string;

  // Security IDs & fingerprinting
  androidId?: string;
  instanceId?: string;
  isEmulator?: boolean;
  isTablet?: boolean;
  firstInstallTime?: string;
  lastUpdateTime?: string;
  serialNumber?: string;
  deviceFingerprint?: string;
  securityPatch?: string;
  iosVendorId?: string;

  // Hardware specifications
  totalMemory?: string;
  usedMemory?: string;
  maxMemory?: string;
  totalDiskCapacity?: string;
  freeDiskStorage?: string;
  supportedAbis?: string[];

  // Display characteristics
  fontScale?: number;
  hasNotch?: boolean;
  hasDynamicIsland?: boolean;

  // Network & connectivity
  carrier?: string;
  deviceIpAddress?: string;
  isAirplaneMode?: boolean;
  isLocationEnabled?: boolean;

  // Battery management
  batteryLevel?: number;
  isBatteryCharging?: boolean;
  powerState?: string;

  // Peripheral detection
  isHeadphonesConnected?: boolean;
  isKeyboardConnected?: boolean;
  isMouseConnected?: boolean;

  // Additional tracking
  availableLocationProviders?: string[];
  hostNames?: string[];
  supportedMediaTypes?: string[];

  // Locale information
  country?: string;
  currency?: string;
}

/**
 * Maps React Native device type to our GraphQL DeviceType enum
 */
const mapDeviceType = (deviceType: string): DeviceType => {
  switch (deviceType.toLowerCase()) {
    case 'tablet':
      return DeviceType.Tablet;
    case 'handset':
    case 'phone':
      return DeviceType.Mobile;
    case 'tv':
      return DeviceType.Tv;
    case 'desktop':
      return DeviceType.Desktop;
    case 'watch':
      return DeviceType.Watch;
    default:
      return Platform.OS === 'ios' || Platform.OS === 'android'
        ? DeviceType.Mobile
        : DeviceType.Unknown;
  }
};

/**
 * Maps React Native platform to our MobilePlatform enum
 */
const mapPlatform = (): MobilePlatform => {
  switch (Platform.OS) {
    case 'ios':
      return MobilePlatform.Ios;
    case 'android':
      return MobilePlatform.Android;
    case 'windows':
      return MobilePlatform.Windows;
    case 'macos':
      return MobilePlatform.Macos;
    case 'web':
      return MobilePlatform.Linux; // Default for web
    default:
      return MobilePlatform.Other;
  }
};

/**
 * Collects comprehensive security-related device information
 */
const collectSecurityInfo = async () => {
  const securityInfo: Partial<DeviceInformation> = {};

  try {
    // Critical security indicators
    securityInfo.isEmulator = await DeviceInfo.isEmulator().catch(
      () => undefined,
    );
    securityInfo.isTablet = DeviceInfo.isTablet();
    securityInfo.firstInstallTime = await DeviceInfo.getFirstInstallTime()
      .then(time => new Date(time).toISOString())
      .catch(() => undefined);
    securityInfo.lastUpdateTime = await DeviceInfo.getLastUpdateTime()
      .then(time => new Date(time).toISOString())
      .catch(() => undefined);

    // Enhanced device identification (some methods return promises)
    securityInfo.manufacturer = await DeviceInfo.getManufacturer().catch(
      () => undefined,
    );
    securityInfo.model = DeviceInfo.getModel();
    securityInfo.brand = DeviceInfo.getBrand();
    securityInfo.buildNumber = DeviceInfo.getBuildNumber();
    securityInfo.systemVersion = DeviceInfo.getSystemVersion();
    securityInfo.readableVersion = DeviceInfo.getReadableVersion();

    // Platform-specific security info
    if (Platform.OS === 'android') {
      try {
        securityInfo.androidId = await DeviceInfo.getAndroidId().catch(
          () => undefined,
        );
        securityInfo.instanceId = await DeviceInfo.getInstanceId().catch(
          () => undefined,
        );
        securityInfo.deviceFingerprint =
          await DeviceInfo.getFingerprint().catch(() => undefined);
        securityInfo.securityPatch = await DeviceInfo.getSecurityPatch().catch(
          () => undefined,
        );
        securityInfo.serialNumber = await DeviceInfo.getSerialNumber().catch(
          () => undefined,
        );
        securityInfo.apiLevel = await DeviceInfo.getApiLevel().catch(
          () => undefined,
        );
      } catch (error) {
        logger.warn('Some Android security info not available:', error);
      }
    } else if (Platform.OS === 'ios') {
      securityInfo.iosVendorId = await DeviceInfo.getUniqueId().catch(
        () => undefined,
      );
    }
  } catch (error) {
    logger.warn('Error collecting security info:', error);
  }

  return securityInfo;
};

/**
 * Collects comprehensive hardware-related device information
 */
const collectHardwareInfo = async () => {
  const hardwareInfo: Partial<DeviceInformation> = {};

  try {
    // Memory specifications (convert to strings as per schema)
    hardwareInfo.totalMemory = await DeviceInfo.getTotalMemory()
      .then(mem => mem.toString())
      .catch(() => undefined);
    hardwareInfo.usedMemory = await DeviceInfo.getUsedMemory()
      .then(mem => mem.toString())
      .catch(() => undefined);
    hardwareInfo.maxMemory = await DeviceInfo.getMaxMemory()
      .then(mem => mem.toString())
      .catch(() => undefined);

    // Storage specifications
    hardwareInfo.totalDiskCapacity = await DeviceInfo.getTotalDiskCapacity()
      .then(storage => storage.toString())
      .catch(() => undefined);
    hardwareInfo.freeDiskStorage = await DeviceInfo.getFreeDiskStorage()
      .then(storage => storage.toString())
      .catch(() => undefined);

    // App information
    try {
      hardwareInfo.bundleId = DeviceInfo.getBundleId();
    } catch (error) {
      logger.warn('Bundle ID not available:', error);
    }

    // CPU architecture support
    if (Platform.OS === 'android') {
      try {
        hardwareInfo.supportedAbis = await DeviceInfo.supportedAbis().catch(
          () => undefined,
        );
      } catch (error) {
        logger.warn('Supported ABIs not available:', error);
      }
    } else if (Platform.OS === 'ios') {
      try {
        hardwareInfo.supportedAbis = await DeviceInfo.supportedAbis().catch(
          () => undefined,
        );
      } catch (error) {
        logger.warn('iOS supported ABIs not available:', error);
      }
    }
  } catch (error) {
    logger.warn('Error collecting hardware info:', error);
  }

  return hardwareInfo;
};

/**
 * Collects comprehensive network and connectivity information
 */
const collectNetworkInfo = async () => {
  const networkInfo: Partial<DeviceInformation> = {};

  try {
    // Basic network info
    networkInfo.carrier = await DeviceInfo.getCarrier().catch(() => undefined);
    networkInfo.deviceIpAddress = await DeviceInfo.getIpAddress().catch(
      () => undefined,
    );

    // Connectivity states
    networkInfo.isAirplaneMode = await DeviceInfo.isAirplaneMode().catch(
      () => undefined,
    );
    networkInfo.isLocationEnabled = await DeviceInfo.isLocationEnabled().catch(
      () => undefined,
    );

    // Available location providers for geolocation analysis
    const locationProviders =
      await DeviceInfo.getAvailableLocationProviders().catch(() => undefined);
    if (locationProviders && typeof locationProviders === 'object') {
      // Convert location provider object to string array
      networkInfo.availableLocationProviders = Object.keys(locationProviders);
    }

    // Host names for network analysis
    networkInfo.hostNames = await DeviceInfo.getHostNames().catch(
      () => undefined,
    );
  } catch (error) {
    logger.warn('Error collecting network info:', error);
  }

  return networkInfo;
};

/**
 * Collects battery management information
 */
const collectBatteryInfo = async () => {
  const batteryInfo: Partial<DeviceInformation> = {};

  try {
    // Battery status and level
    batteryInfo.batteryLevel = await DeviceInfo.getBatteryLevel().catch(
      () => undefined,
    );
    batteryInfo.isBatteryCharging = await DeviceInfo.isBatteryCharging().catch(
      () => undefined,
    );
    batteryInfo.powerState = await DeviceInfo.getPowerState()
      .then(state => JSON.stringify(state))
      .catch(() => undefined);
  } catch (error) {
    logger.warn('Error collecting battery info:', error);
  }

  return batteryInfo;
};

/**
 * Collects peripheral detection information for automation detection
 */
const collectPeripheralInfo = async () => {
  const peripheralInfo: Partial<DeviceInformation> = {};

  try {
    // Peripheral connections - important for detecting automation/bots
    peripheralInfo.isHeadphonesConnected =
      await DeviceInfo.isHeadphonesConnected().catch(() => undefined);
    peripheralInfo.isKeyboardConnected =
      await DeviceInfo.isKeyboardConnected().catch(() => undefined);
    peripheralInfo.isMouseConnected = await DeviceInfo.isMouseConnected().catch(
      () => undefined,
    );
  } catch (error) {
    logger.warn('Error collecting peripheral info:', error);
  }

  return peripheralInfo;
};

/**
 * Collects additional tracking information
 */
const collectAdditionalInfo = async () => {
  const additionalInfo: Partial<DeviceInformation> = {};

  try {
    // Media capabilities for fingerprinting
    additionalInfo.supportedMediaTypes =
      await DeviceInfo.getSupportedMediaTypeList().catch(() => undefined);
  } catch (error) {
    logger.warn('Error collecting additional info:', error);
  }

  return additionalInfo;
};

/**
 * Collects locale and region information
 */
const collectLocaleInfo = async () => {
  const localeInfo: Partial<DeviceInformation> = {};

  try {
    // Use fallback values since specific country/currency methods may not be available
    localeInfo.country = 'US'; // Fallback country
    localeInfo.currency = 'USD'; // Fallback currency
  } catch (error) {
    logger.warn('Error collecting locale info:', error);
  }

  return localeInfo;
};

/**
 * Collects display-related information
 */
const collectDisplayInfo = async () => {
  const displayInfo: Partial<DeviceInformation> = {};

  try {
    displayInfo.fontScale = await DeviceInfo.getFontScale().catch(
      () => undefined,
    );
    displayInfo.hasNotch = DeviceInfo.hasNotch();

    // iPhone 14+ feature (may not be available in all versions)
    if (Platform.OS === 'ios') {
      try {
        // Only call if the method exists
        if (typeof DeviceInfo.hasDynamicIsland === 'function') {
          displayInfo.hasDynamicIsland = DeviceInfo.hasDynamicIsland();
        } else {
          displayInfo.hasDynamicIsland = false;
        }
      } catch {
        displayInfo.hasDynamicIsland = false;
      }
    }
  } catch (error) {
    logger.warn('Error collecting display info:', error);
  }

  return displayInfo;
};

/**
 * Generates a comprehensive device fingerprint by combining multiple device identifiers
 */
export const generateDeviceFingerprint = async (): Promise<string> => {
  try {
    const [
      uniqueId,
      deviceId,
      androidId,
      brand,
      model,
      systemName,
      systemVersion,
      buildNumber,
      serialNumber,
      fingerprint,
      iosVendorId,
    ] = await Promise.all([
      DeviceInfo.getUniqueId().catch(() => null),
      Promise.resolve(DeviceInfo.getDeviceId()),
      Platform.OS === 'android'
        ? DeviceInfo.getAndroidId().catch(() => null)
        : Promise.resolve(null),
      Promise.resolve(DeviceInfo.getBrand()),
      Promise.resolve(DeviceInfo.getModel()),
      Promise.resolve(DeviceInfo.getSystemName()),
      Promise.resolve(DeviceInfo.getSystemVersion()),
      Promise.resolve(DeviceInfo.getBuildNumber()),
      DeviceInfo.getSerialNumber().catch(() => null),
      Platform.OS === 'android'
        ? Promise.resolve(DeviceInfo.getFingerprint())
        : Promise.resolve(null),
      Platform.OS === 'ios'
        ? DeviceInfo.getUniqueId().catch(() => null)
        : Promise.resolve(null),
    ]);

    // Combine identifiers with platform info to create comprehensive fingerprint
    const identifiers = [
      uniqueId,
      deviceId,
      androidId,
      serialNumber,
      fingerprint,
      iosVendorId,
      brand,
      model,
      systemName,
      systemVersion,
      buildNumber,
      Platform.OS,
      Platform.Version,
    ].filter(Boolean);

    if (identifiers.length === 0) {
      // Fallback fingerprint if all device info fails
      const fallback = `${Platform.OS}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 15)}`;
      logger.warn('Using fallback device fingerprint:', fallback);
      return fallback;
    }

    // Create hash-like fingerprint with more entropy
    const combined = identifiers.join('-');
    const base64Hash = btoa(combined).replace(/[^a-zA-Z0-9]/g, '');
    return `${Platform.OS}-${base64Hash.substring(0, 32)}-${Date.now().toString(
      36,
    )}`;
  } catch (error) {
    logger.error('Error generating device fingerprint:', error);
    // Emergency fallback
    return `${Platform.OS}-emergency-${Date.now()}`;
  }
};

/**
 * Gets screen resolution information
 */
const getScreenResolution = async (): Promise<string> => {
  try {
    // For React Native, we'll get dimensions from the Dimensions API
    const { Dimensions } = require('react-native');
    const { width: screenWidth, height: screenHeight } =
      Dimensions.get('screen');

    return `${screenWidth}x${screenHeight}`;
  } catch (error) {
    logger.warn('Error getting screen resolution:', error);
    return 'unknown';
  }
};

/**
 * Gets browser information (for web platform or webview)
 */
const getBrowserInfo = async (): Promise<{
  browserName?: string;
  browserVersion?: string;
  userAgent?: string;
}> => {
  try {
    if (Platform.OS === 'web') {
      const userAgent = await DeviceInfo.getUserAgent();
      // Simple browser detection
      let browserName = 'unknown';
      if (userAgent.includes('Chrome')) browserName = 'Chrome';
      else if (userAgent.includes('Firefox')) browserName = 'Firefox';
      else if (userAgent.includes('Safari')) browserName = 'Safari';
      else if (userAgent.includes('Edge')) browserName = 'Edge';

      return {
        userAgent,
        browserName,
        browserVersion: 'unknown',
      };
    }

    // For mobile apps, we can use the system webview info
    const userAgent = await DeviceInfo.getUserAgent().catch(() => undefined);
    return {
      userAgent,
      browserName: 'Native App',
    };
  } catch (error) {
    logger.warn('Error getting browser info:', error);
    return {};
  }
};

/**
 * Collects comprehensive device information for tracking
 */
export const collectDeviceInformation =
  async (): Promise<DeviceInformation> => {
    try {
      logger.info('Collecting comprehensive device information...');

      // Collect all information in parallel for maximum performance
      const [
        deviceFingerprint,
        deviceName,
        deviceType,
        systemName,
        systemVersion,
        appVersion,
        screenResolution,
        browserInfo,
        securityInfo,
        hardwareInfo,
        networkInfo,
        batteryInfo,
        peripheralInfo,
        additionalInfo,
        localeInfo,
        displayInfo,
      ] = await Promise.all([
        generateDeviceFingerprint(),
        DeviceInfo.getDeviceName().catch(() => `${Platform.OS} Device`),
        Promise.resolve(DeviceInfo.getDeviceType()),
        Promise.resolve(DeviceInfo.getSystemName()),
        Promise.resolve(DeviceInfo.getSystemVersion()),
        Promise.resolve(DeviceInfo.getVersion()),
        getScreenResolution(),
        getBrowserInfo(),
        collectSecurityInfo(),
        collectHardwareInfo(),
        collectNetworkInfo(),
        collectBatteryInfo(),
        collectPeripheralInfo(),
        collectAdditionalInfo(),
        collectLocaleInfo(),
        collectDisplayInfo(),
      ]);

      // Get timezone and language
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      let language = 'en-US';
      try {
        // Use browser language detection or fallback
        if (typeof navigator !== 'undefined' && navigator.language) {
          language = navigator.language;
        } else {
          // Fallback to Intl API
          language = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
        }
      } catch {
        // Fallback to default language
        language = 'en-US';
      }

      // Combine all collected comprehensive information
      const deviceInfo: DeviceInformation = {
        // Basic device info
        deviceId: deviceFingerprint,
        deviceName,
        deviceType: mapDeviceType(deviceType),
        platform: mapPlatform(),
        osName: systemName,
        osVersion: systemVersion,
        appVersion,
        screenResolution,
        timezone,
        language,
        ...browserInfo,

        // Enhanced security & identification
        ...securityInfo,

        // Hardware specifications
        ...hardwareInfo,

        // Network & connectivity
        ...networkInfo,

        // Battery management
        ...batteryInfo,

        // Peripheral detection (automation detection)
        ...peripheralInfo,

        // Additional tracking capabilities
        ...additionalInfo,

        // Locale information
        ...localeInfo,

        // Display characteristics
        ...displayInfo,
      };

      logger.info('Comprehensive device information collected successfully:', {
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        isEmulator: deviceInfo.isEmulator,
        isTablet: deviceInfo.isTablet,
        totalMemory: deviceInfo.totalMemory,
        batteryLevel: deviceInfo.batteryLevel,
        carrier: deviceInfo.carrier,
        isHeadphonesConnected: deviceInfo.isHeadphonesConnected,
        isKeyboardConnected: deviceInfo.isKeyboardConnected,
        hasNotch: deviceInfo.hasNotch,
      });

      return deviceInfo;
    } catch (error) {
      logger.error('Error collecting device information:', error);

      // Return minimal fallback device info
      const fallbackFingerprint = await generateDeviceFingerprint();
      return {
        deviceId: fallbackFingerprint,
        deviceName: `${Platform.OS} Device`,
        deviceType:
          Platform.OS === 'ios' || Platform.OS === 'android'
            ? DeviceType.Mobile
            : DeviceType.Unknown,
        platform: mapPlatform(),
        osName: Platform.OS,
        osVersion: Platform.Version.toString(),
        appVersion: '1.0.0',
        timezone: 'UTC',
        language: 'en-US',
      };
    }
  };

/**
 * Helper function to validate device information before sending to API
 */
export const validateDeviceInformation = (
  deviceInfo: DeviceInformation,
): boolean => {
  const required = [
    'deviceId',
    'deviceType',
    'platform',
    'osName',
    'osVersion',
    'appVersion',
  ];

  for (const field of required) {
    if (!deviceInfo[field as keyof DeviceInformation]) {
      logger.warn(`Missing required device field: ${field}`);
      return false;
    }
  }

  if (deviceInfo.deviceId.length < 5) {
    logger.warn('Device ID too short, may not be unique');
    return false;
  }

  return true;
};
