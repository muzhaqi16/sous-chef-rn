import { useMutation } from '@apollo/client/react';
import { RemoveCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { removeCollaboratorFromShoppingListCache } from '#features/shoppingList/hooks/useLeaveShoppingList';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

/**
 * Drop a collaborator from a list. The cached connection is updated in place,
 * so no refetch follows; a refusal is alerted here.
 */
export function useRemoveCollaborator(listId: string) {
  const { t } = useTranslation();
  const [removeMember, { client }] = useMutation(RemoveCollaboratorDocument);

  /** `true` once the collaborator is removed; `false` when refused. */
  const removeCollaborator = async (memberId: string): Promise<boolean> => {
    const settled = await settleMutation(
      () => removeMember({ variables: { input: { id: memberId } } }),
      {
        document: RemoveCollaboratorDocument,
        fallback: t('errors.removeMemberFailed'),
        removal: true,
      },
    );
    if (settled.status === 'failed') return false;
    // A repeat answered as not found names no collaborator, so the cache is
    // updated from the settle, not from the payload.
    removeCollaboratorFromShoppingListCache(client.cache, listId, memberId, {
      evictItem: true,
    });
    return true;
  };

  return { removeCollaborator };
}
