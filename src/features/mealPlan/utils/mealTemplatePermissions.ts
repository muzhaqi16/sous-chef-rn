import {
  canDelete,
  canEdit,
  canView,
  getPermissionLevel,
  type HomeLinkedResource,
} from '#features/mealPlan/utils/homeLinkedPermissions';

export interface MealTemplatePermissions {
  canEdit: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
}

interface MealTemplateData extends HomeLinkedResource {
  user?: { id: string } | null;
}

/**
 * Mirrors the API, as for a meal plan: a home MEMBER edits, deleting takes
 * the creator or the home's OWNER/ADMIN, and duplicating needs only VIEW.
 */
export function getMealTemplatePermissions(
  template: MealTemplateData,
  userId: string | undefined,
): MealTemplatePermissions {
  const isCreator = !!userId && template.user?.id === userId;
  const level = getPermissionLevel(template, isCreator);

  return {
    canEdit: canEdit(level),
    canDelete: canDelete(level),
    canDuplicate: canView(level),
  };
}
