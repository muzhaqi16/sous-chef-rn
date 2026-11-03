import type { ApproximateLocation as ApproximateLocationPort } from '#/platform/ports';
import { PermissionService } from '#/services/permissions/PermissionService';
import { Telemetry } from '#/services/telemetry';
import { isRecord } from '#/utils/isRecord';
import { nativeMethod } from './nativeModule';

/** Location off, or not allowed: a read that nothing but Settings can change. */
const UNAVAILABLE = 'location_unavailable';

/** A failed read names what it tried; a place never reaches a log. */
function reportFailedRead(error: unknown) {
  const { code, message } = isRecord(error)
    ? error
    : { code: undefined, message: undefined };
  const reason = typeof code === 'string' ? code : 'unknown';
  Telemetry.warn('Location read failed', {
    reason,
    tried: typeof message === 'string' ? message : 'unknown',
  });
  return reason === UNAVAILABLE ? 'off' : null;
}

/**
 * The device's approximate place: `ApproximateLocationModule` answers with one
 * it already holds, else reads at reduced accuracy, behind the when-in-use (iOS)
 * or coarse (Android) permission. A build without the module cannot say where
 * it is.
 */
export const ApproximateLocation: ApproximateLocationPort = {
  async access() {
    const status = await PermissionService.check('location');
    // "denied" here is one the OS can still ask about.
    return status === 'denied' || status === 'undetermined' ? null : status;
  },
  async requestAccess() {
    const status = await PermissionService.request('location');
    return status === 'undetermined' ? 'denied' : status;
  },
  async currentPlace() {
    const read = nativeMethod(
      'ApproximateLocationModule',
      'getCurrentPosition',
    );
    if (!read) return null;
    try {
      const position: unknown = await read();
      if (!isRecord(position)) return null;
      const { lat, lng } = position;
      return typeof lat === 'number' && typeof lng === 'number'
        ? { lat, lng }
        : null;
    } catch (error) {
      return reportFailedRead(error);
    }
  },
  openSettings() {
    void PermissionService.openSettings();
  },
};
