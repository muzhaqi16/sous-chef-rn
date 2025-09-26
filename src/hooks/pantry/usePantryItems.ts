import {
  useGetPantryItemsQuery,
  usePantryItemsChangedSubscription,
  PantryItemFragment,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useErrorHandler } from '#/utils/errorHandling';

export function usePantryItems(pantryId: string | undefined) {
  const { handleApolloError } = useErrorHandler();

  const { data, loading, refetch } = useGetPantryItemsQuery({
    fetchPolicy: 'cache-and-network',
    skip: !pantryId,
    variables: { pantryId: pantryId ?? '' },
  });

  usePantryItemsChangedSubscription({
    variables: { pantryId: pantryId ?? '' },
    skip: !pantryId,
    onData: ({ data: subData, client }) => {
      try {
        const changePayload = subData?.data?.pantryItemsChanged;
        const updatedItem = changePayload?.item;
        if (!updatedItem || !pantryId) return;

        // Use cache.modify for better consistency
        const cache = client.cache;
        cache.modify({
          fields: {
            pantryItems: (existingItems = [], { readField }) => {
              const exists = existingItems.some(
                (itemRef: any) => readField('id', itemRef) === updatedItem.id
              );

              if (exists) {
                // Update existing item
                return existingItems.map((itemRef: any) =>
                  readField('id', itemRef) === updatedItem.id
                    ? updatedItem
                    : itemRef
                );
              } else {
                // Add new item
                return [...existingItems, updatedItem];
              }
            },
          },
        });
      } catch (error) {
        const { message } = handleApolloError(error, {
          operation: 'Pantry Subscription Cache Update',
        });
        console.warn('Failed to update cache from pantry subscription:', message);
        refetch();
      }
    },
  });

  const pantryItems = data?.pantryItems || [];

  const { query, setQuery, filtered } = useSearchableList(
    pantryItems,
    (item: PantryItemFragment, q: string) => item?.itemName?.toLowerCase().includes(q.toLowerCase()),
  );

  return { items: filtered, loading, query, setQuery, refetch };
}
