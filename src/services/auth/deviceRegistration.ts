import type {
  RegisterDeviceInput,
  UpdateDeviceInput,
} from '#/graphql/generated/schemaTypes';
import { client } from '#/apollo/client';
import { logger } from '#/utils/environment';
import {
  DeviceByDeviceIdDocument,
  RegisterDeviceDocument,
  DeleteDeviceDocument,
  UpdateDeviceDocument,
  type DeleteDeviceMutation,
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
  clearRegisteredLocale,
  clearRetiredDeviceRow,
  ensureDeviceId,
  readLegacyDeviceFingerprint,
  recordRegisteredLocale,
} from '#/storage/deviceId';
import { dropUnitSystemAnswers } from '#/apollo/utils/unitSystemAnswers';
import { registerSessionTeardown } from '#/store/sessionTeardown';
import { useStore } from '#store';
import { holdsSessionTokens } from '#store/slices/authSlice';
import { backoffDelay, sleep } from '#/utils/backoff';
import { appliedPayload } from '#/utils/errors/mutationPayload';

// Fire-and-forget: a failure never blocks a sign-in. A session end leaves the
// push token: the server pushes only to a live session bound to the device, so
// revoking the refresh token (`refreshTokenRevocation.ts`) stops delivery.

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
  data?: UpdateDeviceMutation | DeleteDeviceMutation | null;
  error?: unknown;
}): DeviceUpdateOutcome {
  if (appliedPayload(result.data)) return { status: 'ok' };
  // Any other member is a refusal the server resolved, not a success.
  const refusal =
    result.data && 'updateDevice' in result.data
      ? result.data.updateDevice
      : result.data?.deleteDevice;
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

/** Removes a device row; a row already gone answers as done (`converged`). */
async function deleteDevice(id: string): Promise<DeviceUpdateOutcome> {
  try {
    const result = await client.mutate({
      mutation: DeleteDeviceDocument,
      variables: { input: { id } },
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

/**
 * Bumped by every session end, so a registration started in a session stops
 * when it ends instead of retrying with no credentials, each retry also trying
 * a refresh that has no token to present.
 */
let sessionGeneration = 0;

// A rotation after the session ended has no credential to send it with; the
// next sign-in registers the current token.
registerSessionTeardown('devicePushToken', () => {
  sessionGeneration += 1;
  pushTokenRefreshUnsubscribe?.();
  pushTokenRefreshUnsubscribe = null;
  clearRetiredDeviceRow();
  clearRegisteredLocale();
});

/**
 * Retires a superseded identifier's row, whose push token is live and reachable
 * by no other path. After a confirmed registration, so a row always remains;
 * a failure keeps the key so the next launch retries.
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

  const outcome = await deleteDevice(row.id);
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

    // Only with permission already granted, so login never prompts; enabling
    // push in settings prompts and re-runs registration.
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
    const serverDeviceId = registerPayload.device.id;
    if (serverDeviceId) {
      pushTokenRefreshUnsubscribe?.();
      pushTokenRefreshUnsubscribe = onPushTokenRefresh(token => {
        // The server stores a blank token as none, which would clear it.
        if (token) void pushRotatedTokenToServer(serverDeviceId, token);
      });

      // A token can land after acquirePushToken timed out but before the refresh
      // listener subscribed, reaching nobody; re-checked after subscribing, so a
      // later one still hits the listener.
      if (permissionGranted) {
        const laterToken = await getPushTokenProvider().getToken();
        if (laterToken && laterToken !== acquiredToken) {
          await pushRotatedTokenToServer(serverDeviceId, laterToken);
        }
      }
    }

    logger.info('Device registered successfully:', { deviceId });
    // Until a session's first registration lands, or after the device's locale
    // changes, the pickers answered a "Device default" user in the wrong system.
    if (recordRegisteredLocale(deviceInfo.language)) {
      dropUnitSystemAnswers(client.cache);
    }
    await retireLegacyDeviceRow();
    return 'ok';
  } catch (error) {
    logger.error('Device registration error:', error);
    return 'retry';
  }
}

async function registerDeviceWithRetry(
  maxRetries = 3,
): Promise<'ok' | 'failed' | 'sessionEnded'> {
  const generation = sessionGeneration;
  // Scheduled on idle, so a session can end before the first attempt runs too.
  const sessionEnded = () =>
    generation !== sessionGeneration ||
    !holdsSessionTokens(useStore.getState());
  let attempts = 0;
  while (attempts < maxRetries) {
    if (sessionEnded()) return 'sessionEnded';
    attempts++;
    const outcome = await registerDeviceOnce();
    if (outcome === 'ok') return 'ok';
    if (outcome === 'unretryable') return 'failed';
    if (attempts < maxRetries) {
      const delay = backoffDelay(attempts, { baseMs: 1000 });
      logger.info(`Device registration retry in ${delay}ms...`);
      await sleep(delay);
    }
  }
  logger.warn(`Device registration failed after ${maxRetries} attempts`);
  return 'failed';
}

export function registerDeviceInBackground(): void {
  registerDeviceWithRetry(3)
    .then(outcome => {
      if (outcome === 'failed') {
        logger.warn('Background device registration failed');
      }
    })
    .catch(error => {
      logger.error('Background device registration error:', error);
    });
}
