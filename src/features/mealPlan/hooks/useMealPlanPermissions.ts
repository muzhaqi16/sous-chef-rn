import { useUser } from '#store/useAppStore';
import {
  getMealPlanPermissions,
  type MealPlanPermissions,
} from '#utils/permissions/mealPlanPermissions';
import { type MealPlanDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { type MealPlanMain_MealPlanFragment } from '#features/mealPlan/screens/MealPlanMain.generated';

type MealPlanLike = MealPlanDisplayFragment | MealPlanMain_MealPlanFragment;

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
