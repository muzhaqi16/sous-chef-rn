import { useAuthUser } from '#hooks/auth/useAuthUser';
import {
  getMealTemplatePermissions,
  type MealTemplatePermissions,
} from '#utils/permissions/mealTemplatePermissions';
import type { MealTemplateDisplayFragment } from '#generated';

const NO_PERMISSIONS: MealTemplatePermissions = {
  canEdit: false,
  canDelete: false,
  canCreatePlanFromTemplate: false,
};

/**
 * Hook that computes permissions for a meal template based on the current
 * user's identity and home membership.
 */
export function useMealTemplatePermissions(
  template: MealTemplateDisplayFragment | null | undefined,
): MealTemplatePermissions {
  const user = useAuthUser();

  if (!template) {
    return NO_PERMISSIONS;
  }

  return getMealTemplatePermissions(template, user?.id);
}
