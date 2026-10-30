import type { ApproximateLocation as ApproximateLocationPort } from '#/platform/ports';
import { PermissionService } from '#/services/permissions/PermissionService';
import { isRecord } from '#/utils/isRecord';
import { nativeMethod } from './nativeModule';

/**
 * The device's approximate place: `ApproximateLocationModule` reads it at
 * reduced accuracy, behind the when-in-use (iOS) or coarse (Android)
 * permission. A build without the module cannot say where it is.
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
    } catch {
      return null;
    }
  },
  openSettings() {
    void PermissionService.openSettings();
  },
};
