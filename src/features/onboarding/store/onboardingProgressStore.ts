import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { zustandStorage } from '#/store/deviceStorage';
import { hydrateWhenStarted } from '#store/persistedStores';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

/** A question step onboarding can reopen at after the app restarts. */
export type ResumableOnboardingStep = 'Household' | 'Dietary' | 'Receipt';

/**
 * Where creating the home, pantry and list stands while the questions are
 * answered: `invited` waits on the user's choice, `owed` on a read of the
 * account that failed, which `OwedAccountSetup` finishes.
 */
export type OnboardingSetupStatus =
  | { kind: 'reading' }
  | { kind: 'invited' }
  | { kind: 'running'; createMissingHome: boolean }
  | { kind: 'done' }
  | { kind: 'failed'; message: string; createMissingHome: boolean }
  | { kind: 'owed' };

/**
 * Whether setup will leave a pantry selected, so the kitchen step is counted
 * before it exists. Unknown, it will: only a user who joins no home gets none.
 */
export const setupExpectsPantry = (setup: OnboardingSetupStatus): boolean => {
  switch (setup.kind) {
    case 'running':
    case 'failed':
      return setup.createMissingHome;
    case 'invited':
    case 'done':
      return false;
    case 'reading':
    case 'owed':
      return true;
  }
};

/**
 * What this onboarding did that the account cannot tell afterwards: who the
 * user cooks for, the dietary needs saved, and items added to the pantry here,
 * not by another member or in an earlier session. A home and a list are read
 * from the selection instead. Kept on the device, so a restart resumes it.
 */
export interface OnboardingProgressState {
  /** How many people the user cooks for; null when not answered. */
  cooksFor: number | null;
  dietarySaved: boolean;
  /** Items a receipt's review added; a review can add in several rounds. */
  receiptItems: number;
  stapleItems: number;
  /** The furthest question reached; null before the first. */
  reachedStep: ResumableOnboardingStep | null;
  /** This launch's setup; never stored on the device. */
  setup: OnboardingSetupStatus;
  recordCooksFor: (count: number) => void;
  recordDietarySaved: (saved: boolean) => void;
  recordReceiptItems: (added: number) => void;
  /** `added` falls when a return to the step takes staples out. */
  recordStapleItems: (added: number) => void;
  recordReachedStep: (step: ResumableOnboardingStep) => void;
  setSetupStatus: (setup: OnboardingSetupStatus) => void;
}

const STEP_ORDER: readonly ResumableOnboardingStep[] = [
  'Household',
  'Dietary',
  'Receipt',
];

export const initialOnboardingProgress: Pick<
  OnboardingProgressState,
  | 'cooksFor'
  | 'dietarySaved'
  | 'receiptItems'
  | 'stapleItems'
  | 'reachedStep'
  | 'setup'
> = {
  cooksFor: null,
  dietarySaved: false,
  receiptItems: 0,
  stapleItems: 0,
  reachedStep: null,
  setup: { kind: 'reading' },
};

export const useOnboardingProgressStore = create<OnboardingProgressState>()(
  persist(
    set => ({
      ...initialOnboardingProgress,
      recordCooksFor: count => set({ cooksFor: count }),
      recordDietarySaved: saved => set({ dietarySaved: saved }),
      recordReceiptItems: added =>
        set(state => ({ receiptItems: state.receiptItems + added })),
      recordStapleItems: added =>
        set(state => ({
          stapleItems: Math.max(0, state.stapleItems + added),
        })),
      // Only forward: going back a step does not lose the steps after it.
      recordReachedStep: step =>
        set(state =>
          state.reachedStep !== null &&
          STEP_ORDER.indexOf(state.reachedStep) >= STEP_ORDER.indexOf(step)
            ? state
            : { reachedStep: step },
        ),
      setSetupStatus: setup => set({ setup }),
    }),
    {
      name: 'sous-chef-onboarding-progress',
      storage: createJSONStorage(() => zustandStorage),
      skipHydration: true,
      version: 1,
      partialize: state => ({
        cooksFor: state.cooksFor,
        dietarySaved: state.dietarySaved,
        receiptItems: state.receiptItems,
        stapleItems: state.stapleItems,
        reachedStep: state.reachedStep,
      }),
    },
  ),
);

hydrateWhenStarted(useOnboardingProgressStore);

registerSessionScopedStore('onboardingProgress', () =>
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress }),
);

/** The steps' writers. `useShallow`: the selector returns a fresh object. */
export const useRecordOnboardingProgress = () =>
  useOnboardingProgressStore(
    useShallow(state => ({
      recordCooksFor: state.recordCooksFor,
      recordDietarySaved: state.recordDietarySaved,
      recordReceiptItems: state.recordReceiptItems,
      recordStapleItems: state.recordStapleItems,
      recordReachedStep: state.recordReachedStep,
    })),
  );

/**
 * Resolves once the device copy has loaded. A write before then is saved over
 * it, and a read sees the defaults: with inline requires this module first
 * loads at its first use, so its hydration is still running then.
 */
const progressLoaded = async (): Promise<void> => {
  const stored = useOnboardingProgressStore.persist;
  if (!stored.hasHydrated()) await stored.rehydrate();
};

/** The furthest question reached, read from the device; null before any. */
export async function storedResumableStep(): Promise<ResumableOnboardingStep | null> {
  await progressLoaded();
  return useOnboardingProgressStore.getState().reachedStep;
}

/** Records a question as reached once the device copy has loaded. */
export async function recordReachedStep(
  step: ResumableOnboardingStep,
): Promise<void> {
  await progressLoaded();
  useOnboardingProgressStore.getState().recordReachedStep(step);
}
