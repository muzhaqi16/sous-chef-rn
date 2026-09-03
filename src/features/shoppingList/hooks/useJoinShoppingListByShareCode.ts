import { useMutation } from '@apollo/client/react';
import { JoinShoppingListByShareCodeDocument } from '#features/shoppingList/graphql/shoppingList.generated';

/** Join a list by its share code. The payload is unwrapped by the caller. */
export function useJoinShoppingListByShareCode() {
  const [joinMutation] = useMutation(JoinShoppingListByShareCodeDocument);

  const joinByShareCode = async (shareCode: string) => {
    const { data } = await joinMutation({
      variables: { input: { shareCode } },
    });
    return data?.joinShoppingListByShareCode;
  };

  return { joinByShareCode };
}
