/**
 * useAddShoppingItem - Add item mutation for shopping list
 *
 * Single responsibility:
 * - Add mutation with optimistic response
 * - Cache update for instant UI
 * - Error handling with user feedback
 */

import { Alert } from 'react-native';
import {
  useAddItemToShoppingListMutation,
  DisplayFormat,
} from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { addToShoppingListItemsCache } from './utils';
import type { ShoppingListItemInput } from './types';

interface UseAddShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<any>;
}

/**
 * Hook for adding items to a shopping list
 *
 * @example
 * ```tsx
 * const { addItem } = useAddShoppingItem({ listId, refetch });
 * await addItem({ itemName: 'Milk', quantity: 2 });
 * ```
 */
export function useAddShoppingItem({ listId, refetch }: UseAddShoppingItemOptions) {
  const { handleApolloError } = useErrorHandler();
  const { createAddOperation } = useCrudOperations();

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

  return { addItem };
}
