import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

/**
 * What this onboarding did that the account cannot tell afterwards: items
 * added to the pantry and invitations sent here, not by another member or in an
 * earlier session. A home and a list are read from the selection instead.
 */
export interface OnboardingProgressState {
  pantryItemsAdded: boolean;
  invitesSent: boolean;
  recordPantryItemsAdded: () => void;
  recordInvitesSent: () => void;
}

export const initialOnboardingProgress = {
  pantryItemsAdded: false,
  invitesSent: false,
};

export const useOnboardingProgressStore = create<OnboardingProgressState>()(
  set => ({
    ...initialOnboardingProgress,
    recordPantryItemsAdded: () => set({ pantryItemsAdded: true }),
    recordInvitesSent: () => set({ invitesSent: true }),
  }),
);

registerSessionScopedStore('onboardingProgress', () =>
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress }),
);

/** The steps' writers. `useShallow`: the selector returns a fresh object. */
export const useRecordOnboardingProgress = () =>
  useOnboardingProgressStore(
    useShallow(state => ({
      recordPantryItemsAdded: state.recordPantryItemsAdded,
      recordInvitesSent: state.recordInvitesSent,
    })),
  );
