import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { useStore } from '#store';
import { storage } from '#/store/deviceStorage';
import { logger } from '#/utils/environment';
import { clientVersion } from './clientIdentity';

/**
 * Tells the user their build is below the server's minimum: the host's update
 * dialog reads the latch, which blocks the app and returns on every launch
 * while refused. Every request and socket reconnect carries the refusal; only
 * the first one changes anything.
 */
export function announceClientUpgradeRequired(): void {
  useStore.getState().markClientUpgradeRequired();
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
  if (!storage.isReady()) return;
  if (storage.getString(ANNOUNCED_RECOMMENDED_KEY) === recommended) return;

  logger.info(
    `A newer client release is available (${recommended}); running ${clientVersion()}`,
  );
  toastService.info(t('appUpdate.available'));

  // Recorded after the toast, for the same reason the hard notice is.
  storage.set(ANNOUNCED_RECOMMENDED_KEY, recommended);
}
