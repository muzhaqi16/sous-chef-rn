import { useUser } from '#store/useAppStore';
import type { Unmasked } from '@apollo/client/masking';
import {
  getMealPlanPermissions,
  type MealPlanPermissions,
} from '#utils/permissions/mealPlanPermissions';
import {
  type MealPlanDisplayFragment,
  type MealPlanFullFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';

// Both display and full fragments arrive materialized (unmasked) from
// useMealPlans / useMealPlan so homeId + createdBy are directly readable.
// MealPlanFull spreads MealPlanDisplay via $fragmentRefs, so the full
// variant requires `Unmasked<>` to expose homeId/createdBy at top level.
type MealPlanLike =
  | Unmasked<MealPlanDisplayFragment>
  | Unmasked<MealPlanFullFragment>;

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
