import {
  getPermissionLevel,
  canEdit,
  canDelete,
  canView,
  type HomeLinkedResource,
} from './homeLinkedPermissions';

/**
 * Permission flags for meal template operations
 */
export interface MealTemplatePermissions {
  canEdit: boolean;
  canDelete: boolean;
  canCreatePlanFromTemplate: boolean;
}

/**
 * Meal template data shape needed for permission calculation
 */
interface MealTemplateData extends HomeLinkedResource {
  user?: { id: string } | null;
}

/**
 * Check if the current user is the creator of the template
 */
export function isTemplateCreator(
  template: MealTemplateData,
  userId?: string,
): boolean {
  return !!template.user?.id && !!userId && template.user.id === userId;
}

/**
 * Get permissions for a meal template based on home membership and ownership.
 *
 * Uses the centralized HomeLinkedResource permission model:
 * - Personal templates (no homeId): full permissions
 * - Home templates: creator → full; OWNER/ADMIN → full; MEMBER → edit (no delete); GUEST → view only
 */
export function getMealTemplatePermissions(
  template: MealTemplateData,
  userId?: string,
): MealTemplatePermissions {
  const level = getPermissionLevel(
    template,
    isTemplateCreator(template, userId),
  );

  return {
    canEdit: canEdit(level),
    canDelete: canDelete(level),
    canCreatePlanFromTemplate: canView(level),
  };
}
