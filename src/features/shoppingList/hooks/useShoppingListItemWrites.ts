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
} from '#features/shoppingList/graphql/shoppingList.generated';
import type {
  BatchAddShoppingListItemInput,
  ShoppingListItem,
  UpdateShoppingListItemInput,
} from '#/graphql/generated/schemaTypes';
import { setCachedFields } from '#/apollo/utils/cacheUpdaters';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { UseShoppingListItemForm_ItemFragmentDoc } from '#features/shoppingList/hooks/useShoppingListItemForm.generated';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
  buildAddItemsReconcileUpdate,
  type OptimisticShoppingListItemFields,
} from '#features/shoppingList/cache/items';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';

type LocalItemField = keyof Pick<
  ShoppingListItem,
  | 'itemName'
  | 'notes'
  | 'category'
  | 'priority'
  | 'sortOrder'
  | 'quantity'
  | 'quantityInput'
>;
type LocalItemFields = Partial<Pick<ShoppingListItem, LocalItemField>>;

const LOCAL_ITEM_FIELDS = [
  'itemName',
  'notes',
  'category',
  'priority',
  'sortOrder',
  'quantity',
  'quantityInput',
] satisfies LocalItemField[];

/**
 * The edited fields a cached `ShoppingListItem` holds in the input's own shape.
 * Nested inputs (pricing, store, brand, unit) cache differently and replay only.
 */
function localItemFields(input: UpdateShoppingListItemInput): LocalItemFields {
  const quantity: unknown = input.quantity;
  const parsed =
    typeof quantity === 'string' ? parseFractionalInput(quantity) : null;
  return {
    ...(input.itemName !== undefined && { itemName: input.itemName }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.priority != null && { priority: input.priority }),
    ...(input.sortOrder != null && { sortOrder: input.sortOrder }),
    ...(typeof quantity === 'string' && {
      quantityInput: quantity,
      ...(parsed !== null && { quantity: parsed }),
    }),
    ...(typeof quantity === 'number' && {
      quantity,
      quantityInput: String(quantity),
    }),
  };
}

/**
 * The item an edit form loads, and the two writes it can make. The create
 * writes the row into the cache before firing and leaves it there, so it shows
 * immediately and survives being queued offline. Each write resolves `true`
 * unless refused, and a refusal has already been alerted.
 */
export function useShoppingListItemWrites(
  listId: string,
  itemId: string | undefined,
) {
  const client = useApolloClient();
  const { t } = useTranslation();

  const { data, refetch } = useQuery(GetShoppingListItemDocument, {
    variables: { id: itemId ?? '' },
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
  });

  const [updateItemMutation] = useMutation(UpdateShoppingListItemDocument);

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

    const failureMessage = t('shoppingListScreens.serverNotUpdated', {
      action: t('shoppingListScreens.added'),
    });
    const settled = await settleMutation(
      () =>
        addItemMutation({
          variables: {
            input: { shoppingListId: listId, items: [{ ...input, id }] },
          },
          context: { localFirst: true },
        }),
      {
        document: AddItemToShoppingListDocument,
        fallback: failureMessage,
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
      alertService.alert(t('labels.error'), failureMessage);
      return false;
    }
    return true;
  };

  const updateItem = async (
    input: UpdateShoppingListItemInput,
    onConflictRefresh: () => void,
  ): Promise<boolean> => {
    // Local-first: the edit shows at once and survives a restart while queued.
    const fields = localItemFields(input);
    const persisted = LOCAL_ITEM_FIELDS.filter(
      field => fields[field] !== undefined,
    );
    setCachedFields(client.cache, 'ShoppingListItem', input.id, fields);
    for (const field of persisted) {
      optimisticDataPersistence.save(
        'ShoppingListItem',
        input.id,
        field,
        fields[field],
      );
    }
    const clearPersisted = () => {
      for (const field of persisted) {
        optimisticDataPersistence.clear('ShoppingListItem', input.id, field);
      }
    };

    // A refusal naming a field gets that field's copy: this mutation carries
    // brand, net weight, unit and storage in one call.
    const settled = await settleMutation(
      () =>
        updateItemMutation({
          variables: { input },
          context: { localFirst: true },
          onCompleted: result => {
            if (appliedPayload(result)) clearPersisted();
          },
        }),
      {
        document: UpdateShoppingListItemDocument,
        fallback: t('shoppingListScreens.serverNotUpdated', {
          action: t('shoppingListScreens.updated'),
        }),
        onConflictRefresh,
        // The server still holds the item as it was; re-reading restores it.
        onFailed: () => {
          clearPersisted();
          void refetch().catch(error =>
            errorService.reportError(error, {
              operation: 'ShoppingListItemWrites.refetch',
            }),
          );
        },
      },
    );
    return settled.status !== 'failed';
  };

  return { itemData, createItem, updateItem };
}
