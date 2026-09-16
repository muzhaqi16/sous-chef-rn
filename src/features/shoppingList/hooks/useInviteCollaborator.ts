import { useMutation } from '@apollo/client/react';
import { AddCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { settleMutation } from '#/apollo/utils/settleMutation';

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

  /** @returns whether the invite was sent. */
  const inviteCollaborator = async (
    email: string,
    role: CollaboratorRole,
    failureMessage: string,
  ): Promise<boolean> => {
    const settled = await settleMutation(
      () =>
        shareList({
          variables: { input: { shoppingListId: listId, email, role } },
          update(cache, { data: updateData }) {
            const invitePayload = appliedPayload(updateData);
            if (invitePayload) {
              addCollaboratorToCache(
                cache,
                listId,
                invitePayload.collaborator,
                {
                  position: 'end',
                },
              );
            }
          },
        }),
      { document: AddCollaboratorDocument, fallback: failureMessage },
    );
    return settled.status !== 'failed';
  };

  return { inviteCollaborator };
}
