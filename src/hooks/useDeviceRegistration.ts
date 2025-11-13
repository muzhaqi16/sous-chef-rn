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

      // Map comprehensive device information to available GraphQL input fields
      // Note: Additional fields (isEmulator, manufacturer, batteryLevel, etc.) will be available
      // once the frontend GraphQL schema is updated to match the backend schema
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

        // Browser/web information
        userAgent: deviceInfo.userAgent,
        browserName: deviceInfo.browserName,
        browserVersion: deviceInfo.browserVersion,

        // Display and locale
        screenResolution: deviceInfo.screenResolution,
        timezone: deviceInfo.timezone,
        language: deviceInfo.language,

        // Network information (map to available fields)
        lastIpAddress: deviceInfo.deviceIpAddress,
        lastCountry: deviceInfo.country,
        // lastCity: deviceInfo.city, // Not available in current device info
      };

      // Log comprehensive device info that's being collected but not yet sent
      // This will be useful for debugging and will be sent once schema is updated
      logger.info('Additional device info collected (pending schema update):', {
        // Security critical
        isEmulator: deviceInfo.isEmulator,
        isTablet: deviceInfo.isTablet,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,

        // Hardware specs
        totalMemory: deviceInfo.totalMemory,
        batteryLevel: deviceInfo.batteryLevel,

        // Security IDs
        androidId: deviceInfo.androidId,
        serialNumber: deviceInfo.serialNumber,

        // Peripheral detection (automation detection)
        isHeadphonesConnected: deviceInfo.isHeadphonesConnected,
        isKeyboardConnected: deviceInfo.isKeyboardConnected,
        isMouseConnected: deviceInfo.isMouseConnected,

        // Network states
        isAirplaneMode: deviceInfo.isAirplaneMode,
        isLocationEnabled: deviceInfo.isLocationEnabled,
      });

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