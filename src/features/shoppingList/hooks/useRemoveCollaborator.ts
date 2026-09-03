import { useMutation } from '@apollo/client/react';
import {
  RemoveCollaboratorDocument,
  type RemoveCollaboratorMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { removeCollaboratorFromShoppingListCache } from '#features/shoppingList/hooks/useLeaveShoppingList';
import { handleMutationError } from '#/utils/errorHandlers';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

/**
 * Drop a collaborator from a list. The cached connection is updated in place,
 * so no refetch follows; the raw result is returned for the caller's refusal
 * copy, since a resolved error member does not throw.
 */
export function useRemoveCollaborator(listId: string) {
  const [removeMember] = useMutation(RemoveCollaboratorDocument);

  const removeCollaborator = async (
    memberId: string,
  ): Promise<MutationOutcome<RemoveCollaboratorMutation> | undefined> => {
    let result;
    try {
      result = await removeMember({
        variables: { input: { id: memberId } },
        update(cache, { data }) {
          // Only evict on success — a resolved error must not remove the
          // collaborator from the cache.
          if (
            data?.removeShoppingListCollaborator?.__typename !==
            'RemoveShoppingListCollaboratorPayload'
          ) {
            return;
          }
          removeCollaboratorFromShoppingListCache(cache, listId, memberId, {
            evictItem: true,
          });
        },
      });
    } catch (error) {
      handleMutationError(error, { operation: 'Remove Collaborator' });
    }
    return result;
  };

  return { removeCollaborator };
}
