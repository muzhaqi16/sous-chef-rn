import {useEffect} from 'react';
import {useShoppingListUpdatedSubscription} from '../api/graphql/generated';
import {useStore} from '../store';

export function useShoppingListUpdates(listId: string) {
  const upsert = useStore(state => state.upsertItemInList);
  const remove = useStore(state => state.removeItemFromList);

  const {data, error} = useShoppingListUpdatedSubscription({
    variables: {listId},
  });

  useEffect(() => {
    if (data?.shoppingListUpdated) {
      upsert(data.shoppingListUpdated);
    }
  }, [data, upsert]);

  return {error};
}
