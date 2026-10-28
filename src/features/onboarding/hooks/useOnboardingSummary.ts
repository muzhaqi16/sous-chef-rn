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
  pantryItems: boolean;
  invites: boolean;
}

/**
 * The completion summary's facts. The home, pantry and list steps select what
 * they create or find, so the selection says whether one is in place.
 */
export function useOnboardingSummary(): OnboardingSummary {
  const homeId = useSelectedHomeId();
  const pantryId = useSelectedPantryId();
  const shoppingListId = useSelectedShoppingListId();
  const pantryItems = useOnboardingProgressStore(
    state => state.pantryItemsAdded,
  );
  const invites = useOnboardingProgressStore(state => state.invitesSent);
  return {
    homeAndPantry: !!homeId && !!pantryId,
    shoppingList: !!shoppingListId,
    pantryItems,
    invites,
  };
}
