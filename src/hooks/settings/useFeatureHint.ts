import { storeApi } from '#store';
import { featureHintKey } from '#store/slices/tutorialSlice';

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

/** Per account: each account on a device sees each hint once. */
export const hasFeatureHintBeenShown = (
  featureId: string,
  userId?: string,
): boolean => {
  if (suppressedForE2E) return true;
  return (
    storeApi.getState().featureHintsShown[featureHintKey(userId, featureId)] ??
    false
  );
};

export const markFeatureHintShown = (
  featureId: string,
  userId?: string,
): void => {
  storeApi.getState().markFeatureHintShown(featureHintKey(userId, featureId));
};

/**
 * "Replay tips": every tour and tip for this account shows again. Other
 * accounts on the device keep their progress.
 */
export const replayTipsFor = (userId: string): void => {
  const store = storeApi.getState();
  store.clearTipsFor(userId);
  store.bumpTutorialResetGeneration();
};

export const incrementLoginCount = (userId: string): void => {
  storeApi.getState().incrementLoginCount(userId);
};
