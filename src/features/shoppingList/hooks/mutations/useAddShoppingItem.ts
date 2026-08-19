/**
 * useAddShoppingItem - Add item mutation for shopping list (local-first).
 *
 * Generates the item's id client-side and writes the item into the cache before
 * firing the create, leaving it there. The item shows instantly and stays if the
 * create is queued offline or the API is unreachable — the server stores
 * `input.id` as the primary key and the queue replays the create keyed by that
 * same id, so they converge on one row. An `optimisticResponse` can't be used
 * here: Apollo would roll it back the moment the request is queued (null result).
 *
 * Catalog-merge caveat (shopping only): if the server merges the new item into an
 * existing catalog row on the list, the returned `id` differs from our cuid — we
 * adopt the server `serverId` and evict the optimistic cuid entity.
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
    // Reconcile the server response with the item written into the cache before
    // the create fired; on a cache-update failure fall back to a refetch.
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

    // Local-first: mint the permanent cuid id (the row's real PK).
    const id = generateEntityId();

    // The manual-add form sends a raw FlexibleQuantity string; quick-add sends a
    // number. Prefer the string when present (the server parses it). The
    // optimistic entity still needs a numeric quantity — parseFloat takes the
    // leading number ("1/3" → 1), matching the screen form's optimistic value.
    const optimisticQuantity = input.quantityInput
      ? parseDecimalInput(input.quantityInput) || 1
      : input.quantity ?? 1;

    // One item per add — the batch mutation wraps it below. `shoppingListId`
    // rides on the batch input, not the item.
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
      itemName: input.itemName ?? '',
      quantity: optimisticQuantity,
      quantityInput: input.quantityInput ?? null,
      unitName: input.unitName ?? null,
      category: input.category ?? null,
      itemId: undefined,
      unitId: input.unitId,
    });

    // Write the item into the cache (full entity + connection edge + recomputed
    // list stats) before firing, so it shows immediately and stays if the create
    // is queued offline.
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

    // A non-success payload (e.g. ValidationError / ConflictError) resolves under
    // errorPolicy:'all' with no thrown error, so `onError` never fires — the
    // reconciler classifies the result and fully reverts the optimistic item
    // (entity + list stats) on a real rejection. A queued create (offline / API
    // down) resolves with no data and no error → it stays and replays.
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
