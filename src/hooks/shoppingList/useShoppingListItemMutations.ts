import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useToggleShoppingListItemPurchasedMutation,
  ShoppingListItemFragmentDoc,
  ShoppingListItemDisplayFragmentDoc,
  DisplayFormat,
} from '#generated';
import type { ShoppingListItemCoreFragment, ShoppingListItemDisplayFragment } from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils';
import { useCrudOperations } from '#/hooks/utils';

// Cache updater utilities for shopping list items connection
// Uses parent connection pattern for ShoppingList.itemsConnection
const addToShoppingListItemsCache = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

const removeFromShoppingListItemsCache =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );

export interface ShoppingListItemInput {
  itemName: string;
  quantity?: number;
  unitName?: string;
  unitId?: string;
  notes?: string;
  category?: string;
}

export interface ShoppingListItemUpdate extends Partial<ShoppingListItemInput> {
  completed?: boolean;
}

/**
 * useShoppingListItemMutations - CRUD mutations for shopping list items
 *
 * Single responsibility:
 * - Add, update, remove, toggle mutations
 * - Optimistic responses for instant UI
 * - Cache updates for offline-first support
 *
 * This hook is consumed by useShoppingListManagement for data orchestration.
 */
export function useShoppingListItemMutations(
  listId: string | null | undefined,
  items: ShoppingListItemDisplayFragment[],
  refetch: () => Promise<any>,
) {
  const client = useApolloClient();
  const { handleApolloError } = useErrorHandler();

  // CRUD operations utilities
  const { createAddOperation, createRemoveOperation } = useCrudOperations();

  // === ADD MUTATION ===
  const [addItemMutation] = useAddItemToShoppingListMutation({
    errorPolicy: 'all',
    optimisticResponse: (variables: any) => {
      const tempId = `temp-${generateId()}`;
      return {
        __typename: 'Mutation',
        addItemToShoppingList: {
          ...createOptimisticEntity('ShoppingListItem', tempId, {
            itemName: variables.input.itemName,
            quantity: variables.input.quantity ?? 1,
            quantityInput: variables.input.quantityInput || null,
            displayFormat: DisplayFormat.Auto,
            unitName: variables.input.unitName || null,
            notes: variables.input.notes || null,
            category: variables.input.category || null,
            shoppingList: {
              __typename: 'ShoppingList',
              id: listId || '',
              totalItems: null,
              completedItems: null,
              estimatedTotal: null,
            },
            item: variables.input.itemId
              ? {
                  __typename: 'Item',
                  id: variables.input.itemId,
                  name: null,
                  description: null,
                  imageUrl: null,
                  netWeight: null,
                  displayUnit: null,
                  categories: [],
                }
              : null,
            unit: variables.input.unitId
              ? {
                  __typename: 'Unit',
                  id: variables.input.unitId,
                  name: null,
                  symbol: null,
                  type: null,
                  isMetric: null,
                  baseUnitId: null,
                  conversionFactor: null,
                  notes: null,
                  isCommon: null,
                  sortOrder: null,
                  createdAt: null,
                  updatedAt: null,
                }
              : null,
            purchaseInfo: {
              __typename: 'PurchaseInfo',
              isPurchased: false,
              purchasedQuantity: null,
              purchasedPrice: null,
              purchaseDate: null,
              purchasedBy: null,
            },
            priceEstimate: {
              __typename: 'PriceEstimate',
              estimated: null,
              budget: null,
              lastKnown: null,
              lowest: null,
              highest: null,
              lastUpdated: null,
            },
            storeInfo: {
              __typename: 'StoreInfo',
              aisle: null,
              storeSection: null,
              preferredStore: null,
            },
            purchaseHistory: {
              __typename: 'PurchaseHistory',
              previouslyPurchased: false,
              lastPurchaseDate: null,
              purchaseCount: 0,
            },
            source: {
              __typename: 'Source',
              isAutoAdded: false,
              autoAddReason: null,
              isFromMealPlan: false,
              mealPlan: null,
            },
            priority: null,
            sortOrder: null,
            createdAt: null,
            deletedAt: null,
            addedBy: null,
            purchasesConnection: {
              __typename: 'PurchaseConnection',
              totalCount: 0,
              edges: [],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: null,
              },
            },
          }),
          __typename: 'ShoppingListItem',
        } as any,
      };
    },
    update(cache, { data }) {
      if (!data?.addItemToShoppingList || !listId) return;

      try {
        addToShoppingListItemsCache(
          cache,
          listId,
          data.addItemToShoppingList,
        );
      } catch (error) {
        console.warn('Cache update failed for addItem, will refetch:', error);
        refetch();
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Add Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  // === UPDATE MUTATION ===
  const [updateItemMutation] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    onCompleted: data => {
      if (data?.updateShoppingListItem) {
        const itemId = data.updateShoppingListItem.id;
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'quantity');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'quantityInput');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'itemName');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'notes');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'category');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'unitName');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'unitId');
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  // === REMOVE MUTATION ===
  const [removeItemMutation] = useRemoveItemFromShoppingListMutation({
    errorPolicy: 'all',
    optimisticResponse: variables => {
      const item = items.find(i => i.id === variables.id);
      if (!item) {
        return {
          __typename: 'Mutation',
          removeItemFromShoppingList: {
            __typename: 'ShoppingListItem',
            id: variables.id,
          } as any,
        };
      }
      return {
        __typename: 'Mutation',
        removeItemFromShoppingList: item as any,
      };
    },
    update(cache, { data }, { variables }) {
      if (!data?.removeItemFromShoppingList || !listId || !variables) return;

      try {
        const itemId = variables.id;
        optimisticDataPersistence.save('ShoppingListItem', itemId, '__deleted', true);
        removeFromShoppingListItemsCache(cache, listId, itemId, { evictItem: true });
      } catch (error) {
        console.warn('Cache update failed for removeItem, will refetch:', error);
        refetch();
      }
    },
    onCompleted: data => {
      if (data?.removeItemFromShoppingList) {
        optimisticDataPersistence.clear(
          'ShoppingListItem',
          data.removeItemFromShoppingList.id,
          '__deleted',
        );
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  // === TOGGLE MUTATION ===
  // Uses cache.modify() pattern (Pattern 5 from Apollo patterns doc) for instant UI updates
  // This avoids "Missing field" warnings from partial optimistic responses
  const [togglePurchasedMutation] = useToggleShoppingListItemPurchasedMutation({
    errorPolicy: 'all',
    // Use cache.modify for instant UI updates - no optimistic response needed
    update(cache, _result, { variables }) {
      if (!variables) return;

      const itemId = variables.id;
      const newStatus = variables.purchased;

      // Directly modify the cached item's purchaseInfo.isPurchased field
      // This executes immediately, providing instant UI feedback
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        fields: {
          purchaseInfo(existingPurchaseInfo = {}) {
            return {
              ...existingPurchaseInfo,
              isPurchased: newStatus,
            };
          },
          updatedAt() {
            return new Date().toISOString();
          },
        },
      });
    },
    onCompleted: data => {
      if (data?.toggleShoppingListItemPurchased) {
        optimisticDataPersistence.clear(
          'ShoppingListItem',
          data.toggleShoppingListItemPurchased.id,
          'isPurchased',
        );
      }
    },
    onError: error => {
      // On error, refetch to restore correct state
      const { message } = handleApolloError(error, {
        operation: 'Toggle Item Purchased',
      });
      Alert.alert('Error', message);
      refetch();
    },
  });

  // === WRAPPED OPERATIONS ===

  const addItem = createAddOperation({
    mutation: addItemMutation,
    parentId: () => listId,
    transformInput: (input: ShoppingListItemInput) => ({
      shoppingListId: listId,
      itemName: input.itemName,
      quantity: input.quantity ?? 1,
      ...(input.unitName && { unitName: input.unitName }),
      ...(input.unitId && { unitId: input.unitId }),
      ...(input.notes && { notes: input.notes }),
      ...(input.category && { category: input.category }),
    }),
    onSuccess: (data: any) => data?.addItemToShoppingList,
    operationName: 'Add Shopping List Item',
  });

  const updateItem = async (itemId: string, updates: ShoppingListItemUpdate) => {
    if (!listId) return false;

    try {
      const fullItem = client.readFragment<any>({
        id: client.cache.identify({
          __typename: 'ShoppingListItem',
          id: itemId,
        }),
        fragment: ShoppingListItemFragmentDoc,
        fragmentName: 'ShoppingListItemFragment',
      });

      if (!fullItem) {
        console.warn('Item not in cache, cannot update optimistically:', itemId);
        const result = await updateItemMutation({
          variables: { id: itemId, input: updates },
        });
        return result.data?.updateShoppingListItem ?? false;
      }

      const coreFields: ShoppingListItemCoreFragment = {
        __typename: 'ShoppingListItem',
        id: fullItem.id,
        itemName: fullItem.itemName,
        quantity: fullItem.quantity,
        quantityInput: fullItem.quantityInput,
        displayFormat: fullItem.displayFormat,
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: fullItem.purchaseInfo?.isPurchased ?? false,
        },
        version: fullItem.version,
        updatedAt: fullItem.updatedAt,
        category: fullItem.category,
        notes: fullItem.notes,
        unitName: fullItem.unitName,
        unit: fullItem.unit
          ? {
              __typename: 'Unit',
              id: fullItem.unit.id,
              name: fullItem.unit.name,
              symbol: fullItem.unit.symbol,
              displayAsFraction: fullItem.unit.displayAsFraction,
              minPrecision: fullItem.unit.minPrecision,
              autoConvertThreshold: fullItem.unit.autoConvertThreshold,
            }
          : null,
      };

      Object.keys(updates).forEach(field => {
        const value = updates[field as keyof ShoppingListItemUpdate];
        if (value !== undefined) {
          optimisticDataPersistence.save('ShoppingListItem', itemId, field, value);
        }
      });

      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: { ...updates, version: coreFields.version },
        },
        optimisticResponse: {
          __typename: 'Mutation',
          updateShoppingListItem: {
            ...coreFields,
            ...updates,
            updatedAt: new Date().toISOString(),
          } as any,
        },
      });

      return result.data?.updateShoppingListItem ?? false;
    } catch (error: any) {
      if (handleVersionConflict(error)) {
        Alert.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return false;
      }
      console.error('Update shopping list item error:', error);
      return false;
    }
  };

  const removeItem = async (itemId: string) => {
    const operation = createRemoveOperation({
      mutation: removeItemMutation,
      parentId: listId,
      itemId,
      operationName: 'Delete Shopping List Item',
    });
    return operation();
  };

  const toggleItem = useCallback(
    async (itemId: string) => {
      if (!listId) return false;

      try {
        const cacheId = client.cache.identify({
          __typename: 'ShoppingListItem',
          id: itemId,
        });

        let cachedItem = cacheId
          ? client.readFragment<any>({
              id: cacheId,
              fragment: ShoppingListItemDisplayFragmentDoc,
              fragmentName: 'ShoppingListItemDisplayFragment',
            })
          : null;

        if (!cachedItem) {
          const fallbackItem = items.find(item => item.id === itemId);
          if (!fallbackItem) return false;
          cachedItem = fallbackItem;
        }

        const newStatus = !cachedItem.purchaseInfo?.isPurchased;

        const result = await togglePurchasedMutation({
          variables: { id: itemId, purchased: newStatus },
        });

        return result.data?.toggleShoppingListItemPurchased ?? false;
      } catch (error) {
        console.error('Toggle shopping list item purchased error:', error);
        return false;
      }
    },
    [listId, items, togglePurchasedMutation, client],
  );

  return {
    addItem,
    updateItem,
    removeItem,
    toggleItem,
  };
}
