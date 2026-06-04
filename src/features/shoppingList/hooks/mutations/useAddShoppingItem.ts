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
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import {
  addNewItemToShoppingListCache,
  addOptimisticShoppingListItem,
  adoptServerShoppingListItemId,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { handleMutationError } from '#/utils/errorHandlers';
import { isNetworkError } from '#/utils/isNetworkError';
import { generateEntityId } from '#/utils/generateEntityId';
import type { ShoppingListItemInput } from './types';

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
    update(cache, { data }, { variables }) {
      const payload = data?.addItemToShoppingList;
      if (
        payload?.__typename !== 'AddItemToShoppingListPayload' ||
        !listId ||
        !variables
      ) {
        return;
      }
      const item = payload.shoppingListItem;

      // Catalog-merge: adopt the server id, evicting the optimistic cuid if the
      // server merged into an existing row. Reads the id off this mutation's own
      // variables (not a shared ref) so it stays correct when adds overlap.
      adoptServerShoppingListItemId(cache, item.id, variables.input.id);

      executeCacheUpdate(
        () => addNewItemToShoppingListCache(cache, listId, item),
        'Cache update failed for addItem, will refetch:',
        refetch,
      );
    },
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

    const createInput = {
      id,
      shoppingListId: listId,
      itemName: input.itemName,
      quantity: input.quantity ?? 1,
      ...((input.unitName || input.unitId) && {
        unit: {
          ...(input.unitId && { unitId: input.unitId }),
          ...(input.unitName && { unitName: input.unitName }),
        },
      }),
      ...(input.notes && { notes: input.notes }),
      ...(input.category && { category: input.category }),
    };

    const optimisticItem = createOptimisticShoppingListItem(id, {
      itemName: input.itemName ?? '',
      quantity: input.quantity ?? 1,
      quantityInput: null,
      unitName: input.unitName ?? null,
      category: input.category ?? null,
      itemId: undefined,
      unitId: input.unitId,
    });

    // Write the item into the cache (full entity + connection edge + recomputed
    // list stats) before firing, so it shows immediately and stays if the create
    // is queued offline.
    executeCacheUpdate(
      () => addOptimisticShoppingListItem(client.cache, listId, optimisticItem),
      'Add Shopping List Item (optimistic)',
    );

    const result = await executeMutation(
      () =>
        addItemMutation({
          variables: { input: createInput },
          context: { localFirst: true },
        }),
      'Add Shopping List Item error:',
    );
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
    return result.data?.addItemToShoppingList;
  };

  return { addItem };
}
