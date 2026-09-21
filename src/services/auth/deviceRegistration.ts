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
  clearRetiredDeviceRow,
  ensureDeviceId,
  readLegacyDeviceFingerprint,
} from '#/storage/deviceId';
import { registerSessionTeardown } from '#/store/sessionTeardown';
import { appliedPayload } from '#/utils/errors/mutationPayload';

// Registering THIS device with the server. Fire-and-forget: a failure here must
// never block a sign-in. A session end leaves the push token in place: the
// server pushes only to a live session bound to the device, so revoking the
// refresh token (`refreshTokenRevocation.ts`) is what stops delivery.

/**
 * `undefined` leaves the server's stored push token alone; `null` clears it.
 * Revoking OS notifications does not invalidate an FCM token, so the device is
 * the only party that can tell the server to stop treating it as reachable.
 */
const isJsonInput = (value: unknown): value is JsonInput =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  typeof value === 'object';

function parseJsonInput(raw: string): JsonInput | undefined {
  const parsed: unknown = JSON.parse(raw);
  return isJsonInput(parsed) ? parsed : undefined;
}

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
          ? parseJsonInput(deviceInfo.powerState)
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
  if (appliedPayload(result.data)) return { status: 'ok' };
  // Any other member is a refusal the server resolved, not a success.
  const refusal = result.data?.updateDevice;
  if (!refusal || !('code' in refusal)) {
    return { status: 'failed', error: result.error ?? null };
  }
  return { status: 'refused', code: refusal.code, message: refusal.message };
}

async function updateDevice(
  input: UpdateDeviceInput,
): Promise<DeviceUpdateOutcome> {
  try {
    // The response is a bare `device { id }` nothing reads.
    const result = await client.mutate({
      mutation: UpdateDeviceDocument,
      variables: { input },
      fetchPolicy: 'no-cache',
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

// A rotation after the session ended has no credential to send it with; the
// next sign-in registers the current token.
registerSessionTeardown('devicePushToken', () => {
  pushTokenRefreshUnsubscribe?.();
  pushTokenRefreshUnsubscribe = null;
  clearRetiredDeviceRow();
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

  // `errorPolicy: 'all'` RESOLVES a refused lookup with no data, so an absent
  // row only means "no such device" once the query itself succeeded.
  if (found.error) {
    logger.warn('Could not look up the superseded device row:', found.error);
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

    const registerPayload = appliedPayload(result.data);
    if (!registerPayload) {
      const refusal = result.data?.registerDevice;
      const message = refusal && 'message' in refusal ? refusal.message : null;
      logger.error('Device registration failed:', message);
      return 'retry';
    }

    // Keep the server token current: the OS rotates push tokens periodically, so
    // subscribe once and updateDevice on each rotation. This is the server's
    // row id, not the identity the device presents.
    const serverDeviceId = registerPayload.device?.id;
    if (serverDeviceId) {
      pushTokenRefreshUnsubscribe?.();
      pushTokenRefreshUnsubscribe = onPushTokenRefresh(token => {
        // The server stores a blank token as none, which would clear it.
        if (token) void pushRotatedTokenToServer(serverDeviceId, token);
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
