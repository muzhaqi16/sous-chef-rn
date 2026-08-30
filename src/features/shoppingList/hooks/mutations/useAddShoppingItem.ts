/**
 * Local-first: the item is written to the cache PERMANENTLY before firing — an
 * `optimisticResponse` rolls back on the offline queue's null result. `input.id`
 * is the client-minted PK, so a queued replay converges on one row. If the server
 * merges into an existing catalog row its id differs: adopt it, evict the cuid.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
  buildAddItemsReconcileUpdate,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { handleMutationError } from '#/utils/errorHandlers';
import { isNetworkError } from '#/utils/isNetworkError';
import { generateEntityId } from '#/utils/generateEntityId';
import type { ShoppingListItemInput } from './types';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { errorService } from '#/services/errorService';

interface UseAddShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
}

export function useAddShoppingItem({
  listId,
  refetch,
}: UseAddShoppingItemOptions) {
  const client = useApolloClient();

  const [addItemMutation] = useMutation(AddItemToShoppingListDocument, {
    update: buildAddItemsReconcileUpdate({
      listId,
      wrap: {
        message: 'Cache update failed for addItem, will refetch:',
        refetch,
      },
    }),
    onError: error => {
      // Network/transient error: queueLink queued the create for replay — keep
      // the optimistic item; do NOT alert.
      if (isNetworkError(error)) return;
      handleMutationError(error, { operation: 'Add Shopping List Item' });
    },
  });

  const addItem = async (input: ShoppingListItemInput) => {
    if (!listId) return undefined;

    const id = generateEntityId();

    // The manual-add form sends a raw FlexibleQuantity string, quick-add a number;
    // the string wins (the server parses it). The optimistic entity needs a numeric
    // quantity, so the leading number is taken ("1/3" → 1), as the form does.
    const optimisticQuantity = input.quantityInput
      ? parseDecimalInput(input.quantityInput) || 1
      : input.quantity ?? 1;

    // `shoppingListId` rides on the batch input below, not on the item.
    const itemInput = {
      id,
      item: { itemName: input.itemName },
      quantity: input.quantityInput ?? input.quantity ?? 1,
      ...((input.unitName || input.unitId) && {
        unit: {
          ...(input.unitId && { unitId: input.unitId }),
          ...(input.unitName && { unitName: input.unitName }),
        },
      }),
      ...(input.notes && { notes: input.notes }),
      ...(input.category && { category: input.category }),
      ...(input.estimatedPrice && {
        pricing: { estimatedPrice: parseDecimalInput(input.estimatedPrice) },
      }),
      ...((input.brandName || input.brandId) && {
        brand: {
          ...(input.brandId && { brandId: input.brandId }),
          ...(input.brandName && { brandName: input.brandName }),
        },
      }),
      // Net weight is all-or-nothing — only send when both value and unit are set.
      ...(input.netWeight !== undefined &&
        input.netWeightUnitId && {
          netWeight: {
            netWeight: input.netWeight,
            netWeightUnitId: input.netWeightUnitId,
          },
        }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.preferredStoreId && {
        storePrefs: { preferredStoreId: input.preferredStoreId },
      }),
    };

    const optimisticItem = createOptimisticShoppingListItem(id, {
      shoppingListId: listId,
      itemName: input.itemName ?? '',
      quantity: optimisticQuantity,
      quantityInput: input.quantityInput ?? null,
      unitName: input.unitName ?? null,
      category: input.category ?? null,
      itemId: undefined,
      unitId: input.unitId,
    });

    try {
      addOptimisticShoppingListItem(client.cache, listId, optimisticItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Shopping List Item (optimistic)',
      });
    }

    let result;
    try {
      result = await addItemMutation({
        variables: { input: { shoppingListId: listId, items: [itemInput] } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Add Shopping List Item error:',
      });
    }
    if (!result) return undefined;

    // Under errorPolicy:'all' a refusal resolves as DATA with no thrown error, so
    // `onError` never fires — the reconciler classifies it and fully reverts. A
    // queued create resolves with no data and no error, so it stays and replays.
    if (
      reconcileShoppingCreate(client.cache, listId, id, result) === 'reverted'
    ) {
      return undefined;
    }
    const payload = result.data?.addItemsToShoppingList;
    return payload?.__typename === 'AddItemsToShoppingListPayload'
      ? payload.results[0]?.item
      : undefined;
  };

  return { addItem };
}
