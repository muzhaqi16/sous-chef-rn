import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { storage, isStorageReady } from '#/storage/mmkv';
import { logger } from '#/utils/environment';
import { CLIENT_VERSION } from './clientIdentity';

/**
 * Tells the user their build is below the server's minimum version.
 *
 * The server refuses the operation in `didResolveOperation`, before it runs, so
 * the refusal lands on every query and every mutation — and the socket closes
 * alongside it. The raw signal therefore arrives once per in-flight request plus
 * once per reconnect attempt, which two guards collapse into one alert:
 *
 *  - `announcedThisLaunch` bounds the flood within a session.
 *  - The persisted build below bounds it across sessions.
 *
 * Keyed on the INSTALLED version rather than the server's minimum. A user who
 * ignores the alert and relaunches is not told again — they already know. A
 * user who updates but is still below the floor IS told again, because the
 * key moved. Keying on the server's minimum would get that backwards: it stays
 * put across their update, so the one person who needs telling twice never
 * hears it a second time.
 *
 * Dismissable on purpose. Nothing the app does locally clears the refusal — only
 * a store update does — so a modal the user can't close would just replace one
 * dead end with another. The copy says the app can't reach the server rather
 * than suggesting an optional update, because at this point nothing works.
 */
const ANNOUNCED_VERSION_KEY = 'clientUpgradeNotice.announcedForVersion';

let announcedThisLaunch = false;

export function announceClientUpgradeRequired(): void {
  if (announcedThisLaunch) return;
  announcedThisLaunch = true;

  // `storage` throws when touched before initializeSecureStorage() resolves.
  // index.js runs it before any React code, so this is defensive only — and it
  // fails toward announcing, since a duplicate alert beats a link-layer throw.
  const storageReady = isStorageReady();
  if (storageReady) {
    if (storage.getString(ANNOUNCED_VERSION_KEY) === CLIENT_VERSION) return;
  } else {
    logger.warn(
      'Client-upgrade notice fired before storage init; announcing without the per-version guard',
    );
  }

  alertService.alert(t('appUpdate.title'), t('appUpdate.message'));

  // Recorded only once the alert has actually been raised. Burning the key
  // first would mean a notice that never reached the user — the process dying
  // in between, or i18n not yet initialized so the copy renders as raw keys —
  // silences this build permanently, and only a store update can clear the
  // refusal it was reporting.
  if (storageReady) storage.set(ANNOUNCED_VERSION_KEY, CLIENT_VERSION);
}

/**
 * The soft counterpart: a newer build exists, but this one still works.
 *
 * Deliberately a toast rather than the alert above. The blocking copy is
 * calibrated for "nothing works"; reusing that weight for "there is a newer
 * build" is how users learn to dismiss both without reading either.
 *
 * Keyed on the RECOMMENDED version, not the installed one — the opposite of the
 * hard notice, and for the same underlying reason. Here the number that moves
 * is the server's: each new release nudges once, and a user who ignores it is
 * not nagged again until the next release. Keying on the installed version
 * instead would nudge once ever, going quiet exactly as the install fell
 * further behind.
 *
 * The server only sends `clientRelease` to a client it can show is behind, so
 * presence is the whole signal — nothing here compares versions, and there is
 * no semver dependency to get wrong.
 */
const ANNOUNCED_RECOMMENDED_KEY = 'clientUpgradeNotice.announcedRecommended';

let announcedRecommendedThisLaunch: string | null = null;

export function announceClientReleaseAvailable(recommended: string): void {
  if (announcedRecommendedThisLaunch === recommended) return;
  announcedRecommendedThisLaunch = recommended;

  // Same defensive shape as above, but this one fails toward SILENCE. A
  // duplicate nudge for a build that still works is pure annoyance, where a
  // duplicate block-notice at least tells the user something true.
  if (!isStorageReady()) return;
  if (storage.getString(ANNOUNCED_RECOMMENDED_KEY) === recommended) return;

  logger.info(
    `A newer client release is available (${recommended}); running ${CLIENT_VERSION}`,
  );
  toastService.info(t('appUpdate.available'));

  // Recorded after the toast, for the same reason the hard notice is.
  storage.set(ANNOUNCED_RECOMMENDED_KEY, recommended);
}
