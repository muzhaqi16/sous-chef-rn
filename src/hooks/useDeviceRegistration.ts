import { useState } from 'react';
import {
  collectDeviceInformation,
  validateDeviceInformation,
  type DeviceInformation,
} from '#/utils/deviceInfo';
import { logger } from '#/utils/environment';
import { executeMutation, executeQuery } from '#/utils/compilerSafeWrappers';
import { useErrorService } from '#/services/errorService';
import { useMutation } from '@apollo/client/react';
import { RegisterDeviceDocument } from '../graphql/operations/auth/device.generated';
import { type DeviceRegistrationInput } from '../graphql/generated/schemaTypes';

interface DeviceRegistrationState {
  isRegistering: boolean;
  lastRegisteredDevice: string | null;
  registrationError: string | null;
}

// --- Module-level helper (outside hook body for React Compiler) ---

async function registerDeviceImpl(
  registerDeviceMutation: (opts: any) => Promise<any>,
  handleApolloError: ReturnType<typeof useErrorService>['handleApolloError'],
  setState: React.Dispatch<React.SetStateAction<DeviceRegistrationState>>,
): Promise<boolean> {
  setState(prev => ({
    ...prev,
    isRegistering: true,
    registrationError: null,
  }));

  logger.info('Starting device registration...');

  const result = await executeMutation(
    async () => {
      const deviceInfo = await collectDeviceInformation();

      if (!validateDeviceInformation(deviceInfo)) {
        throw new Error('Invalid device information collected');
      }

      logger.info('Device information validated, registering with backend...');

      const deviceInput: DeviceRegistrationInput = {
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

      const mutationResult = await registerDeviceMutation({
        variables: { input: deviceInput },
      });

      if (!mutationResult.data?.registerDevice?.success) {
        throw new Error(
          mutationResult.data?.registerDevice?.message ||
            'Device registration failed',
        );
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
    },
    (error: any) => {
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
    },
  );

  return result || false;
}

export const useDeviceRegistration = () => {
  const [state, setState] = useState<DeviceRegistrationState>({
    isRegistering: false,
    lastRegisteredDevice: null,
    registrationError: null,
  });

  const { handleApolloError } = useErrorService();
  const [registerDeviceMutation] = useMutation(RegisterDeviceDocument);

  /**
   * Registers the current device with the backend
   */
  const registerDevice = async (): Promise<boolean> => {
    return registerDeviceImpl(
      registerDeviceMutation,
      handleApolloError,
      setState,
    );
  };

  /**
   * Registers device with retry logic
   */
  const registerDeviceWithRetry = async (
    maxRetries: number = 2,
  ): Promise<boolean> => {
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
  };

  /**
   * Silently registers device in background (non-blocking)
   */
  const registerDeviceInBackground = (): void => {
    // Fire and forget - don't block the calling function
    // Properly handle promise to prevent unhandled rejection warnings
    registerDeviceWithRetry(3)
      .then(success => {
        if (success) {
          logger.info('Background device registration completed successfully');
        } else {
          logger.warn(
            'Background device registration failed - will retry on next login',
          );
        }
      })
      .catch(error => {
        // Log but don't throw - device registration is optional and shouldn't block auth
        logger.error('Background device registration error:', error);
      });
  };

  /**
   * Clears device registration state
   */
  const clearDeviceRegistrationState = () => {
    setState({
      isRegistering: false,
      lastRegisteredDevice: null,
      registrationError: null,
    });
  };

  /**
   * Gets collected device information without registering
   */
  const getDeviceInformation = async (): Promise<DeviceInformation | null> => {
    const deviceInfo = await executeQuery(
      () => collectDeviceInformation(),
      'Error getting device information',
    );
    return deviceInfo && validateDeviceInformation(deviceInfo)
      ? deviceInfo
      : null;
  };

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
