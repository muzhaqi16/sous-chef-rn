import {
  useGetPantryItemsQuery,
  usePantryItemsChangedSubscription,
  GetPantryItemsQuery,
  GetPantryItemsDocument,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { ApolloClient } from '@apollo/client';

export function usePantryItems(pantryId: string | undefined) {
  const { data, refetch } = useGetPantryItemsQuery({
    fetchPolicy: 'cache-and-network',
    skip: !pantryId,
    variables: { pantryId: pantryId ?? '' },
  });

  usePantryItemsChangedSubscription({
    variables: { pantryId: pantryId ?? '' },
    skip: !pantryId,
    onData: ({
      data: subData,
      client,
    }: {
      data: any;
      client: ApolloClient;
    }) => {
      const updatedItem = subData?.data?.pantryItemUpdated;
      if (!updatedItem) return;

      const cache = client.readQuery<GetPantryItemsQuery>({
        query: GetPantryItemsDocument,
        variables: { pantryId },
      });

      if (!cache?.pantryItems) return;

      const exists = cache.pantryItems.some(i => i.id === updatedItem.id);
      const updated = exists
        ? cache.pantryItems.map(i =>
            i.id === updatedItem.id ? updatedItem : i,
          )
        : [...cache.pantryItems, updatedItem];

      client.writeQuery<GetPantryItemsQuery>({
        query: GetPantryItemsDocument,
        variables: { pantryId },
        data: { pantryItems: updated },
      });
    },
  });

  const pantryItems = data?.pantryItems || [];

  const { query, setQuery, filtered } = useSearchableList(
    pantryItems,
    (item: any, q: string) => item?.itemName?.toLowerCase().includes(q.toLowerCase()),
  );

  return { items: filtered, query, setQuery, refetch };
}
