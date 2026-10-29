import { requirePlatform } from '#platform/install';
import { useStore } from '#store';
import { useReviewPromptStore } from '#store/reviewPromptStore';
import { todayKey } from '#/utils/dateUtils';

/** Distinct days of use before the first request. */
export const DAYS_BEFORE_ASKING = 3;
/** Days between requests, whatever the OS did with the last one. */
export const DAYS_BETWEEN_REQUESTS = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

interface Pacing {
  activeDays: readonly string[];
  lastRequestedAt: number | null;
  lastRequestedVersion: string | null;
}

/** Whether a success now may ask for a rating. */
export function isDueForReview(
  pacing: Pacing,
  { now, version }: { now: number; version: string },
): boolean {
  if (pacing.activeDays.length < DAYS_BEFORE_ASKING) return false;
  if (pacing.lastRequestedVersion === version) return false;
  return (
    pacing.lastRequestedAt === null ||
    now - pacing.lastRequestedAt >= DAYS_BETWEEN_REQUESTS * DAY_MS
  );
}

/**
 * Called right after a success the user just saw (a receipt checked in, a trip
 * moved to the pantry, a recipe cooked), never after a failure. Asks the OS for
 * its rating prompt when the device is due, and records that it asked.
 */
export function askForReviewAfterSuccess(): void {
  if (!useStore.getState().user?.onBoarded) return;
  const pacing = useReviewPromptStore.getState();
  const now = Date.now();
  const version = requirePlatform('platformInfo').appVersion;
  if (!isDueForReview(pacing, { now, version })) return;
  pacing.recordRequest(now, version);
  requirePlatform('reviewPrompt').request();
}

/** Counts each day the app comes to the foreground; returns the unsubscribe. */
export function startCountingDaysOfUse(): () => void {
  return requirePlatform('appLifecycle').subscribe(state => {
    if (state === 'active') {
      useReviewPromptStore.getState().recordActiveDay(todayKey());
    }
  });
}
