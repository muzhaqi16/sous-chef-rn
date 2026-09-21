/**
 * Applies what a copy derive produced: one local-first create, then batch
 * adds carrying a client-minted id per line. Both are queued, so a copy made
 * offline shows immediately and replays parent-before-children.
 */

import { toastService } from '#/services/toastService';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addItemsInSlices,
  addOptimisticShoppingListItem,
  buildAddItemsReconcileUpdate,
  createOptimisticShoppingListItem,
} from '#features/shoppingList/cache/items';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import type { DerivedList } from '#features/shoppingList/utils/listFromTemplate';
import { t } from '#/i18n';
import { errorService } from '#/services/errorService';

export function useCopyShoppingList(fallbackErrorMessage: string) {
  const client = useApolloClient();
  const { createShoppingList, loading: creating } =
    useCreateShoppingList(fallbackErrorMessage);
  const [addItems, { loading: adding }] = useMutation(
    AddItemToShoppingListDocument,
    { update: buildAddItemsReconcileUpdate({}) },
  );

  /**
   * The new list's id, or null when the create could not be made. A refused
   * line batch is reported here and taken back; the list stands without it.
   */
  const copyList = async (
    derived: DerivedList,
    overrides: { homeId?: string | null } = {},
  ): Promise<string | null> => {
    const input = {
      ...derived.list,
      ...(overrides.homeId !== undefined && {
        homeId: overrides.homeId ?? undefined,
      }),
    };

    const created = await createShoppingList(input);
    if (created.status === 'failed') {
      toastService.error(created.body);
      return null;
    }
    const listId = created.shoppingList.id;

    for (const line of derived.items) {
      writeLineToCache(listId, line.id, derived);
    }

    const failure = await addItemsInSlices(
      client.cache,
      listId,
      derived.items,
      slice =>
        addItems({
          variables: { input: { shoppingListId: listId, items: slice } },
          context: { localFirst: true },
        }),
      {
        document: AddItemToShoppingListDocument,
        fallback: fallbackErrorMessage,
      },
    );
    if (failure) toastService.error(failure.body);

    return listId;
  };

  function writeLineToCache(
    listId: string,
    lineId: string | null | undefined,
    derived: DerivedList,
  ) {
    if (!lineId) return;
    const display = derived.display.get(lineId);
    if (!display) return;
    // Built before the try: a value block inside one bails the whole function
    // out of the React Compiler.
    const row = createOptimisticShoppingListItem(lineId, {
      shoppingListId: listId,
      itemName: display.itemName || t('labels.item'),
      quantity: display.quantity,
      quantityInput: display.quantityInput,
      unitName: display.unitName,
      category: display.category,
      itemId: display.itemId,
      unitId: display.unitId,
    });
    try {
      addOptimisticShoppingListItem(client.cache, listId, row);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Copy shopping list (optimistic)',
      });
    }
  }

  return { copyList, copying: creating || adding };
}
