import { useMemo } from 'react';
import { Alert } from 'react-native';
import { generateId } from '#/utils/generateId';
import {
  useGetPantryQuery,
  useCreatePantryItemMutation,
  useUpdatePantryItemMutation,
  useDeletePantryItemMutation,
  StorageState,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useAuth } from '#hooks/auth/useAuth';
import { useErrorHandler } from '#/utils/errorHandling';
import { normalizePantry } from '#/utils/connectionUtils';
import {
  enhanceWithVersion,
  createOptimisticEntity,
} from '#/apollo/utils/createOptimisticResponse';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { usePagination, useCrudOperations } from '#/hooks/utils';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils';
import { pantryItemSearch } from '#/utils/searchUtils';
import { useOfflinePresetPolicy } from '#/apollo/policies/offlineFetchPolicies';
import { subscriptionService } from '#/services/subscriptions';

// Cache updater utilities for pantry items
const addToPantryItemsCache = createAddToParentConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

const removeFromPantryItemsCache = createRemoveFromParentConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

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

  // Explicit validation - only execute query when pantryId is genuinely valid
  const hasValidPantryId = !!pantryId?.trim() && !isLoggedOut;

  // PERFORMANCE: Use offline-aware fetch policy preset for consistency
  const fetchPolicy = useOfflinePresetPolicy('LIST');

  // Single source of truth: Apollo cache - now using Connection-based query
  const { data, loading, error, refetch, fetchMore } = useGetPantryQuery({
    variables: hasValidPantryId ? {
      id: pantryId,
      itemsFirst: 25, // Initial page size
      storageLocationsFirst: 50,
    } : undefined as any,
    skip: !hasValidPantryId, // Query only executes when pantryId is valid
    fetchPolicy,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  // Real-time updates via subscription are now handled by SubscriptionProvider
  // This provides automatic deduplication, error handling, and consistent logging
  // across all subscriptions. The PantryItemsChanged subscription now receives
  // the full PantryItemFragment (after GraphQL fix) and Apollo automatically
  // updates the cache via normalization.

  // Normalize pantry data to flatten Connection pattern and preserve pagination metadata
  const normalizedPantry = useMemo(
    () => normalizePantry(data?.pantry),
    [data?.pantry],
  );

  // Filter out items that are pending deletion to prevent flicker
  // during the race condition between optimistic delete and subscription auto-normalization
  const pantryItems = useMemo(
    () => subscriptionService.filterPendingDeletes(normalizedPantry?.items || []),
    [normalizedPantry],
  );

  // Search functionality - using reusable search utility
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(pantryItems, pantryItemSearch);

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
      // Consider low stock if quantity is 1 or less, or if lowStockAlert flag is set
      return item.currentQuantity <= 1 || item.lowStockAlert;
    }).length;

    return {
      total: pantryItems.length,
      expired,
      expiringSoon,
      lowStock,
    };
  }, [pantryItems]);

  // Pagination using generic utility hook
  const { hasMore, loadMore, isLoadingMore } = usePagination({
    pageInfo: normalizedPantry?.itemsPageInfo,
    loading,
    itemCount: pantryItems.length,
    fetchMore,
    fetchMoreVariables: { id: pantryId },
    cursorVariableName: 'itemsCursor',
  });

  // CRUD operations utilities
  const { createAddOperation, createUpdateOperation } = useCrudOperations();

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
    // Update Apollo cache using generic utility
    update: (cache: any, { data }: any) => {
      if (!data?.createPantryItem || !pantryId) return;

      try {
        addToPantryItemsCache(cache, pantryId, data.createPantryItem);
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

  const [removeItemMutation, { client }] = useDeletePantryItemMutation({
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
    // Update cache using generic utility
    update: (cache: any, { data }: any, { variables }: any) => {
      if (!data?.deletePantryItem || !pantryId || !variables) return;

      try {
        const itemId = variables.id;
        removeFromPantryItemsCache(cache, pantryId, itemId, { evictItem: true });
      } catch (error) {
        console.warn(
          'Cache update failed for removeItem, will refetch:',
          error,
        );
        refetch();
      }
    },
  });

  // Simplified add item using CRUD utilities
  const addItem = createAddOperation({
    mutation: addItemMutation,
    parentId: () => pantryId,
    transformInput: (input: PantryItemInput) => ({
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
    }),
    onSuccess: (data: any) => data?.createPantryItem,
    operationName: 'Add Pantry Item',
  });

  // Simplified update item using CRUD utilities
  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    const operation = createUpdateOperation({
      mutation: updateItemMutation,
      parentId: () => pantryId,
      itemId,
      onSuccess: (data: any) => data?.updatePantryItem,
      onVersionConflict: refetch,
      operationName: 'Update Pantry Item',
    });
    return operation(updates);
  };

  // Remove item with optimistic cache update for instant UI feedback
  const removeItem = async (itemId: string) => {
    if (!pantryId) return;

    // Register pending delete to handle subscription race condition
    // This prevents Apollo's auto-normalization from re-adding the item
    // We pass the parent typename and connection field so the subscription handler
    // can properly remove from the Connection if Apollo re-adds the item
    subscriptionService.registerPendingDelete(
      itemId,
      pantryId,
      'PantryItem',
      'Pantry',
      'itemsConnection',
    );

    // Optimistically remove from cache IMMEDIATELY for instant UI feedback
    // This removes the row from the list before the mutation completes
    removeFromPantryItemsCache(client.cache, pantryId, itemId, { evictItem: true });

    try {
      // Now call the mutation - the update callback will be a no-op since item is already removed
      const result = await removeItemMutation({
        variables: { id: itemId },
      });

      // With errorPolicy: 'all', GraphQL errors don't reject but are in result.error
      // If there's an error, refetch to restore correct state
      if (result.error) {
        console.warn('Delete mutation had errors, refetching to restore state');
        refetch();
      }
    } catch (error) {
      // Network errors will reject the promise
      console.warn('Delete mutation failed, refetching to restore state:', error);
      refetch();
    } finally {
      // Clean up pending delete registry
      subscriptionService.unregisterPendingDelete(itemId);
    }
  };

  return {
    // Data
    items: filteredItems,
    allItems: pantryItems,
    loading,
    error,
    stats,

    // Pagination
    loadMore,
    hasMore,
    isLoadingMore,

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
        // Consider low stock if quantity is 1 or less, or if lowStockAlert flag is set
        return item.currentQuantity <= 1 || item.lowStockAlert;
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
