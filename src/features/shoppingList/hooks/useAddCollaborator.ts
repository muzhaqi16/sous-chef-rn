import { useMutation } from '@apollo/client/react';
import { AddCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { InviteToShoppingListInput } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

/**
 * Invite someone onto a shopping list. Public because onboarding invites the
 * first household members before any shopping-list screen exists.
 */
export function useAddCollaborator() {
  const { t } = useTranslation();
  const [addCollaborator] = useMutation(AddCollaboratorDocument);

  return {
    /** False when the server refused the invite or never ruled on it. */
    addCollaborator: async (
      input: InviteToShoppingListInput,
    ): Promise<boolean> => {
      const settled = await settleMutation(
        () => addCollaborator({ variables: { input } }),
        {
          document: AddCollaboratorDocument,
          fallback: t('errors.sendInviteFailed'),
          present: 'none',
        },
      );
      return settled.status !== 'failed';
    },
  };
}
