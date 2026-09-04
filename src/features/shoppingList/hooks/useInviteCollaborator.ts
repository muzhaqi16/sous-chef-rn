import { useMutation } from '@apollo/client/react';
import { AddCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

const addCollaboratorToCache = createAddToParentConnectionUpdater(
  'ShoppingList',
  'collaboratorsConnection',
  'ShoppingListCollaborator',
);

/**
 * Invite someone to a list by email. The new collaborator is inserted into the
 * cached connection on success, so no refetch follows.
 */
export function useInviteCollaborator(listId: string) {
  const [shareList] = useMutation(AddCollaboratorDocument);

  const inviteCollaborator = async (email: string, role: CollaboratorRole) => {
    const { data } = await shareList({
      variables: { input: { shoppingListId: listId, email, role } },
      update(cache, { data: updateData }) {
        const invitePayload = updateData?.inviteToShoppingList;
        if (invitePayload?.__typename === 'InviteToShoppingListPayload') {
          addCollaboratorToCache(cache, listId, invitePayload.collaborator, {
            position: 'end',
          });
        }
      },
    });
    return data?.inviteToShoppingList;
  };

  return { inviteCollaborator };
}
