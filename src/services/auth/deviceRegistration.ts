import type { RegisterDeviceInput } from '#/graphql/generated/schemaTypes';
import { client } from '#/apollo/client';
import { logger } from '#/utils/environment';
import {
  RegisterDeviceDocument,
  UpdateDeviceDocument,
} from '#operations/auth/device.generated';
import { PermissionService } from '#/services/permissions/PermissionService';
import {
  acquirePushToken,
  getPushTokenProvider,
  onPushTokenRefresh,
} from '#/services/push/pushTokenProvider';
import {
  collectDeviceInformation,
  validateDeviceInformation,
} from '#/utils/deviceInfo';

// Registering THIS device with the server, and telling it to stop on sign-out.
// Fire-and-forget: a failure here must never block a sign-in.

/**
 * `undefined` leaves the server's stored push token alone; `null` clears it.
 * Revoking OS notifications does not invalidate an FCM token, so the device is
 * the only party that can tell the server to stop treating it as reachable.
 */
function resolvePushTokenWrite(
  permissionGranted: boolean,
  acquired: string | null,
): string | null | undefined {
  if (!permissionGranted) return null;
  if (acquired) return acquired;
  return undefined;
}

function buildDeviceInput(
  deviceInfo: Awaited<ReturnType<typeof collectDeviceInformation>>,
  pushToken: string | null | undefined,
): RegisterDeviceInput {
  return {
    deviceId: deviceInfo.deviceId,
    deviceName: deviceInfo.deviceName,
    deviceType: deviceInfo.deviceType,
    platform: deviceInfo.platform,
    appVersion: deviceInfo.appVersion,
    pushToken,
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

/** Unsubscribe for the active token-refresh listener, so we don't stack them. */
let pushTokenRefreshUnsubscribe: (() => void) | null = null;

/**
 * Server-assigned device id from the most recent registration this process.
 * Captured so logout can deregister the device server-side (the local
 * `deviceInfo.deviceId` is not the server PK). Null until a registration
 * succeeds; cleared on logout.
 */
let registeredDeviceId: string | null = null;

/** Push a rotated push token to the server for the registered device. */
export async function pushRotatedTokenToServer(
  deviceId: string,
  pushToken: string,
): Promise<void> {
  try {
    await client.mutate({
      mutation: UpdateDeviceDocument,
      variables: { input: { id: deviceId, pushToken } },
      // The response is a bare `device { id }` nothing reads, and writing it
      // during a sign-out re-seeds the cache `clearStore` has emptied.
      fetchPolicy: 'no-cache',
    });
    logger.info('Device push token updated after rotation');
  } catch (error) {
    logger.error('Failed to update rotated push token:', error);
  }
}

/**
 * Stops the server pushing to a logged-out session on a shared device, via
 * `updateDevice(delete: true)`. Forgets this module's own state too: a rotated
 * token pushed after would carry the dead session, and a stale id would
 * deregister the next account's device.
 */
export function deregisterDeviceOnLogout(): void {
  const deviceId = registeredDeviceId;
  pushTokenRefreshUnsubscribe?.();
  pushTokenRefreshUnsubscribe = null;
  registeredDeviceId = null;
  if (!deviceId) return;
  void client
    .mutate({
      mutation: UpdateDeviceDocument,
      variables: { input: { id: deviceId, delete: true } },
      // This lands AFTER `performLogoutCleanup` has cleared the store, so a
      // cache write here outlives the session it is ending.
      fetchPolicy: 'no-cache',
      context: { allowDuringLogout: true },
    })
    .then(() => logger.info('Device deregistered on logout'))
    .catch(error =>
      logger.warn('Failed to deregister device on logout:', error),
    );
}

async function registerDeviceOnce(): Promise<boolean> {
  try {
    const deviceInfo = await collectDeviceInformation();
    if (!validateDeviceInformation(deviceInfo)) {
      logger.error('Invalid device information collected');
      return false;
    }

    // Acquire the push token only when OS notification permission is already
    // granted, so login never triggers the permission prompt. The prompt happens
    // in-context when the user enables push in settings, which then re-runs
    // registration to deliver the token.
    const notificationStatus = await PermissionService.check('notifications');
    const permissionGranted = notificationStatus === 'granted';
    const acquiredToken = permissionGranted ? await acquirePushToken() : null;

    const result = await client.mutate({
      mutation: RegisterDeviceDocument,
      variables: {
        input: buildDeviceInput(
          deviceInfo,
          resolvePushTokenWrite(permissionGranted, acquiredToken),
        ),
      },
    });

    const registerPayload = result.data?.registerDevice;
    if (registerPayload?.__typename !== 'RegisterDevicePayload') {
      const message =
        registerPayload && 'message' in registerPayload
          ? registerPayload.message
          : null;
      logger.error('Device registration failed:', message);
      return false;
    }

    // Keep the server token current: the OS rotates push tokens periodically, so
    // subscribe once and updateDevice on each rotation.
    const deviceId = registerPayload.device?.id;
    if (deviceId) {
      registeredDeviceId = deviceId;
      pushTokenRefreshUnsubscribe?.();
      pushTokenRefreshUnsubscribe = onPushTokenRefresh(token => {
        void pushRotatedTokenToServer(deviceId, token);
      });

      // Close the getToken-timeout dead window: the OS can deliver a token after
      // acquirePushToken's timeout resolved null but before the refresh listener
      // subscribed just above — that token is cached yet was pushed to nobody.
      // Re-check now (after subscribing, so any later arrival still hits the
      // listener) and update the device if a token has since materialized.
      if (permissionGranted) {
        const laterToken = await getPushTokenProvider().getToken();
        if (laterToken && laterToken !== acquiredToken) {
          await pushRotatedTokenToServer(deviceId, laterToken);
        }
      }
    }

    logger.info('Device registered successfully:', {
      deviceId: deviceInfo.deviceId,
    });
    return true;
  } catch (error) {
    logger.error('Device registration error:', error);
    return false;
  }
}

async function registerDeviceWithRetry(maxRetries = 3): Promise<boolean> {
  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    const success = await registerDeviceOnce();
    if (success) return true;
    if (attempts < maxRetries) {
      const delay = Math.pow(2, attempts) * 1000;
      logger.info(`Device registration retry in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  logger.warn(`Device registration failed after ${maxRetries} attempts`);
  return false;
}

export function registerDeviceInBackground(): void {
  registerDeviceWithRetry(3)
    .then(success => {
      if (!success) {
        logger.warn('Background device registration failed');
      }
    })
    .catch(error => {
      logger.error('Background device registration error:', error);
    });
}
