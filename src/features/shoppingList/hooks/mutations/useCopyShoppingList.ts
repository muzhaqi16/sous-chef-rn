/**
 * Applies what a copy derive produced: one local-first create, then one batch
 * add carrying a client-minted id per line. Both are queued, so a copy made
 * offline shows immediately and replays parent-before-children.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
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

  /** The new list's id, or null when the create could not be made. */
  const copyList = async (
    derived: DerivedList,
    overrides: { homeId?: string | null } = {},
  ): Promise<string | null> => {
    // Built before the try: a value block inside one bails the whole function
    // out of the React Compiler.
    const input = {
      ...derived.list,
      ...(overrides.homeId !== undefined && {
        homeId: overrides.homeId ?? undefined,
      }),
    };

    // `createShoppingList` THROWS a refusal rather than returning one. Assign
    // in the try and read outside it, for the same reason.
    let created;
    try {
      created = await createShoppingList(input);
    } catch (error) {
      errorService.reportError(error, { operation: 'Copy shopping list' });
    }
    const listId = created?.id ?? null;
    if (!listId) return null;

    for (const line of derived.items) {
      writeLineToCache(listId, line.id, derived);
    }

    if (derived.items.length > 0) {
      try {
        await addItems({
          variables: {
            input: { shoppingListId: listId, items: derived.items },
          },
          context: { localFirst: true },
        });
      } catch (error) {
        errorService.reportError(error, {
          operation: 'Copy shopping list items',
        });
      }
    }

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
