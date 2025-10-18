import { useMemo } from 'react';
import { Alert } from 'react-native';
import { v4 as uuid } from 'uuid';
import {
  useGetPantryItemsQuery,
  usePantryItemsChangedSubscription,
  useAddItemToPantryMutation,
  useUpdatePantryItemMutation,
  useRemoveItemFromPantryMutation,
  StorageState,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useAuth } from '#hooks/auth/useAuth';
import { useErrorHandler } from '#/utils/errorHandling';
import { useSubscriptionDeduplication } from '#/hooks/utils/useSubscriptionDeduplication';
import {
  enhanceWithVersion,
  createOptimisticEntity,
} from '#/apollo/utils/createOptimisticResponse';

export interface PantryItemInput {
  itemName: string;
  brand?: string;
  quantity: number;
  unit?: string;
  unitId: string;
  autoReorderPoint?: number;
  storageState: StorageState;
  location?: string;
  expirationDate?: string;
  notes?: string;
  category?: string;
  barcode?: string;
  imageUrl?: string;
}

export interface PantryItemUpdate extends Partial<PantryItemInput> {
  currentQuantity?: number;
}

/**
 * Consolidated pantry management hook with optimistic UI updates
 * Uses Apollo Client with subscription deduplication and version-based conflict resolution
 */
export function usePantryManagement(pantryId: string | undefined) {
  const { isLoggedOut, user } = useAuth();
  const { handleApolloError } = useErrorHandler();
  const shouldSkip = !pantryId || isLoggedOut;

  // Subscription deduplication filter
  const shouldProcessUpdate = useSubscriptionDeduplication(user?.id);

  // Single source of truth: Apollo cache
  const { data, loading, error, refetch } = useGetPantryItemsQuery({
    variables: { pantryId: pantryId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-first', // Optimized: use cache first, then network
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  // Real-time updates via subscription with deduplication
  usePantryItemsChangedSubscription({
    variables: { pantryId: pantryId ?? '' },
    skip: shouldSkip,
    onData: ({ data }) => {
      const payload = data.data?.pantryItemsChanged;

      // Filter out self-echo and duplicate updates
      if (!shouldProcessUpdate(payload)) {
        return;
      }

      // Apollo Client automatically updates cache via normalization
      // No manual cache update needed - the subscription data is merged automatically
      console.log('✅ Processing pantry subscription update from other user:', {
        userId: payload?.userId,
        mutation: payload?.mutation,
        itemId: payload?.item?.id,
      });
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Pantry Subscription',
      });
      console.warn('❌ Pantry subscription error:', {
        pantryId,
        error: message,
        timestamp: new Date().toISOString(),
      });
      // Don't refetch on subscription errors - let the query handle reconnection
    },
  });

  const pantryItems = useMemo(
    () => data?.pantryItems ?? [],
    [data?.pantryItems],
  );

  // Search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(pantryItems, (item, q) => {
    const searchTerm = q.toLowerCase();
    return (
      item?.item?.name?.toLowerCase().includes(searchTerm) ||
      item?.itemName?.toLowerCase().includes(searchTerm)
    );
  });

  // Simple stats calculation
  const stats = useMemo(() => {
    if (!pantryItems || pantryItems.length === 0) {
      return {
        total: 0,
        expired: 0,
        expiringSoon: 0,
        lowStock: 0,
      };
    }

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expired = pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      return new Date(item.expiresAt) < now;
    }).length;

    const expiringSoon = pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      const expirationDate = new Date(item.expiresAt);
      return expirationDate >= now && expirationDate <= sevenDaysFromNow;
    }).length;

    const lowStock = pantryItems.filter(item => {
      if (!item.currentQuantity || !item.autoReorderPoint) return false;
      return item.currentQuantity <= item.autoReorderPoint;
    }).length;

    return {
      total: pantryItems.length,
      expired,
      expiringSoon,
      lowStock,
    };
  }, [pantryItems]);

  // Mutations with optimistic updates
  const [addItemMutation] = useAddItemToPantryMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Add Pantry Item',
      });
      Alert.alert('Error', message);
    },
    // Optimistic response for instant UI feedback (especially important offline)
    optimisticResponse: variables => {
      const tempId = `temp-${uuid()}`;
      return {
        __typename: 'Mutation',
        addItemToPantry: {
          ...createOptimisticEntity('PantryItem', tempId, {
            itemName: variables.input.itemName,
            currentQuantity: variables.input.initialQuantity,
            storageState: variables.input.storageState,
            storageLocation: variables.input.storageLocation || null,
            storageNotes: variables.input.storageNotes || null,
            expiresAt: variables.input.expiresAt || null,
            autoReorderPoint: variables.input.autoReorderPoint || null,
            pantry: {
              __typename: 'Pantry',
              id: pantryId || '',
            },
            unit: variables.input.unitId
              ? {
                  __typename: 'Unit',
                  id: variables.input.unitId,
                }
              : null,
          }),
          __typename: 'PantryItem',
        } as any, // Optimistic response - will be replaced by server response
      };
    },
    // Update Apollo cache directly instead of refetching
    update: (cache, { data }) => {
      if (!data?.addItemToPantry || !pantryId) return;

      try {
        // Modify the pantryItems field in the cache
        cache.modify({
          fields: {
            pantryItems(existingItems = [], { readField, toReference }) {
              const newItemRef = toReference(data.addItemToPantry);

              // Check if item already exists (avoid duplicates)
              const exists = existingItems.some(
                (itemRef: any) =>
                  readField('id', itemRef) === data.addItemToPantry.id,
              );

              if (exists) {
                return existingItems;
              }

              // Add new item to the list
              return [...existingItems, newItemRef];
            },
          },
        });
      } catch (error) {
        console.warn('Cache update failed for addItem, will refetch:', error);
        // Fallback: refetch if cache update fails
        refetch();
      }
    },
  });

  const [updateItemMutation] = useUpdatePantryItemMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Pantry Item',
      });
      Alert.alert('Error', message);
    },
    // Enhanced optimistic response with version management
    optimisticResponse: variables => {
      // Find the current item to preserve its fields
      const currentItem = pantryItems.find(item => item.id === variables.id);

      if (!currentItem) {
        // Fallback for edge case where item not in cache
        return {
          __typename: 'Mutation',
          updatePantryItem: {
            __typename: 'PantryItem',
            id: variables.id,
            version: 1,
            updatedAt: new Date().toISOString(),
            ...variables.input,
          } as any,
        };
      }

      // Use version-aware helper to create optimistic response
      // This automatically increments version and updates timestamp
      const optimisticUpdate = enhanceWithVersion(
        {
          ...currentItem,
          updatedAt: currentItem.updatedAt ?? new Date().toISOString(),
        } as any,
        {
          ...variables.input,
        },
      );

      return {
        __typename: 'Mutation',
        updatePantryItem: optimisticUpdate as any,
      };
    },
    // Cache update happens automatically via Apollo's normalization
    // The mutation returns the full PantryItemFragment, so Apollo merges it automatically
    // The optimistic response provides instant UI feedback
  });

  const [removeItemMutation] = useRemoveItemFromPantryMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Pantry Item',
      });
      Alert.alert('Error', message);
    },
    // Optimistic response for instant removal
    optimisticResponse: _variables => ({
      __typename: 'Mutation',
      removeItemFromPantry: {
        __typename: 'PantryItem',
        // The mutation returns full PantryItemFragment, but we just need enough for removal
        id: _variables?.id ?? '',
      } as any,
    }),
    // Update cache to remove the item
    update: (cache, { data }, { variables }) => {
      if (!data?.removeItemFromPantry || !pantryId || !variables) return;

      try {
        const itemId = variables.id;

        // Remove the item from the cache
        cache.modify({
          fields: {
            pantryItems(existingItems = [], { readField }) {
              return existingItems.filter(
                (itemRef: any) => readField('id', itemRef) !== itemId,
              );
            },
          },
        });

        // Evict the removed item from cache
        cache.evict({
          id: cache.identify({ __typename: 'PantryItem', id: itemId }),
        });
        cache.gc(); // Garbage collect orphaned data
      } catch (error) {
        console.warn(
          'Cache update failed for removeItem, will refetch:',
          error,
        );
        refetch();
      }
    },
  });

  // Simplified add item
  const addItem = async (input: PantryItemInput) => {
    if (!pantryId) return false;

    try {
      const result = await addItemMutation({
        variables: {
          input: {
            pantryId,
            initialQuantity: input.quantity,
            itemName: input.itemName,
            unitId: input.unitId,
            storageState: input.storageState,
            ...(input.brand && { itemBrand: input.brand }),
            ...(input.location && { storageLocation: input.location }),
            ...(input.expirationDate && { expiresAt: input.expirationDate }),
            ...(input.notes && { storageNotes: input.notes }),
            ...(input.category && { itemCategory: input.category }),
            ...(input.barcode && { itemUpc: input.barcode }),
          },
        },
      });

      return result.data?.addItemToPantry ?? false;
    } catch (error) {
      console.error('Add pantry item error:', error);
      return false;
    }
  };

  // Simplified update item
  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    if (!pantryId) return false;

    try {
      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: updates,
        },
      });

      return result.data?.updatePantryItem ?? false;
    } catch (error) {
      console.error('Update pantry item error:', error);
      return false;
    }
  };

  // Simplified remove item
  const removeItem = async (itemId: string) => {
    if (!pantryId) return false;

    try {
      await removeItemMutation({
        variables: { id: itemId },
      });

      return true;
    } catch (error) {
      console.error('Remove pantry item error:', error);
      return false;
    }
  };

  return {
    // Data
    items: filteredItems,
    allItems: pantryItems,
    loading,
    error,
    stats,

    // Search
    searchQuery,
    setSearchQuery,

    // Actions
    addItem,
    updateItem,
    removeItem,
    refetch,

    // Helper functions
    getItemById: (itemId: string) =>
      pantryItems.find(item => item.id === itemId),
    getItemsByStorageState: (storageState: StorageState) =>
      pantryItems.filter(item => item.storageState === storageState),
    getExpiringItems: (days: number = 7) => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      return pantryItems.filter(item => {
        if (!item.expiresAt) return false;
        const expirationDate = new Date(item.expiresAt);
        return expirationDate <= futureDate;
      });
    },
    getLowStockItems: () =>
      pantryItems.filter(item => {
        if (!item.currentQuantity || !item.autoReorderPoint) return false;
        return item.currentQuantity <= item.autoReorderPoint;
      }),
    getExpiredItems: () => {
      const now = new Date();
      return pantryItems.filter(item => {
        if (!item.expiresAt) return false;
        return new Date(item.expiresAt) < now;
      });
    },
  };
}
