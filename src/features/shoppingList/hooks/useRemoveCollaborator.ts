import { useMutation } from '@apollo/client/react';
import { RemoveCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { removeCollaboratorFromShoppingListCache } from '#features/shoppingList/hooks/useLeaveShoppingList';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';

/**
 * Drop a collaborator from a list. The cached connection is updated in place,
 * so no refetch follows; a refusal is alerted here.
 */
export function useRemoveCollaborator(listId: string) {
  const { t } = useTranslation();
  const [removeMember] = useMutation(RemoveCollaboratorDocument);

  /** `true` once the collaborator is removed; `false` when refused. */
  const removeCollaborator = async (memberId: string): Promise<boolean> => {
    const settled = await settleMutation(
      () =>
        removeMember({
          variables: { input: { id: memberId } },
          update(cache, { data }) {
            // Only evict on success — a resolved error must not remove the
            // collaborator from the cache.
            if (!appliedPayload(data)) return;
            removeCollaboratorFromShoppingListCache(cache, listId, memberId, {
              evictItem: true,
            });
          },
        }),
      {
        document: RemoveCollaboratorDocument,
        fallback: t('errors.removeMemberFailed'),
      },
    );
    return settled.status !== 'failed';
  };

  return { removeCollaborator };
}
