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
 * Meal plan data shape needed for permission calculation
 */
interface MealPlanData extends HomeLinkedResource {
  createdBy?: { id: string } | null;
}

/**
 * Check if the current user is the creator of the meal plan
 */
export function isMealPlanCreator(
  mealPlan: MealPlanData,
  userId?: string,
): boolean {
  return (
    !!mealPlan.createdBy?.id && !!userId && mealPlan.createdBy.id === userId
  );
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
 * - Home plans: creator → full; OWNER/ADMIN → full; MEMBER → edit (no delete); GUEST → view only
 */
export function getMealPlanPermissions(
  mealPlan: MealPlanData,
  userId?: string,
): MealPlanPermissions {
  const level = getPermissionLevel(
    mealPlan,
    isMealPlanCreator(mealPlan, userId),
  );

  return {
    canEdit: canEdit(level),
    canDelete: canDelete(level),
    canDuplicate: canEdit(level),
    canGenerateShoppingList: canView(level),
    canSaveAsTemplate: canEdit(level),
  };
}
