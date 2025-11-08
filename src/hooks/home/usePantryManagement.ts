import { useMemo } from 'react';
import { Alert } from 'react-native';
import { generateId } from '#/utils/generateId';
import {
  useGetPantryItemsQuery,
  useCreatePantryItemMutation,
  useUpdatePantryItemMutation,
  useDeletePantryItemMutation,
  StorageState,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useAuth } from '#hooks/auth/useAuth';
import { useErrorHandler } from '#/utils/errorHandling';
import { usePreservedArrayData } from '#/hooks/apollo';
import {
  enhanceWithVersion,
  createOptimisticEntity,
} from '#/apollo/utils/createOptimisticResponse';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';

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
  const { isLoggedOut } = useAuth();
  const { handleApolloError } = useErrorHandler();
  const shouldSkip = !pantryId || isLoggedOut;

  // Single source of truth: Apollo cache
  const { data, loading, error, refetch } = useGetPantryItemsQuery({
    variables: { pantryId: pantryId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network', // Show cache immediately, then fetch fresh data with complete images
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  // Real-time updates via subscription are now handled by SubscriptionProvider
  // This provides automatic deduplication, error handling, and consistent logging
  // across all subscriptions. The PantryItemsChanged subscription now receives
  // the full PantryItemFragment (after GraphQL fix) and Apollo automatically
  // updates the cache via normalization.

  // Preserve pantry items even when query fails to prevent cascade failures
  const pantryItems = usePreservedArrayData(data?.pantryItems);

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
  const [addItemMutation] = useCreatePantryItemMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Add Pantry Item',
      });
      Alert.alert('Error', message);
    },
    // Optimistic response for instant UI feedback (especially important offline)
    optimisticResponse: (variables: any) => {
      const tempId = `temp-${generateId()}`;
      return {
        __typename: 'Mutation' as const,
        createPantryItem: {
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
          __typename: 'PantryItem' as const,
        } as any, // Optimistic response - will be replaced by server response
      };
    },
    // Update Apollo cache directly instead of refetching
    update: (cache: any, { data }: any) => {
      if (!data?.createPantryItem || !pantryId) return;

      try {
        // Modify the pantryItems field in the cache
        cache.modify({
          fields: {
            pantryItems(existingItems = [], { readField, toReference }: any) {
              const newItemRef = toReference(data.createPantryItem);

              // Check if item already exists (avoid duplicates)
              const exists = existingItems.some(
                (itemRef: any) =>
                  readField('id', itemRef) === data.createPantryItem.id,
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
    onError: (error: any) => {
      // Handle version conflicts with user-friendly message
      if (handleVersionConflict(error)) {
        Alert.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

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

  const [removeItemMutation] = useDeletePantryItemMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Pantry Item',
      });
      Alert.alert('Error', message);
    },
    // No optimisticResponse - the mutation returns full PantryItemFragment (50+ fields)
    // The cache update function below provides instant UI feedback for both online and offline scenarios
    // This approach avoids cache normalization warnings and aligns with delete patterns used
    // in useHomeManagement and useShoppingListManagement
    // Update cache to remove the item
    update: (cache: any, { data }: any, { variables }: any) => {
      if (!data?.deletePantryItem || !pantryId || !variables) return;

      try {
        const itemId = variables.id;

        // Remove the item from the cache
        cache.modify({
          fields: {
            pantryItems(existingItems = [], { readField }: any) {
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

      return result.data?.createPantryItem ?? false;
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
