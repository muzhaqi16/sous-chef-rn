import { useShallow } from 'zustand/react/shallow';
import {
  useSelectedHomeId,
  useSelectedPantryId,
  useSelectedShoppingListId,
} from '#store/useAppStore';
import { useOnboardingProgressStore } from '#features/onboarding/store/onboardingProgressStore';

/** What the "All set!" screen may say the user set up. */
export interface OnboardingSummary {
  /** A home with a pantry, created here or already in place. */
  homeAndPantry: boolean;
  /** A shopping list, created here or already in place. */
  shoppingList: boolean;
  /** Who the user cooks for; null when the question was skipped. */
  cooksFor: number | null;
  dietarySaved: boolean;
  receiptItems: number;
  stapleItems: number;
}

/**
 * The completion summary's facts. The setup step selects what it creates or
 * finds, so the selection says whether one is in place; the rest is what the
 * steps recorded in this onboarding.
 */
export function useOnboardingSummary(): OnboardingSummary {
  const homeId = useSelectedHomeId();
  const pantryId = useSelectedPantryId();
  const shoppingListId = useSelectedShoppingListId();
  const progress = useOnboardingProgressStore(
    useShallow(state => ({
      cooksFor: state.cooksFor,
      dietarySaved: state.dietarySaved,
      receiptItems: state.receiptItems,
      stapleItems: state.stapleItems,
    })),
  );
  return {
    homeAndPantry: !!homeId && !!pantryId,
    shoppingList: !!shoppingListId,
    ...progress,
  };
}
