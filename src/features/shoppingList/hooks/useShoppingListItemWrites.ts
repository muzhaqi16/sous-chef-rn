import {
  skipToken,
  useApolloClient,
  useFragment,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import {
  AddItemToShoppingListDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ShoppingListItemForEditDocument } from './useShoppingListItemWrites.generated';
import type {
  ShoppingListItem,
  UpdateShoppingListItemInput,
} from '#/graphql/generated/schemaTypes';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { parseStoredQuantityText } from '#/utils/formatQuantity';
import { UseShoppingListItemForm_ItemFragmentDoc } from '#features/shoppingList/hooks/useShoppingListItemForm.generated';
import {
  createShoppingListRow,
  type ShoppingRowFields,
  type ShoppingRowLine,
} from '#features/shoppingList/cache/createShoppingListRow';
import { settleMutation } from '#/apollo/utils/settleMutation';
import type { UpdateRowInputs } from '#features/shoppingList/offline/localWrites';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { useTranslation } from '#/i18n';

type LocalItemFields = Partial<
  Pick<
    ShoppingListItem,
    | 'itemName'
    | 'notes'
    | 'category'
    | 'priority'
    | 'sortOrder'
    | 'quantity'
    | 'quantityInput'
  >
>;

/**
 * The edited fields a cached `ShoppingListItem` holds in the input's own shape.
 * Nested inputs (pricing, store, brand, unit) cache differently and replay only.
 */
function localItemFields(input: UpdateShoppingListItemInput): LocalItemFields {
  const quantity: unknown = input.quantity;
  // The input carries API text, so "1.250" is one and a quarter on any device.
  const parsed =
    typeof quantity === 'string' ? parseStoredQuantityText(quantity) : null;
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
 * The item an edit form loads, and its two writes. The create caches the row
 * before firing and leaves it, so it shows at once and survives an offline
 * queue. Each resolves `true` unless refused, the refusal already alerted.
 */
export function useShoppingListItemWrites(
  listId: string,
  itemId: string | undefined,
) {
  const client = useApolloClient();
  const { t } = useTranslation();

  const { data } = useQuery(
    ShoppingListItemForEditDocument,
    itemId ? { variables: { id: itemId } } : skipToken,
  );

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

  const [addItemMutation] = useMutation(AddItemToShoppingListDocument);

  const [updateItemMutation] = useMutation(UpdateShoppingListItemDocument, {
    context: { localFirst: true },
  });

  const createItem = async (row: ShoppingRowFields, line: ShoppingRowLine) => {
    const created = await createShoppingListRow(client.cache, {
      listId,
      row,
      line,
      send: addItemMutation,
      document: AddItemToShoppingListDocument,
      fallback: t('shoppingListScreens.serverNotUpdated', {
        action: t('shoppingListScreens.added'),
      }),
    });
    if (created.failure) {
      alertService.alert(created.failure.title, created.failure.body);
      return false;
    }
    const [result] = appliedPayload(created.data)?.results ?? [];
    if (result?.packageSizeCleared) {
      toastService.info(t('shoppingListScreens.packageSizeCleared'));
    }
    return created.outcome === 'kept';
  };

  const updateItem = async (
    input: UpdateShoppingListItemInput,
    onConflictRefresh: () => void,
  ): Promise<boolean> => {
    const inputs: UpdateRowInputs = { fields: localItemFields(input) };
    // A refusal naming a field gets that field's copy: this mutation carries
    // brand, net weight, unit and storage in one call.
    const settled = await pendingWritesOf(client.cache).send(
      UpdateShoppingListItemDocument,
      { input },
      write =>
        settleMutation(() => updateItemMutation(write), {
          document: UpdateShoppingListItemDocument,
          fallback: t('shoppingListScreens.serverNotUpdated', {
            action: t('shoppingListScreens.updated'),
          }),
          onConflictRefresh,
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  return { itemData, createItem, updateItem };
}
