;
import { useAuth } from '#hooks/auth/useAuth';
import {
  getMealPlanPermissions,
  type MealPlanPermissions,
} from '#utils/permissions/mealPlanPermissions';
import type { MealPlanDisplayFragment, MealPlanFullFragment } from '#generated';

type MealPlanLike = MealPlanDisplayFragment | MealPlanFullFragment;

/**
 * Hook that computes permissions for a meal plan based on the current user's
 * identity and home membership.
 */
export function useMealPlanPermissions(
  mealPlan: MealPlanLike | null | undefined,
): MealPlanPermissions {
  const { user } = useAuth();

  return (() => {
    if (!mealPlan) {
      return {
        canEdit: false,
        canDelete: false,
        canDuplicate: false,
        canGenerateShoppingList: false,
        canSaveAsTemplate: false,
      };
    }

    return getMealPlanPermissions(mealPlan, user?.id);
  })();
}
