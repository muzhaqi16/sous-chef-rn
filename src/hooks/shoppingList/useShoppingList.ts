import {useMemo, useState, useEffect} from 'react';
import {
  useGetShoppingListItemsQuery,
  useShoppingListItemsChangedSubscription,
  GetShoppingListItemsDocument,
} from '#generated';
import {useSearchableList} from '../useSearchableList';
import {shoppingListStorage} from '#/storage/shoppingListCache';
import {useStore} from '#store';

export function useShoppingList(listId: string | null) {
  // Get user state to check for logout
  const user = useStore(state => state.user);
  const isLoggingOut = useStore(state => state.isLoggingOut);
  const isLoggedOut = !user;

  // State for optimistic/cached items
  const [optimisticItems, setOptimisticItems] = useState<any[]>([]);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);

  // Clear optimistic state immediately on logout
  useEffect(() => {
    if (isLoggedOut) {
      setOptimisticItems([]);
      setHasLoadedCache(false);
    }
  }, [isLoggedOut]);

  // Load cached items immediately on listId change
  useEffect(() => {
    if (listId) {
      const cachedItems = shoppingListStorage.getShoppingListItems(listId);
      if (cachedItems && cachedItems.length > 0) {
        setOptimisticItems(cachedItems);
        setHasLoadedCache(true);
      } else {
        setOptimisticItems([]);
        setHasLoadedCache(false);
      }
    } else {
      setOptimisticItems([]);
      setHasLoadedCache(false);
    }
  }, [listId]);

  // Cache-first query - try cache first, skip during logout
  const {data: cachedData, loading: cacheLoading} = useGetShoppingListItemsQuery({
    variables: {shoppingListId: listId ?? ''},
    skip: !listId || isLoggedOut || isLoggingOut,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
  });

  // Network query - fetch updates in background, skip during logout
  const {
    data: networkData,
    loading: networkLoading,
    refetch: networkRefetch,
  } = useGetShoppingListItemsQuery({
    variables: {shoppingListId: listId ?? ''},
    skip: !listId || isLoggedOut || isLoggingOut,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => {
      // Update MMKV cache when network data arrives (only if not logging out)
      if (data?.shoppingListItems && listId && !isLoggedOut && !isLoggingOut) {
        shoppingListStorage.setShoppingListItems(listId, data.shoppingListItems);
        setOptimisticItems(data.shoppingListItems);
      }
    },
  });

  // Subscribe to all item changes (added, updated, removed), skip during logout
  useShoppingListItemsChangedSubscription({
    variables: {listId: listId!},
    skip: !listId || isLoggedOut || isLoggingOut,
    onData: ({data: subscriptionData, client}) => {
      const changeData = subscriptionData?.data?.shoppingListItemsChanged;

      if (!changeData || !listId) {
        console.warn(
          'Invalid shoppingListItemsChanged payload',
          subscriptionData,
        );
        return;
      }

      const {mutation, item} = changeData;

      if (!item || !item.id) {
        console.warn('Invalid item data in subscription payload:', changeData);
        return;
      }

      // Read current items from cache
      try {
        const cacheData = client.readQuery({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: listId},
        });

        if (!cacheData?.shoppingListItems) {
          console.warn('No cache data found, refetching...');
          refetch();
          return;
        }

        let newItems = [...cacheData.shoppingListItems];

        switch (mutation) {
          case 'CREATED':
            // Add new item if it doesn't already exist
            const itemExists = newItems.some(
              existingItem => existingItem.id === item.id,
            );
            if (!itemExists) {
              newItems.push(item);
            }
            break;

          case 'UPDATED':
            // Update existing item
            newItems = newItems.map(existingItem =>
              existingItem.id === item.id
                ? {...existingItem, ...item}
                : existingItem,
            );
            break;

          case 'DELETED':
            // Remove item
            newItems = newItems.filter(
              existingItem => existingItem.id !== item.id,
            );
            break;

          default:
            console.warn('Unknown mutation type:', mutation);
            return;
        }

        // Write updated list back to cache
        client.writeQuery({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: listId},
          data: {
            shoppingListItems: newItems,
          },
        });

        // Update MMKV cache and optimistic state
        if (!isLoggedOut && !isLoggingOut) {
          shoppingListStorage.setShoppingListItems(listId, newItems);
          setOptimisticItems(newItems);
        }

        console.log(`Successfully handled ${mutation} for item:`, item.id);
      } catch (error) {
        console.error('Cache update failed, falling back to refetch:', error);
        // If cache update fails, fallback to refetching (only if not logging out)
        if (!isLoggedOut && !isLoggingOut) {
          refetch();
        }
      }
    },
    onError: error => {
      console.error('Subscription error:', error);
      // On subscription error, refetch to ensure we have current data (only if not logging out)
      if (!isLoggedOut && !isLoggingOut) {
        refetch();
      }
    },
  });

  // Determine which data to use - prioritize network data, then cached data, then optimistic
  const items = useMemo(() => {
    if (networkData?.shoppingListItems) {
      return networkData.shoppingListItems;
    }
    if (cachedData?.shoppingListItems) {
      return cachedData.shoppingListItems;
    }
    return optimisticItems;
  }, [networkData?.shoppingListItems, cachedData?.shoppingListItems, optimisticItems]);

  // Loading states
  const isInitialLoading = cacheLoading && !hasLoadedCache && optimisticItems.length === 0;
  const isRefreshing = networkLoading && (items.length > 0 || hasLoadedCache);

  const {query, setQuery, filtered} = useSearchableList(
    items,
    (it, q) =>
      !!it.itemName && it.itemName.toLowerCase().includes(q.toLowerCase()),
  );

  // Enhanced refetch that updates both Apollo and MMKV cache
  const refetch = async () => {
    if (isLoggedOut || isLoggingOut) return;
    
    const result = await networkRefetch();
    if (result.data?.shoppingListItems && listId) {
      shoppingListStorage.setShoppingListItems(listId, result.data.shoppingListItems);
      setOptimisticItems(result.data.shoppingListItems);
    }
    return result;
  };

  return {
    items: filtered, 
    query, 
    setQuery, 
    refetch,
    loading: isInitialLoading,
    refreshing: isRefreshing,
    hasLoadedCache,
    cacheInfo: listId ? shoppingListStorage.getCacheInfo(listId) : null,
  };
}
