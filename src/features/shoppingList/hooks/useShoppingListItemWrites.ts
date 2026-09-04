import {
  useApolloClient,
  useFragment,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import {
  AddItemToShoppingListDocument,
  UpdateShoppingListItemDocument,
  GetShoppingListItemDocument,
  type UpdateShoppingListItemMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import type {
  BatchAddShoppingListItemInput,
  UpdateShoppingListItemInput,
} from '#/graphql/generated/schemaTypes';
import { UseShoppingListItemForm_ItemFragmentDoc } from '#features/shoppingList/hooks/useShoppingListItemForm.generated';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
  buildAddItemsReconcileUpdate,
  type OptimisticShoppingListItemFields,
} from '#features/shoppingList/cache/items';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';

/** What became of an update. `data` carries the field a refusal names. */
export interface UpdateOutcome {
  status: 'ok' | 'rejected';
  data: UpdateShoppingListItemMutation | null | undefined;
}

/**
 * The item an edit form loads, and the two writes it can make. The create
 * writes the row into the cache before firing and leaves it there, so it shows
 * immediately and survives being queued offline.
 */
export function useShoppingListItemWrites(
  listId: string,
  itemId: string | undefined,
) {
  const client = useApolloClient();

  const { data } = useQuery(GetShoppingListItemDocument, {
    variables: { id: itemId || '' },
    skip: !itemId,
  });

  // The form hook owns its own narrow fragment. Subscribing to the entity's
  // cache record is what lets an edit made elsewhere flow back in with no
  // refetch.
  const itemFragmentRef = data?.shoppingListItem ?? null;
  const itemFragmentResult = useFragment({
    fragment: UseShoppingListItemForm_ItemFragmentDoc,
    fragmentName: 'useShoppingListItemForm_item',
    from: itemFragmentRef,
  });
  const itemData =
    itemFragmentRef && itemFragmentResult.complete
      ? itemFragmentResult.data
      : null;

  const [addItemMutation] = useMutation(AddItemToShoppingListDocument, {
    // Reconcile the server response with the item written into the cache before
    // the create fired.
    update: buildAddItemsReconcileUpdate({ listId }),
    onError: error => {
      errorService.reportError(error, {
        operation: 'ShoppingListItem.addItem',
      });
    },
  });

  const [updateItemMutation] = useMutation(UpdateShoppingListItemDocument, {
    onError: error => {
      errorService.reportError(error, {
        operation: 'ShoppingListItem.updateItem',
      });
    },
  });

  const createItem = async (
    optimistic: OptimisticShoppingListItemFields,
    input: Omit<BatchAddShoppingListItemInput, 'id'>,
  ) => {
    const id = generateEntityId();
    try {
      addOptimisticShoppingListItem(
        client.cache,
        listId,
        createOptimisticShoppingListItem(id, optimistic),
      );
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Shopping List Item (optimistic)',
      });
    }

    const result = await addItemMutation({
      variables: {
        input: { shoppingListId: listId, items: [{ ...input, id }] },
      },
      context: { localFirst: true },
    });

    return reconcileShoppingCreate(client.cache, listId, id, result);
  };

  const updateItem = async (
    input: UpdateShoppingListItemInput,
  ): Promise<UpdateOutcome> => {
    const result = await updateItemMutation({ variables: { input } });
    // 'queued' carries `updateShoppingListItem: null` — a payload check alone
    // reads that offline save as a refusal.
    return {
      status: classifyCreateResult(result) === 'rejected' ? 'rejected' : 'ok',
      data: result.data,
    };
  };

  return { itemData, createItem, updateItem };
}
