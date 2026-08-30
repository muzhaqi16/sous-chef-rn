import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { storage, isStorageReady } from '#/storage/mmkv';
import { logger } from '#/utils/environment';
import { CLIENT_VERSION } from './clientIdentity';

/**
 * Tells the user their build is below the server's minimum. The refusal lands
 * on every request and every socket reconnect, so `announcedThisLaunch` plus
 * the persisted key collapse it into one alert. Keyed on the INSTALLED version,
 * so someone who updates and is still below the floor IS told again.
 */
const ANNOUNCED_VERSION_KEY = 'clientUpgradeNotice.announcedForVersion';

let announcedThisLaunch = false;

export function announceClientUpgradeRequired(): void {
  if (announcedThisLaunch) return;
  announcedThisLaunch = true;

  // Defensive only — index.js initializes storage before any React code. Fails
  // toward announcing: a duplicate alert beats a link-layer throw.
  const storageReady = isStorageReady();
  if (storageReady) {
    if (storage.getString(ANNOUNCED_VERSION_KEY) === CLIENT_VERSION) return;
  } else {
    logger.warn(
      'Client-upgrade notice fired before storage init; announcing without the per-version guard',
    );
  }

  alertService.alert(t('appUpdate.title'), t('appUpdate.message'));

  // Recorded only after the alert is raised: burning the key first would
  // silence this build permanently if the notice never reached the user.
  if (storageReady) storage.set(ANNOUNCED_VERSION_KEY, CLIENT_VERSION);
}

/**
 * The soft counterpart: a newer build exists but this one works, so a toast
 * rather than the blocking alert. Keyed on the RECOMMENDED version — the
 * server's number moves each release, so each release nudges once. Presence of
 * `clientRelease` is the whole signal; nothing here compares versions.
 */
const ANNOUNCED_RECOMMENDED_KEY = 'clientUpgradeNotice.announcedRecommended';

let announcedRecommendedThisLaunch: string | null = null;

export function announceClientReleaseAvailable(recommended: string): void {
  if (announcedRecommendedThisLaunch === recommended) return;
  announcedRecommendedThisLaunch = recommended;

  // Fails toward SILENCE, unlike the hard notice: a duplicate nudge for a
  // build that still works is pure annoyance.
  if (!isStorageReady()) return;
  if (storage.getString(ANNOUNCED_RECOMMENDED_KEY) === recommended) return;

  logger.info(
    `A newer client release is available (${recommended}); running ${CLIENT_VERSION}`,
  );
  toastService.info(t('appUpdate.available'));

  // Recorded after the toast, for the same reason the hard notice is.
  storage.set(ANNOUNCED_RECOMMENDED_KEY, recommended);
}
