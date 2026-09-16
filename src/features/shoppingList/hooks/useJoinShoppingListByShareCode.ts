import { useMutation } from '@apollo/client/react';
import { JoinShoppingListByShareCodeDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';

interface JoinOutcome {
  /** The list joined, or null when the code did not open one. */
  shoppingList: { id: string; name: string } | null;
  /** What to tell the user; absent when the join worked. */
  body?: string;
}

/** Join a list by its share code. */
export function useJoinShoppingListByShareCode() {
  const [joinMutation] = useMutation(JoinShoppingListByShareCodeDocument);

  const joinByShareCode = async (
    shareCode: string,
    failureMessage: string,
  ): Promise<JoinOutcome> => {
    const settled = await settleMutation(
      () => joinMutation({ variables: { input: { shareCode } } }),
      {
        document: JoinShoppingListByShareCodeDocument,
        fallback: failureMessage,
        // A code no list answers to is the same news as any other refusal here:
        // the caller's copy already says the code may be invalid or expired.
        copy: {
          [ErrorCode.NotFound]: {
            title: t('labels.error'),
            body: failureMessage,
          },
        },
        present: 'none',
      },
    );
    if (settled.status === 'failed') {
      return {
        shoppingList: null,
        body: settled.failure?.body ?? failureMessage,
      };
    }
    const joined = appliedPayload(settled.data)?.shoppingList;
    // A queued join reaches no server, so there is no list to open yet.
    return joined
      ? { shoppingList: joined }
      : { shoppingList: null, body: failureMessage };
  };

  return { joinByShareCode };
}
