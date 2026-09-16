import {
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
 * Mirrors the API: editing and deleting a template both require EDIT (owner,
 * or a home MEMBER and above); duplicating needs only VIEW.
 */
export function getMealTemplatePermissions(
  template: MealTemplateData,
  userId: string | undefined,
): MealTemplatePermissions {
  const isCreator = !!userId && template.user?.id === userId;
  const level = getPermissionLevel(template, isCreator);

  return {
    canEdit: canEdit(level),
    canDelete: canEdit(level),
    canDuplicate: canView(level),
  };
}
