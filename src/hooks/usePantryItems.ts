import {useMemo} from 'react';
import {
  usePantryItemsQuery,
  usePantryItemsChangedSubscription,
  PantryItemsQuery,
  PantryItemsDocument,
} from '../graphql/generated';
import {useSearchableList} from './useSearchableList';
import {ApolloClient} from '@apollo/client';

export function usePantryItems(pantryId: string | undefined) {
  // Fetch pantry items with cache-and-network policy
  // This ensures we get the latest data from the server while using cached data
  // for immediate UI updates.
  // If pantryId is not provided, skip the query
  // to avoid unnecessary network requests.
  if (!pantryId) {
    return {items: [], query: '', setQuery: () => {}, refetch: () => {}};
  }
  const {data, refetch, client} = usePantryItemsQuery({
    fetchPolicy: 'cache-and-network',
    skip: !pantryId,
    variables: {pantryId: pantryId},
  });

  usePantryItemsChangedSubscription({
    variables: {pantryId: pantryId},
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
    (item, q) => item?.itemName?.toLowerCase().includes(q.toLowerCase()),
  );

  return {items: filtered, query, setQuery, refetch};
}
