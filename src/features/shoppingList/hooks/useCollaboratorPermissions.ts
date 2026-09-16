import { useMutation } from '@apollo/client/react';
import {
  UpdateCollaboratorRoleDocument,
  UpdateCollaboratorPermissionsDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import type { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

/** The item-level permissions a role's defaults can be overridden with. */
export interface CollabPermissions {
  canAddItems: boolean;
  canEditItems: boolean;
  canRemoveItems: boolean;
  canMarkPurchased: boolean;
}

/**
 * A collaborator's role and per-item permissions. Each resolves `true` once
 * the change took, `false` when refused — the refusal already alerted.
 */
export function useCollaboratorPermissions(shoppingListId: string) {
  const { t } = useTranslation();
  const [updateRoleMutation] = useMutation(UpdateCollaboratorRoleDocument);
  const [updatePermissionsMutation] = useMutation(
    UpdateCollaboratorPermissionsDocument,
  );

  const updateRole = async (
    collaboratorId: string,
    role: CollaboratorRole,
  ): Promise<boolean> => {
    const settled = await settleMutation(
      () =>
        updateRoleMutation({
          variables: { input: { shoppingListId, collaboratorId, role } },
        }),
      {
        document: UpdateCollaboratorRoleDocument,
        fallback: t('errors.codes.genericRetry'),
      },
    );
    return settled.status !== 'failed';
  };

  const updatePermissions = async (
    collaboratorId: string,
    permissions: CollabPermissions,
  ): Promise<boolean> => {
    const settled = await settleMutation(
      () =>
        updatePermissionsMutation({
          variables: { input: { shoppingListId, collaboratorId, permissions } },
        }),
      {
        document: UpdateCollaboratorPermissionsDocument,
        fallback: t('errors.codes.genericRetry'),
      },
    );
    return settled.status !== 'failed';
  };

  return { updateRole, updatePermissions };
}
