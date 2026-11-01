import type { ApolloCache } from '@apollo/client';
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
import { localBrand, localUnit } from '#features/catalog/cache/localRefs';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { parseStoredQuantityText } from '#/utils/formatQuantity';
import { UseShoppingListItemForm_ItemFragmentDoc } from '#features/shoppingList/hooks/useShoppingListItemForm.generated';
import {
  createShoppingListRow,
  type ShoppingRowFields,
  type ShoppingRowLine,
} from '#features/shoppingList/cache/createShoppingListRow';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useDataState } from '#hooks/data/useDataState';
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
    | 'unitName'
    | 'netWeight'
  >
> &
  Readonly<Record<string, unknown>>;

/** What an edit's fields show, where its input carries only an id. */
export interface ShownLabels {
  brand: string;
  store: string;
  netWeightUnit: string;
}

function localUnitFields(
  cache: ApolloCache,
  { unit, unitLabel }: UpdateShoppingListItemInput,
): LocalItemFields {
  if (unit === undefined) return {};
  const unitId = unit?.id ?? null;
  return {
    unitName: unitLabel ?? null,
    unit: unitId ? localUnit(cache, unitId, unitLabel ?? '') : null,
  };
}

function localNetWeightFields(
  cache: ApolloCache,
  { netWeight }: UpdateShoppingListItemInput,
  label: string,
): LocalItemFields {
  if (!netWeight) return {};
  const { netWeightUnitId } = netWeight;
  if (netWeight.netWeight == null) {
    return { netWeight: null, netWeightUnit: null };
  }
  return {
    netWeight: netWeight.netWeight,
    ...(netWeightUnitId && {
      netWeightUnit: localUnit(cache, netWeightUnitId, label),
    }),
  };
}

function localBrandFields(
  cache: ApolloCache,
  { brand }: UpdateShoppingListItemInput,
  label: string,
): LocalItemFields {
  if (brand === undefined) return {};
  return { brand: brand ? localBrand(cache, brand.id, label) : null };
}

/**
 * The edited fields a cached `ShoppingListItem` holds, in the row's own shape.
 * `quantity`, `amount` and the rest the server derives wait for its answer.
 */
function localItemFields(
  cache: ApolloCache,
  input: UpdateShoppingListItemInput,
  labels: ShownLabels,
): LocalItemFields {
  const quantity: unknown = input.quantity;
  const storeId = input.storePrefs?.preferredStoreId;
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
    ...(input.pricing?.estimatedPrice !== undefined && {
      priceEstimate: {
        __typename: 'PriceEstimate',
        estimated: input.pricing.estimatedPrice,
      },
    }),
    ...(storeId !== undefined && {
      storeInfo: {
        __typename: 'ShoppingListItemStoreInfo',
        preferredStore: storeId
          ? { __typename: 'Store', id: storeId, name: labels.store }
          : null,
      },
    }),
    ...localBrandFields(cache, input, labels.brand),
    ...localUnitFields(cache, input),
    ...localNetWeightFields(cache, input, labels.netWeightUnit),
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

  const { loading, error, refetch } = useQuery(
    ShoppingListItemForEditDocument,
    itemId ? { variables: { id: itemId } } : skipToken,
  );

  // Watched by ENTITY key, not read off the query result: a line the list holds
  // opens offline with no read, and an edit made elsewhere flows back in.
  const itemFragmentResult = useFragment({
    fragment: UseShoppingListItemForm_ItemFragmentDoc,
    fragmentName: 'useShoppingListItemForm_item',
    from: itemId ? { __typename: 'ShoppingListItem', id: itemId } : null,
  });
  const itemData = itemFragmentResult.complete ? itemFragmentResult.data : null;
  const itemState = useDataState({
    loading,
    error,
    hasResult: itemData !== null,
    isEmpty: false,
  });

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
    labels: ShownLabels,
    onConflictRefresh: () => void,
  ): Promise<boolean> => {
    const inputs: UpdateRowInputs = {
      fields: localItemFields(client.cache, input, labels),
    };
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

  return { itemData, itemState, retryItem: refetch, createItem, updateItem };
}
