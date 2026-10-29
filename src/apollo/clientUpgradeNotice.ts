import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { storage } from '#/store/deviceStorage';
import { logger } from '#/utils/environment';
import { clientVersion } from './clientIdentity';

/**
 * A newer build exists but this one works, so a toast rather than the update
 * dialog a refused build gets. Keyed on the RECOMMENDED version — the server's
 * number moves each release, so each release nudges once. Presence of
 * `clientRelease` is the whole signal; nothing here compares versions.
 */
const ANNOUNCED_RECOMMENDED_KEY = 'clientUpgradeNotice.announcedRecommended';

let announcedRecommendedThisLaunch: string | null = null;

export function announceClientReleaseAvailable(recommended: string): void {
  if (announcedRecommendedThisLaunch === recommended) return;
  announcedRecommendedThisLaunch = recommended;

  // Fails toward SILENCE: a duplicate nudge for a build that still works is
  // pure annoyance.
  if (!storage.isReady()) return;
  if (storage.getString(ANNOUNCED_RECOMMENDED_KEY) === recommended) return;

  logger.info(
    `A newer client release is available (${recommended}); running ${clientVersion()}`,
  );
  toastService.info(t('appUpdate.available'));

  // Recorded only after the toast: burning the key first would silence this
  // release for good if the nudge never reached the user.
  storage.set(ANNOUNCED_RECOMMENDED_KEY, recommended);
}
