import { storeApi } from '#store';

const FEATURE_HINT_PREFIX = 'feature_hint_shown_';

// Per-account: tutorials show once for each logged-in user. Switching to a
// different account resets the tutorial state for that account.
const buildStorageKey = (userId: string | undefined, featureId: string) =>
  userId
    ? `${FEATURE_HINT_PREFIX}${userId}_${featureId}`
    : `${FEATURE_HINT_PREFIX}${featureId}`;

/**
 * Under Detox every hint reports as already shown: the overlay dims the screen
 * and swallows taps on a 2s delay, producing `View is not hittable` on every
 * tab. Deliberately NOT persisted — it suppresses display for this process only,
 * so a test that wants to assert the tutorial can still reset and drive it.
 */
let suppressedForE2E = false;

export const suppressFeatureHintsForE2E = (): void => {
  suppressedForE2E = true;
};

export const hasFeatureHintBeenShown = (
  featureId: string,
  userId?: string,
): boolean => {
  if (suppressedForE2E) return true;
  return (
    storeApi.getState().featureHintsShown[buildStorageKey(userId, featureId)] ??
    false
  );
};

/** Clears every hint, for all users. */
export const resetAllFeatureHints = (): void => {
  const store = storeApi.getState();
  store.clearAllFeatureHints();
  // Set synchronously — the server sync is async, and the hooks re-read the
  // moment the generation below bumps.
  store.setShowTutorials(true);
  store.bumpTutorialResetGeneration();
};

export const incrementLoginCount = (userId: string): void => {
  storeApi.getState().incrementLoginCount(userId);
};
