import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

/**
 * What this onboarding did that the account cannot tell afterwards: who the
 * user cooks for, the dietary needs saved, and items added to the pantry here,
 * not by another member or in an earlier session. A home and a list are read
 * from the selection instead.
 */
export interface OnboardingProgressState {
  /** How many people the user cooks for; null when not answered. */
  cooksFor: number | null;
  dietarySaved: boolean;
  /** Items a receipt's review added; a review can add in several rounds. */
  receiptItems: number;
  stapleItems: number;
  recordCooksFor: (count: number) => void;
  recordDietarySaved: (saved: boolean) => void;
  recordReceiptItems: (added: number) => void;
  recordStapleItems: (added: number) => void;
}

export const initialOnboardingProgress: Pick<
  OnboardingProgressState,
  'cooksFor' | 'dietarySaved' | 'receiptItems' | 'stapleItems'
> = {
  cooksFor: null,
  dietarySaved: false,
  receiptItems: 0,
  stapleItems: 0,
};

export const useOnboardingProgressStore = create<OnboardingProgressState>()(
  set => ({
    ...initialOnboardingProgress,
    recordCooksFor: count => set({ cooksFor: count }),
    recordDietarySaved: saved => set({ dietarySaved: saved }),
    recordReceiptItems: added =>
      set(state => ({ receiptItems: state.receiptItems + added })),
    recordStapleItems: added =>
      set(state => ({ stapleItems: state.stapleItems + added })),
  }),
);

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
    })),
  );
