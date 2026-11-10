import type { ApolloCache } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateOutcome } from '#/graphql/generated/schemaTypes';
import { settledStatus } from '#/apollo/utils/settleMutation';
import { toastService } from '#/services/toastService';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { addItemsInSlices } from '#features/shoppingList/cache/createShoppingListRow';
import { isListedToBuy } from '#features/shoppingList/cache/connections';
import { createLocalShoppingListItem } from '#features/shoppingList/cache/items';
import type { RecipeShoppingRow } from '#features/recipes/utils/recipeShoppingRows';
import {
  AddItemsToShoppingListFromRecipeDocument,
  type AddItemsToShoppingListFromRecipeMutation,
} from './useRecipeShoppingList.generated';

/** What became of the rows sent: every row is added, updated or refused. */
export interface AddOutcome {
  added: number;
  updated: number;
  /** The minted ids of the rows that did not land, alone or with their slice. */
  refused: ReadonlySet<string>;
  /** A slice failed, and its message is already shown. */
  failed: boolean;
}

interface AddTally {
  updated: number;
  refused: Set<string>;
}

/**
 * Counts a batch's answer, before it is committed. A MERGED line is an update
 * only when the list already showed it: the server also answers MERGED for a
 * bought or removed line it reuses, which reappears on the list.
 */
function tallyLines(
  cache: ApolloCache,
  tally: AddTally,
  listId: string,
  sent: readonly { id: string }[],
  data: AddItemsToShoppingListFromRecipeMutation | null | undefined,
): void {
  const lines = appliedPayload(data)?.results ?? [];
  lines.forEach(line => {
    if (line.success === false || !line.item) {
      const refused = sent[line.index];
      if (refused) tally.refused.add(refused.id);
    } else if (
      line.outcome === CreateOutcome.Merged &&
      isListedToBuy(cache, listId, line.item.id)
    ) {
      tally.updated += 1;
    }
  });
}

/**
 * Sends one slice. A slice that fails takes its rows back, so they are recorded
 * as refused: the slices beside it still land, and their rows stay marked.
 */
function sendSlice<TResult extends { data?: unknown; error?: unknown }>(
  send: () => Promise<TResult>,
  slice: readonly { id: string }[],
  refused: Set<string>,
): Promise<TResult> {
  const markRefused = () => {
    for (const line of slice) refused.add(line.id);
  };
  return send().then(
    result => {
      if (settledStatus(result) === 'failed') markRefused();
      return result;
    },
    (error: unknown) => {
      markRefused();
      throw error;
    },
  );
}

/**
 * The one door from a recipe to a list: a batch add whose rows the device
 * derives and mints, so it queues and replays. Resolves to what became of the
 * rows; a failure is shown.
 */
export function useAddRecipeRows() {
  const client = useApolloClient();
  const [addItemsMutation] = useMutation(
    AddItemsToShoppingListFromRecipeDocument,
    { context: { localFirst: true } },
  );

  /** Sends derived rows and resolves to what became of them, a failure shown. */
  const addRows = async (
    listId: string,
    rows: readonly RecipeShoppingRow[],
    fallback: string,
  ): Promise<AddOutcome> => {
    const tally: AddTally = { updated: 0, refused: new Set() };
    const displays = new Map(rows.map(row => [row.input.id, row.display]));
    const failure = await addItemsInSlices(
      client.cache,
      listId,
      rows.map(row => row.input),
      line => {
        const display = displays.get(line.id);
        return display
          ? createLocalShoppingListItem(line.id, {
              shoppingListId: listId,
              itemName: display.itemName,
              quantity: display.quantity,
              quantityInput: null,
              unitName: display.unitName,
              category: null,
              itemId: display.itemId,
              unitId: undefined,
            })
          : null;
      },
      write =>
        sendSlice(
          () =>
            addItemsMutation({
              ...write,
              update: (cache, result) => {
                const { items } = write.variables.input;
                tallyLines(cache, tally, listId, items, result.data);
                write.update(cache, result);
              },
            }),
          write.variables.input.items,
          tally.refused,
        ),
      { document: AddItemsToShoppingListFromRecipeDocument, fallback },
    );
    if (failure) toastService.error(failure.body);
    // A queued row has no answer yet and replays on reconnect: it counts as added.
    return {
      added: rows.length - tally.updated - tally.refused.size,
      updated: tally.updated,
      refused: tally.refused,
      failed: failure !== null,
    };
  };

  return addRows;
}
