import {useMemo} from 'react';
import {
  usePantryItemsQuery,
  usePantryItemUpdatedSubscription,
  PantryItemsQuery,
  PantryItemsDocument,
} from '../graphql/generated';
import {useSearchableList} from './useSearchableList';
import {ApolloClient} from '@apollo/client';

export function usePantryItems(pantryId: string | undefined) {
  const {data, refetch, client} = usePantryItemsQuery({
    fetchPolicy: 'cache-and-network',
    skip: !pantryId,
    variables: {pantryId: pantryId ?? ''},
  });

  usePantryItemUpdatedSubscription({
    variables: {pantryId: pantryId ?? ''},
    skip: !pantryId,
    onData: ({
      data: subData,
      client,
    }: {
      data: any;
      client: ApolloClient<any>;
    }) => {
      const updatedItem = subData?.data?.pantryItemUpdated;
      if (!updatedItem) return;

      const cache = client.readQuery<PantryItemsQuery>({
        query: PantryItemsDocument,
        variables: {pantryId},
      });

      if (!cache?.pantryItems) return;

      const exists = cache.pantryItems.some(i => i.id === updatedItem.id);
      const updated = exists
        ? cache.pantryItems.map(i =>
            i.id === updatedItem.id ? updatedItem : i,
          )
        : [...cache.pantryItems, updatedItem];

      client.writeQuery<PantryItemsQuery>({
        query: PantryItemsDocument,
        variables: {pantryId},
        data: {pantryItems: updated},
      });
    },
  });

  const pantryItems = data?.pantryItems || [];

  const {query, setQuery, filtered} = useSearchableList(
    pantryItems,
    (item, q) => item?.item?.name?.toLowerCase().includes(q.toLowerCase()),
  );

  return {items: filtered, query, setQuery, refetch};
}
