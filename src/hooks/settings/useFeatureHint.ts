import { storeApi } from '#store';
import { Telemetry } from '#services/telemetry';
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

/** What an account has done that a tip, or activation, waits for. */
export type TipFact =
  | 'recipeSaved'
  | 'recipeAdded'
  | 'recipeOpened'
  | 'datedItem'
  | 'activationReached';

/** How soon after sign-up both first steps count as activation. */
const ACTIVATION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Notes, for the signed-in account on this device, that it did this. An
 * account that has dated food in its pantry and has opened a recipe within
 * three days of sign-up has reached activation, sent once.
 */
export const noteTipFact = (fact: TipFact): void => {
  const user = storeApi.getState().user;
  if (!user) return;
  storeApi.getState().noteTipFact(user.id, fact);
  const facts = storeApi.getState().tipFacts[user.id] ?? [];
  if (
    facts.includes('activationReached') ||
    !facts.includes('datedItem') ||
    !facts.includes('recipeOpened')
  ) {
    return;
  }
  const createdAt = user.createdAt ? Date.parse(user.createdAt) : NaN;
  if (!(Date.now() - createdAt <= ACTIVATION_WINDOW_MS)) return;
  storeApi.getState().noteTipFact(user.id, 'activationReached');
  Telemetry.trackEvent('activation_reached', {});
};

export const hasTipFact = (fact: TipFact, userId?: string): boolean =>
  !!userId && (storeApi.getState().tipFacts[userId] ?? []).includes(fact);

export const incrementLoginCount = (userId: string): void => {
  storeApi.getState().incrementLoginCount(userId);
};
