import { useMutation } from '@apollo/client/react';
import {
  UpdateCollaboratorRoleDocument,
  UpdateCollaboratorPermissionsDocument,
  type UpdateCollaboratorRoleMutation,
  type UpdateCollaboratorPermissionsMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import type { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

/** The item-level permissions a role's defaults can be overridden with. */
export interface CollabPermissions {
  canAddItems: boolean;
  canEditItems: boolean;
  canRemoveItems: boolean;
  canMarkPurchased: boolean;
}

/**
 * A collaborator's role and per-item permissions. Both return the raw result so
 * the caller can surface a refusal in its own copy — under `errorPolicy: 'all'`
 * a resolved error member does not throw.
 */
export function useCollaboratorPermissions(shoppingListId: string) {
  const [updateRoleMutation] = useMutation(UpdateCollaboratorRoleDocument);
  const [updatePermissionsMutation] = useMutation(
    UpdateCollaboratorPermissionsDocument,
  );

  const updateRole = (
    collaboratorId: string,
    role: CollaboratorRole,
  ): Promise<MutationOutcome<UpdateCollaboratorRoleMutation>> =>
    updateRoleMutation({
      variables: { input: { shoppingListId, collaboratorId, role } },
    });

  const updatePermissions = (
    collaboratorId: string,
    permissions: CollabPermissions,
  ): Promise<MutationOutcome<UpdateCollaboratorPermissionsMutation>> =>
    updatePermissionsMutation({
      variables: { input: { shoppingListId, collaboratorId, permissions } },
    });

  return { updateRole, updatePermissions };
}
