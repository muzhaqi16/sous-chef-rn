import {
  getPermissionLevel,
  canEdit,
  canDelete,
  canView,
  type HomeLinkedResource,
} from './homeLinkedPermissions';

export interface MealPlanPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  canGenerateShoppingList: boolean;
  canSaveAsTemplate: boolean;
}

/**
 * Owner identity is the plan's `user` — the field the API resolves OWNER from —
 * NOT `createdBy`, which is display-only and can differ from the owner.
 */
interface MealPlanData extends HomeLinkedResource {
  user?: { id: string } | null;
}

/** Keys off `mealPlan.user.id`; `createdBy` would be the wrong owner. */
export function isMealPlanOwner(
  mealPlan: MealPlanData,
  userId?: string,
): boolean {
  return !!mealPlan.user?.id && !!userId && mealPlan.user.id === userId;
}

export function isPersonalPlan(mealPlan: MealPlanData): boolean {
  return !mealPlan.homeId;
}

/** Via the shared HomeLinkedResource model: MEMBER edits but cannot delete. */
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
