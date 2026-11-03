import type { ApproximateLocation as ApproximateLocationPort } from '#/platform/ports';
import { PermissionService } from '#/services/permissions/PermissionService';
import { Telemetry } from '#/services/telemetry';
import { isRecord } from '#/utils/isRecord';
import { nativeMethod } from './nativeModule';

const MODULE = 'ApproximateLocationModule';

/** Location off, or not allowed: a read that nothing but Settings can change. */
const UNAVAILABLE = 'location_unavailable';

/** A town is enough, so a place this recent answers without a new reading. */
const RECENT_MS = 10 * 60 * 1000;
/** A reading not back by then gives way to an older place. */
const READING_MS = 10 * 1000;
const SAME_DAY_MS = 24 * 60 * 60 * 1000;

type Place = { lat: number; lng: number };

const placeOf = (value: unknown): Place | null => {
  if (!isRecord(value)) return null;
  const { lat, lng } = value;
  return typeof lat === 'number' && typeof lng === 'number'
    ? { lat, lng }
    : null;
};

const codeOf = (error: unknown) =>
  isRecord(error) && typeof error.code === 'string' ? error.code : 'unknown';

/** A failed read names what it tried; a place never reaches a log. */
function reportFailedRead(error: unknown) {
  const message = isRecord(error) ? error.message : undefined;
  const reason = codeOf(error);
  Telemetry.warn('Location read failed', {
    reason,
    tried: typeof message === 'string' ? message : 'unknown',
  });
  return reason === UNAVAILABLE ? 'off' : null;
}

const elapsed = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

/**
 * @internal The order a place is found in, on every platform: one held from the
 * last ten minutes, else a new reading, given up once `giveUp` settles, else one
 * held from the same day. `off` when location is off; null when nothing answers.
 */
export async function findPlace(
  giveUp: () => Promise<unknown>,
): Promise<Place | 'off' | null> {
  const held = nativeMethod(MODULE, 'heldPosition');
  const read = nativeMethod(MODULE, 'readPosition');
  const cancel = nativeMethod(MODULE, 'cancelRead');
  if (!held || !read || !cancel) return null;
  let refusal: unknown;
  try {
    const recent = placeOf(await held(RECENT_MS));
    if (recent) return recent;
    void giveUp().then(() => cancel());
    const fresh = placeOf(await read());
    if (fresh) return fresh;
  } catch (error) {
    refusal = error;
  }
  if (codeOf(refusal) === UNAVAILABLE) return reportFailedRead(refusal);
  const older = placeOf(
    await Promise.resolve(held(SAME_DAY_MS)).catch(() => null),
  );
  return older ?? reportFailedRead(refusal);
}

/**
 * The device's approximate place, by `findPlace`: `ApproximateLocationModule`
 * reads at reduced accuracy, behind the when-in-use (iOS) or coarse (Android)
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
  currentPlace() {
    return findPlace(() => elapsed(READING_MS));
  },
  openSettings() {
    void PermissionService.openSettings();
  },
};
