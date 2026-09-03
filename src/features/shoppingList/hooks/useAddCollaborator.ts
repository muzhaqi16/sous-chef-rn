import { useMutation } from '@apollo/client/react';
import {
  AddCollaboratorDocument,
  type AddCollaboratorMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import type { InviteToShoppingListInput } from '#/graphql/generated/schemaTypes';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

/**
 * Invite someone onto a shopping list. Public because onboarding invites the
 * first household members before any shopping-list screen exists.
 */
export function useAddCollaborator(onError: (error: Error) => void) {
  const [addCollaborator, { loading }] = useMutation(AddCollaboratorDocument, {
    onError,
  });

  return {
    addCollaborator: (
      input: InviteToShoppingListInput,
    ): Promise<MutationOutcome<AddCollaboratorMutation>> =>
      addCollaborator({ variables: { input } }),
    adding: loading,
  };
}
