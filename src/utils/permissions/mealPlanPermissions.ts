import {
  getPermissionLevel,
  canEdit,
  canDelete,
  canView,
  type HomeLinkedResource,
} from './homeLinkedPermissions';

/**
 * Permission flags for meal plan operations
 */
export interface MealPlanPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  canGenerateShoppingList: boolean;
  canSaveAsTemplate: boolean;
}

/**
 * Meal plan data shape needed for permission calculation.
 *
 * Owner identity is the plan's `user` (the direct-owner field the API resolves
 * OWNER from), NOT `createdBy` (the original-creator field, which is display-only
 * and can differ from the owner on home/legacy plans).
 */
interface MealPlanData extends HomeLinkedResource {
  user?: { id: string } | null;
}

/**
 * Check if the current user is the owner of the meal plan.
 *
 * Keys off `mealPlan.user.id` — gating on `createdBy` would compute the wrong
 * owner whenever the owner and original creator differ.
 */
export function isMealPlanOwner(
  mealPlan: MealPlanData,
  userId?: string,
): boolean {
  return !!mealPlan.user?.id && !!userId && mealPlan.user.id === userId;
}

/**
 * Check if a meal plan is personal (not shared with a home)
 */
export function isPersonalPlan(mealPlan: MealPlanData): boolean {
  return !mealPlan.homeId;
}

/**
 * Get permissions for a meal plan based on home membership and ownership.
 *
 * Uses the centralized HomeLinkedResource permission model:
 * - Personal plans (no homeId): full permissions
 * - Home plans: owner → full; OWNER/ADMIN → full; MEMBER → edit (no delete); GUEST → view only
 */
export function getMealPlanPermissions(
  mealPlan: MealPlanData,
  userId?: string,
): MealPlanPermissions {
  const level = getPermissionLevel(mealPlan, isMealPlanOwner(mealPlan, userId));

  return {
    canEdit: canEdit(level),
    canDelete: canDelete(level),
    canDuplicate: canEdit(level),
    canGenerateShoppingList: canView(level),
    canSaveAsTemplate: canEdit(level),
  };
}
