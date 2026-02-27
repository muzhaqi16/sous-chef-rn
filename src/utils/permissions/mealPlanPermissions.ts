import { MembershipRole } from '#generated';

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
 * Home membership shape (from MealPlanDisplay.home.myMembership)
 */
interface HomeMembership {
  role: MembershipRole;
}

/**
 * Meal plan data shape needed for permission calculation
 */
interface MealPlanData {
  homeId?: string | null;
  home?: {
    myMembership?: HomeMembership | null;
  } | null;
  createdBy?: { id: string } | null;
}

const NO_PERMISSIONS: MealPlanPermissions = {
  canEdit: false,
  canDelete: false,
  canDuplicate: false,
  canGenerateShoppingList: false,
  canSaveAsTemplate: false,
};

const FULL_PERMISSIONS: MealPlanPermissions = {
  canEdit: true,
  canDelete: true,
  canDuplicate: true,
  canGenerateShoppingList: true,
  canSaveAsTemplate: true,
};

const GUEST_PERMISSIONS: MealPlanPermissions = {
  canEdit: false,
  canDelete: false,
  canDuplicate: false,
  canGenerateShoppingList: true,
  canSaveAsTemplate: false,
};

/**
 * Check if the current user is the creator of the meal plan
 */
export function isMealPlanCreator(
  mealPlan: MealPlanData,
  userId?: string,
): boolean {
  return !!mealPlan.createdBy?.id && !!userId && mealPlan.createdBy.id === userId;
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
 * Rules:
 * - Personal plans (no homeId): creator gets full permissions
 * - Home plans: OWNER/ADMIN/MEMBER get full permissions, GUEST gets view + generate shopping list
 * - Creator of a home plan always gets full permissions
 */
export function getMealPlanPermissions(
  mealPlan: MealPlanData,
  userId?: string,
): MealPlanPermissions {
  // Personal plans: creator gets full permissions
  if (isPersonalPlan(mealPlan)) {
    return FULL_PERMISSIONS;
  }

  // Home plans: check if user is the creator
  if (isMealPlanCreator(mealPlan, userId)) {
    return FULL_PERMISSIONS;
  }

  // Home plans: check membership role
  const membership = mealPlan.home?.myMembership;
  if (!membership) {
    return NO_PERMISSIONS;
  }

  if (membership.role === MembershipRole.Guest) {
    return GUEST_PERMISSIONS;
  }

  // OWNER/ADMIN/MEMBER get full permissions
  return FULL_PERMISSIONS;
}
