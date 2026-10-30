/**
 * Applies what a copy derive produced: one local-first create carrying the
 * first 50 lines, then batch adds for the rest, each line under a client-minted
 * id. All are queued, so a copy made offline shows immediately and replays
 * parent-before-children.
 */

import { toastService } from '#/services/toastService';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { addItemsInSlices } from '#features/shoppingList/cache/createShoppingListRow';
import { createLocalShoppingListItem } from '#features/shoppingList/cache/items';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import type { DerivedList } from '#features/shoppingList/utils/listFromTemplate';
import { t } from '#/i18n';

export function useCopyShoppingList(fallbackErrorMessage: string) {
  const client = useApolloClient();
  const { createShoppingList, loading: creating } =
    useCreateShoppingList(fallbackErrorMessage);
  const [addItems, { loading: adding }] = useMutation(
    AddItemToShoppingListDocument,
    { context: { localFirst: true } },
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

    const created = await createShoppingList(input, {
      items: derived.items,
      rowOf: (line, listId) => rowOf(line.id, listId, derived),
    });
    if (created.status === 'failed') {
      toastService.error(created.body);
      return null;
    }
    const listId = created.shoppingList.id;

    const failure = await addItemsInSlices(
      client.cache,
      listId,
      created.unsent,
      line => rowOf(line.id, listId, derived),
      addItems,
      {
        document: AddItemToShoppingListDocument,
        fallback: fallbackErrorMessage,
      },
    );
    if (failure) toastService.error(failure.body);

    return listId;
  };

  function rowOf(
    lineId: string | null | undefined,
    listId: string,
    derived: DerivedList,
  ) {
    const display = lineId ? derived.display.get(lineId) : undefined;
    if (!lineId || !display) return null;
    return createLocalShoppingListItem(lineId, {
      shoppingListId: listId,
      itemName: display.itemName || t('labels.item'),
      quantity: display.quantity,
      quantityInput: display.quantityInput,
      unitName: display.unitName,
      category: display.category,
      itemId: display.itemId,
      unitId: display.unitId,
    });
  }

  return { copyList, copying: creating || adding };
}
