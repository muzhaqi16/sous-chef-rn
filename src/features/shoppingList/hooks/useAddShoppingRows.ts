import { useApolloClient, useMutation } from '@apollo/client/react';
import type { BatchAddShoppingListItemInput } from '#graphql/generated/schemaTypes';
import { settledStatus } from '#apollo/utils/settleMutation';
import {
  AddItemToShoppingListDocument,
  type AddItemToShoppingListMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addItemsInSlices,
  createShoppingListRow,
  type ShoppingRowFields,
  type ShoppingRowLine,
} from '#entities/shoppingList/createShoppingListRow';
import { isListedToBuy } from '#entities/shoppingList/connections';
import type { LocalShoppingListItem } from '#entities/shoppingList/items';

/** What an add-to-list answers, for a surface that reads it. */
export type AddShoppingRowsAnswer = AddItemToShoppingListMutation;

/** One batch, as it ended: what was sent, and what the server said of it. */
export interface AddedBatch<TItem> {
  sent: readonly TItem[];
  /** The server's answer; none when the batch failed. */
  answer: AddShoppingRowsAnswer | null | undefined;
  /** The batch was refused whole, so none of its rows landed. */
  failed: boolean;
  /** Whether the list showed this row before the answer landed. */
  wasListed: (rowId: string) => boolean;
}

/**
 * The one door to adding lines to a list, from any feature: one document, one
 * local write, one replay. `addRow` adds a line and settles it; `addRows` sends
 * many in batches the API accepts, each settled on its own, and tells
 * `onBatch` how each one ended.
 */
export function useAddShoppingRows() {
  const client = useApolloClient();
  const [mutate, { loading: adding }] = useMutation(
    AddItemToShoppingListDocument,
    { context: { localFirst: true } },
  );

  const addRow = (args: {
    listId: string;
    row: ShoppingRowFields;
    line: ShoppingRowLine;
    fallback: string;
  }) =>
    createShoppingListRow(client.cache, {
      ...args,
      send: mutate,
      document: AddItemToShoppingListDocument,
    });

  const addRows = <TItem extends BatchAddShoppingListItemInput>(
    listId: string,
    items: readonly TItem[],
    rowOf: (line: TItem) => LocalShoppingListItem | null,
    fallback: string,
    onBatch?: (batch: AddedBatch<TItem>) => void,
  ) =>
    addItemsInSlices(
      client.cache,
      listId,
      items,
      rowOf,
      write => {
        const sent = write.variables.input.items;
        const refused = () =>
          onBatch?.({
            sent,
            answer: null,
            failed: true,
            wasListed: () => false,
          });
        return mutate({
          ...write,
          // Read before the answer is committed: a merged line counts as
          // already listed only when the list showed it beforehand.
          update: (cache, result) => {
            onBatch?.({
              sent,
              answer: result.data,
              failed: false,
              wasListed: rowId => isListedToBuy(cache, listId, rowId),
            });
            write.update(cache, result);
          },
        }).then(
          result => {
            if (settledStatus(result) === 'failed') refused();
            return result;
          },
          (error: unknown) => {
            refused();
            throw error;
          },
        );
      },
      { document: AddItemToShoppingListDocument, fallback },
    );

  return {
    addRow,
    addRows,
    /** A batch is on its way to the server. */
    adding,
  };
}
