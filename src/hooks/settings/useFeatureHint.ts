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

/** Under Detox: tips and the Getting started card stay out of the way. */
export const featureHintsSuppressed = (): boolean => suppressedForE2E;

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

/** What an account has done that a contextual tip waits for. */
export type TipFact = 'recipeSaved' | 'recipeAdded';

/** Notes, for the signed-in account on this device, that it did this. */
export const noteTipFact = (fact: TipFact): void => {
  const store = storeApi.getState();
  const userId = store.user?.id;
  if (userId) store.noteTipFact(userId, fact);
};

export const hasTipFact = (fact: TipFact, userId?: string): boolean =>
  !!userId && (storeApi.getState().tipFacts[userId] ?? []).includes(fact);

export const incrementLoginCount = (userId: string): void => {
  storeApi.getState().incrementLoginCount(userId);
};
