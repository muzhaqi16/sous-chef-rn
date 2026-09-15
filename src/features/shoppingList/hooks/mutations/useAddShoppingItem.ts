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
} from '#features/shoppingList/cache/items';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';
import type { ShoppingListItemInput } from './types';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { parseFractionalInput } from '#/utils/fractionUtils';
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
  const { t } = useTranslation();

  const [addItemMutation] = useMutation(AddItemToShoppingListDocument, {
    update: buildAddItemsReconcileUpdate({
      listId,
      wrap: {
        operation: 'Cache update failed for addItem, will refetch:',
        refetch: () => {
          void refetch().catch(error =>
            errorService.reportError(error, {
              operation: 'AddShoppingItem.refetch',
            }),
          );
        },
      },
    }),
  });

  /** `true` once the item is added or its create is queued; `false` when refused. */
  const addItem = async (input: ShoppingListItemInput): Promise<boolean> => {
    if (!listId) return false;

    const id = generateEntityId();

    // The manual-add form sends a raw FlexibleQuantity string, quick-add a number;
    // the string wins (the server parses it). The optimistic entity needs its
    // numeric value, fractions included ("1 1/2" → 1.5).
    const typedQuantity = input.quantityInput
      ? parseFractionalInput(input.quantityInput)
      : null;
    const optimisticQuantity =
      typedQuantity !== null && typedQuantity > 0
        ? typedQuantity
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

    const settled = await settleMutation(
      () =>
        addItemMutation({
          variables: { input: { shoppingListId: listId, items: [itemInput] } },
          context: { localFirst: true },
        }),
      {
        document: AddItemToShoppingListDocument,
        fallback: t('errors.addItemFailed'),
        onFailed: () => {
          reconcileShoppingCreate(client.cache, listId, id, undefined);
        },
      },
    );
    if (settled.status === 'failed') return false;

    // The batch can apply while refusing its only item; that refusal carries no
    // code to classify, so it takes the caller's copy.
    const kept = reconcileShoppingCreate(client.cache, listId, id, {
      data: settled.data,
    });
    if (kept === 'reverted') {
      alertService.alert(t('labels.error'), t('errors.addItemFailed'));
      return false;
    }
    return true;
  };

  return { addItem };
}
