import { requirePlatform } from '#platform/install';
import { useStore } from '#store';
import { useReviewPromptStore } from '#store/reviewPromptStore';
import { lastTroubleAt, whenToastsQuiet } from '#/services/toastService';
import { todayKey } from '#/utils/dateUtils';

/** Distinct days of use before the first request. */
export const DAYS_BEFORE_ASKING = 3;
/** Days between requests, whatever the OS did with the last one. */
export const DAYS_BETWEEN_REQUESTS = 120;
/** Quiet after the last toast before asking, so its Undo is never covered. */
export const QUIET_MS = 4_000;
/** No request this soon after an error or alert the person saw. */
export const CALM_AFTER_TROUBLE_MS = 30 * 60 * 1000;

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

/** Whether the person may be asked now: due, in front, and untroubled. */
function mayAskNow(now: number): boolean {
  if (!useStore.getState().user?.onBoarded) return false;
  if (requirePlatform('appLifecycle').current() !== 'active') return false;
  const trouble = lastTroubleAt();
  if (trouble !== null && now - trouble < CALM_AFTER_TROUBLE_MS) return false;
  return isDueForReview(useReviewPromptStore.getState(), {
    now,
    version: requirePlatform('platformInfo').appVersion,
  });
}

let waiting: (() => void) | null = null;

/**
 * Called right after a success the user just saw (a receipt checked in, a trip
 * moved to the pantry, a recipe cooked), never after a failure. The OS's rating
 * prompt is asked for once that success's toasts have gone, and only when the
 * device is due and the person has seen no trouble lately; the request is
 * recorded.
 */
export function askForReviewAfterSuccess(): void {
  if (waiting || !mayAskNow(Date.now())) return;
  waiting = whenToastsQuiet(QUIET_MS, () => {
    waiting = null;
    const now = Date.now();
    if (!mayAskNow(now)) return;
    useReviewPromptStore
      .getState()
      .recordRequest(now, requirePlatform('platformInfo').appVersion);
    requirePlatform('reviewPrompt').request();
  });
}

/** Counts each day the app comes to the foreground; returns the unsubscribe. */
export function startCountingDaysOfUse(): () => void {
  return requirePlatform('appLifecycle').subscribe(state => {
    if (state === 'active') {
      useReviewPromptStore.getState().recordActiveDay(todayKey());
    }
  });
}
