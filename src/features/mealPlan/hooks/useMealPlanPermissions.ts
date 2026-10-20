import { useUser } from '#store/useAppStore';
import {
  getMealPlanPermissions,
  type MealPlanPermissions,
} from '#features/mealPlan/utils/mealPlanPermissions';

/** What the permission rules read off a plan, whichever query fetched it. */
type MealPlanLike = Parameters<typeof getMealPlanPermissions>[0];

/**
 * Hook that computes permissions for a meal plan based on the current user's
 * identity and home membership.
 */
export function useMealPlanPermissions(
  mealPlan: MealPlanLike | null | undefined,
): MealPlanPermissions {
  const user = useUser();

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
