import type {
  RegisterDeviceInput,
  UpdateDeviceInput,
} from '#/graphql/generated/schemaTypes';
import { client } from '#/apollo/client';
import { logger } from '#/utils/environment';
import {
  DeviceByDeviceIdDocument,
  RegisterDeviceDocument,
  UpdateDeviceDocument,
  type UpdateDeviceMutation,
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
import {
  clearLegacyDeviceFingerprint,
  ensureDeviceId,
  getDeviceId,
  readLegacyDeviceFingerprint,
} from '#/storage/deviceId';
import { registerSessionTeardown } from '#/store/sessionTeardown';
import { useStore } from '#store';

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
  deviceId: string,
  pushToken: string | null | undefined,
): RegisterDeviceInput {
  return {
    deviceId,
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

/**
 * `updateDevice` is errors-as-data: every refusal in its result union RESOLVES,
 * so a caller reading only the absence of a throw reports a change the server
 * declined to make.
 */
export type DeviceUpdateOutcome =
  | { status: 'ok' }
  | { status: 'refused'; code: string | null; message: string | null }
  | { status: 'failed'; error: unknown };

// Separate from `updateDevice` because the optional chaining here is a value
// block, and one inside a `try` body bails the React Compiler out of the whole
// function.
function readDeviceUpdate(result: {
  data?: UpdateDeviceMutation | null;
  error?: unknown;
}): DeviceUpdateOutcome {
  const payload = result.data?.updateDevice;
  if (payload?.__typename === 'UpdateDevicePayload') return { status: 'ok' };
  if (!payload) return { status: 'failed', error: result.error ?? null };
  return {
    status: 'refused',
    code: payload.code ?? null,
    message: payload.message ?? null,
  };
}

async function updateDevice(
  input: UpdateDeviceInput,
  context?: Record<string, unknown>,
): Promise<DeviceUpdateOutcome> {
  try {
    // The response is a bare `device { id }` nothing reads, and writing it
    // during a sign-out re-seeds the cache `clearStore` has emptied.
    const result = await client.mutate({
      mutation: UpdateDeviceDocument,
      variables: { input },
      fetchPolicy: 'no-cache',
      context,
    });
    return readDeviceUpdate(result);
  } catch (error) {
    return { status: 'failed', error };
  }
}

/** Push a rotated push token to the server for the registered device. */
export async function pushRotatedTokenToServer(
  deviceId: string,
  pushToken: string,
): Promise<void> {
  const outcome = await updateDevice({ id: deviceId, pushToken });
  if (outcome.status === 'ok') {
    logger.info('Device push token updated after rotation');
    return;
  }
  logger.error('Failed to update rotated push token:', outcome);
}

/** This device's server row, for a session that ends before it registered. */
async function findDeviceRowId(): Promise<string | null> {
  // Offline the lookup cannot succeed, and httpLink's abort plus retryLink's
  // attempts would spend ~30s establishing that.
  if (useStore.getState().isOnline === false) return null;

  const deviceId = getDeviceId();
  if (!deviceId) return null;

  let found;
  try {
    found = await client.query({
      query: DeviceByDeviceIdDocument,
      variables: { deviceId },
      fetchPolicy: 'network-only',
      context: { allowDuringLogout: true },
    });
  } catch (error) {
    logger.warn('Could not resolve this device row:', error);
    return null;
  }
  return found.data?.deviceByDeviceId?.id ?? null;
}

/**
 * Stops the server pushing to a session that has ended. The device row itself
 * survives: removing it revokes the device credential that lets biometric
 * sign-in recover from a deliberate sign-out.
 */
async function clearDevicePushToken(): Promise<void> {
  const registered = registeredDeviceId;
  pushTokenRefreshUnsubscribe?.();
  pushTokenRefreshUnsubscribe = null;
  registeredDeviceId = null;

  // A shared device is a delivery target whether or not THIS launch got as far
  // as registering, so the row is resolved rather than assumed.
  const rowId = registered ?? (await findDeviceRowId());
  if (!rowId) return;

  // This lands AFTER `performLogoutCleanup` has cleared the store, so a cache
  // write here outlives the session it is ending.
  const outcome = await updateDevice(
    { id: rowId, clearPushToken: true },
    { allowDuringLogout: true },
  );
  if (outcome.status === 'ok') {
    logger.info('Device push token cleared on session end');
    return;
  }
  // A session the SERVER ended has already had its access token refused, so a
  // refusal here is the expected outcome rather than an incident.
  logger.warn('Failed to clear the device push token on session end:', outcome);
}

// Every path that ends a session, not only the sign-out the user asked for: a
// server-ended session leaves the same live delivery target behind.
// Fire-and-forget, so a round trip cannot hold the rest of the teardown.
registerSessionTeardown('devicePushToken', () => {
  void clearDevicePushToken().catch(error =>
    logger.warn('Device push-token teardown failed:', error),
  );
});

/**
 * Retire the row a superseded identifier registered: its push token is live and
 * no other client path reaches it. Runs after a confirmed registration, so the
 * account is never left with no row at all, and leaves the key in place on a
 * failure so the next launch retries.
 */
async function retireLegacyDeviceRow(): Promise<void> {
  const legacy = readLegacyDeviceFingerprint();
  if (!legacy) return;

  let found;
  try {
    found = await client.query({
      query: DeviceByDeviceIdDocument,
      variables: { deviceId: legacy },
      fetchPolicy: 'network-only',
    });
  } catch (error) {
    logger.warn('Could not look up the superseded device row:', error);
    return;
  }

  const row = found.data?.deviceByDeviceId;
  if (!row) {
    clearLegacyDeviceFingerprint();
    return;
  }

  const outcome = await updateDevice({ id: row.id, delete: true });
  if (outcome.status !== 'ok') {
    logger.warn('Could not retire the superseded device row:', outcome);
    return;
  }

  clearLegacyDeviceFingerprint();
  logger.info('Retired the superseded device row');
}

/**
 * `unretryable` is a precondition no later attempt can change, so
 * {@link registerDeviceWithRetry} stops rather than spending its backoff.
 */
type RegistrationOutcome = 'ok' | 'retry' | 'unretryable';

async function registerDeviceOnce(): Promise<RegistrationOutcome> {
  try {
    // Ahead of collectDeviceInformation's ~34 native calls: with no identity
    // there is nothing to file the registration under, and the collection would
    // be thrown away.
    const deviceId = await ensureDeviceId();
    if (!deviceId) {
      logger.warn('No device id: device storage is unavailable');
      return 'unretryable';
    }

    const deviceInfo = await collectDeviceInformation();
    if (!validateDeviceInformation(deviceInfo)) {
      logger.error('Invalid device information collected');
      return 'retry';
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
          deviceId,
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
      return 'retry';
    }

    // Keep the server token current: the OS rotates push tokens periodically, so
    // subscribe once and updateDevice on each rotation. This is the server's
    // row id, not the identity the device presents.
    const serverDeviceId = registerPayload.device?.id;
    if (serverDeviceId) {
      registeredDeviceId = serverDeviceId;
      pushTokenRefreshUnsubscribe?.();
      pushTokenRefreshUnsubscribe = onPushTokenRefresh(token => {
        void pushRotatedTokenToServer(serverDeviceId, token);
      });

      // Close the getToken-timeout dead window: the OS can deliver a token after
      // acquirePushToken's timeout resolved null but before the refresh listener
      // subscribed just above — that token is cached yet was pushed to nobody.
      // Re-check now (after subscribing, so any later arrival still hits the
      // listener) and update the device if a token has since materialized.
      if (permissionGranted) {
        const laterToken = await getPushTokenProvider().getToken();
        if (laterToken && laterToken !== acquiredToken) {
          await pushRotatedTokenToServer(serverDeviceId, laterToken);
        }
      }
    }

    logger.info('Device registered successfully:', { deviceId });
    await retireLegacyDeviceRow();
    return 'ok';
  } catch (error) {
    logger.error('Device registration error:', error);
    return 'retry';
  }
}

async function registerDeviceWithRetry(maxRetries = 3): Promise<boolean> {
  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    const outcome = await registerDeviceOnce();
    if (outcome === 'ok') return true;
    if (outcome === 'unretryable') return false;
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
