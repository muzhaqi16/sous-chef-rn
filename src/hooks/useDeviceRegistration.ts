import { useCallback, useState } from 'react';
import { collectDeviceInformation, validateDeviceInformation, type DeviceInformation } from '#/utils/deviceInfo';
import { logger } from '#/utils/environment';
import { useErrorHandler } from '#/utils/errorHandling';
import { useRegisterDeviceMutation, DeviceRegistrationInput } from '#generated';

interface DeviceRegistrationState {
  isRegistering: boolean;
  lastRegisteredDevice: string | null;
  registrationError: string | null;
}

export const useDeviceRegistration = () => {
  const [state, setState] = useState<DeviceRegistrationState>({
    isRegistering: false,
    lastRegisteredDevice: null,
    registrationError: null,
  });

  const { handleApolloError } = useErrorHandler();
  const [registerDeviceMutation] = useRegisterDeviceMutation();

  /**
   * Registers the current device with the backend
   */
  const registerDevice = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({
        ...prev,
        isRegistering: true,
        registrationError: null,
      }));

      logger.info('Starting device registration...');

      // Collect device information
      const deviceInfo = await collectDeviceInformation();

      // Validate device information
      if (!validateDeviceInformation(deviceInfo)) {
        throw new Error('Invalid device information collected');
      }

      logger.info('Device information validated, registering with backend...');

      // Map comprehensive device information to GraphQL input fields
      // Note: Fields collected but not yet in API schema are logged below for future addition
      const deviceInput: DeviceRegistrationInput = {
        // Core device identification
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,

        // System information
        osName: deviceInfo.osName,
        osVersion: deviceInfo.osVersion,
        appVersion: deviceInfo.appVersion,
        systemVersion: deviceInfo.systemVersion,
        readableVersion: deviceInfo.readableVersion,
        buildNumber: deviceInfo.buildNumber,
        bundleId: deviceInfo.bundleId,

        // Browser/web information
        userAgent: deviceInfo.userAgent,
        browserName: deviceInfo.browserName,
        browserVersion: deviceInfo.browserVersion,

        // Display and locale
        screenResolution: deviceInfo.screenResolution,
        timezone: deviceInfo.timezone,
        language: deviceInfo.language,
        hasNotch: deviceInfo.hasNotch,
        hasDynamicIsland: deviceInfo.hasDynamicIsland,

        // Device identification & security
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        brand: deviceInfo.brand,
        isEmulator: deviceInfo.isEmulator,
        isTablet: deviceInfo.isTablet,
        androidId: deviceInfo.androidId,
        instanceId: deviceInfo.instanceId,
        apiLevel: deviceInfo.apiLevel,

        // Hardware specifications
        totalMemory: deviceInfo.totalMemory,
        usedMemory: deviceInfo.usedMemory,
        maxMemory: deviceInfo.maxMemory,
        totalDiskCapacity: deviceInfo.totalDiskCapacity,
        freeDiskStorage: deviceInfo.freeDiskStorage,
        supportedAbis: deviceInfo.supportedAbis,

        // Network information
        lastIpAddress: deviceInfo.deviceIpAddress,
        lastCountry: deviceInfo.country,
        carrier: deviceInfo.carrier,
        isAirplaneMode: deviceInfo.isAirplaneMode,
        isLocationEnabled: deviceInfo.isLocationEnabled,
        availableLocationProviders: deviceInfo.availableLocationProviders,
        hostNames: deviceInfo.hostNames,

        // Battery management
        batteryLevel: deviceInfo.batteryLevel,
        isBatteryCharging: deviceInfo.isBatteryCharging,
        powerState: deviceInfo.powerState ? JSON.parse(deviceInfo.powerState) : undefined,

        // Peripheral detection (automation/bot detection)
        isHeadphonesConnected: deviceInfo.isHeadphonesConnected,
        isKeyboardConnected: deviceInfo.isKeyboardConnected,
        isMouseConnected: deviceInfo.isMouseConnected,

        // Additional tracking
        supportedMediaTypes: deviceInfo.supportedMediaTypes,
      };

      // Fields collected but NOT yet in API schema - add these to the backend:
      // - fontScale: number (display font scaling factor)
      // - firstInstallTime: string (ISO date of first app install)
      // - lastUpdateTime: string (ISO date of last app update)
      // - serialNumber: string (device serial number - Android)
      // - deviceFingerprint: string (Android build fingerprint)
      // - securityPatch: string (Android security patch level)
      // - iosVendorId: string (iOS vendor identifier)
      // - currency: string (user's currency preference)
      if (__DEV__) {
        logger.debug('Device fields collected but not in API schema:', {
          fontScale: deviceInfo.fontScale,
          firstInstallTime: deviceInfo.firstInstallTime,
          lastUpdateTime: deviceInfo.lastUpdateTime,
          serialNumber: deviceInfo.serialNumber,
          deviceFingerprint: deviceInfo.deviceFingerprint,
          securityPatch: deviceInfo.securityPatch,
          iosVendorId: deviceInfo.iosVendorId,
          currency: deviceInfo.currency,
        });
      }

      // Register device with backend
      const result = await registerDeviceMutation({
        variables: {
          input: deviceInput,
        },
      });

      if (!result.data?.registerDevice) {
        throw new Error('Device registration failed - no data returned');
      }
      logger.info('Device registered successfully:', {
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,
      });

      setState(prev => ({
        ...prev,
        isRegistering: false,
        lastRegisteredDevice: deviceInfo.deviceId,
        registrationError: null,
      }));

      return true;
    } catch (error: any) {
      logger.error('Device registration failed:', error);

      const { message } = handleApolloError(error, {
        operation: 'Device Registration',
        logError: true,
      });

      setState(prev => ({
        ...prev,
        isRegistering: false,
        registrationError: message,
      }));

      // Don't throw - device registration should not block auth flow
      return false;
    }
  }, [handleApolloError, registerDeviceMutation]);

  /**
   * Registers device with retry logic
   */
  const registerDeviceWithRetry = useCallback(async (maxRetries: number = 2): Promise<boolean> => {
    let attempts = 0;

    while (attempts < maxRetries) {
      attempts++;
      logger.info(`Device registration attempt ${attempts}/${maxRetries}`);

      const success = await registerDevice();
      if (success) {
        return true;
      }

      // Wait before retry (exponential backoff)
      if (attempts < maxRetries) {
        const delay = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s...
        logger.info(`Device registration failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.warn(`Device registration failed after ${maxRetries} attempts`);
    return false;
  }, [registerDevice]);

  /**
   * Silently registers device in background (non-blocking)
   */
  const registerDeviceInBackground = useCallback((): void => {
    // Fire and forget - don't block the calling function
    // Properly handle promise to prevent unhandled rejection warnings
    registerDeviceWithRetry(3)
      .then(success => {
        if (success) {
          logger.info('Background device registration completed successfully');
        } else {
          logger.warn('Background device registration failed - will retry on next login');
        }
      })
      .catch(error => {
        // Log but don't throw - device registration is optional and shouldn't block auth
        logger.error('Background device registration error:', error);
      });
  }, [registerDeviceWithRetry]);

  /**
   * Clears device registration state
   */
  const clearDeviceRegistrationState = useCallback(() => {
    setState({
      isRegistering: false,
      lastRegisteredDevice: null,
      registrationError: null,
    });
  }, []);

  /**
   * Gets collected device information without registering
   */
  const getDeviceInformation = useCallback(async (): Promise<DeviceInformation | null> => {
    try {
      const deviceInfo = await collectDeviceInformation();
      return validateDeviceInformation(deviceInfo) ? deviceInfo : null;
    } catch (error) {
      logger.error('Error getting device information:', error);
      return null;
    }
  }, []);

  return {
    // State
    isRegistering: state.isRegistering,
    lastRegisteredDevice: state.lastRegisteredDevice,
    registrationError: state.registrationError,

    // Actions
    registerDevice,
    registerDeviceWithRetry,
    registerDeviceInBackground,
    clearDeviceRegistrationState,
    getDeviceInformation,
  };
};