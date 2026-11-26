import { useApolloClient, useMutation } from '@apollo/client/react';
import type { BatchAddShoppingListItemInput } from '#graphql/generated/schemaTypes';
import { settledStatus } from '#apollo/utils/settleMutation';
import type { AddItemToShoppingListMutation } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addItemsInSlices,
  createShoppingListRow,
  type ShoppingRowFields,
  type ShoppingRowLine,
} from '#entities/shoppingList/createShoppingListRow';
import { isListedToBuy } from '#entities/shoppingList/connections';
import { addItemToShoppingListWrite } from '#features/shoppingList/offline/localWrites';
import { appliedPayload } from '#utils/errors/mutationPayload';
import type { LocalShoppingListItem } from '#entities/shoppingList/items';

/** What an add-to-list answers, for a surface that reads it. */
export type AddShoppingRowsAnswer = AddItemToShoppingListMutation;

/** The rows an applied answer names. */
const answeredRowIds = (data: AddShoppingRowsAnswer | null | undefined) =>
  (appliedPayload(data)?.results ?? []).flatMap(line =>
    line.item ? [line.item.id] : [],
  );

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
    addItemToShoppingListWrite.document,
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
      write: addItemToShoppingListWrite,
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
        let answer: AddShoppingRowsAnswer | null | undefined = null;
        let listed: ReadonlySet<string> = new Set();
        // Once, as the batch ended: the update runs for a refusal too.
        const report = (failed: boolean) =>
          onBatch?.({
            sent,
            answer: failed ? null : answer,
            failed,
            wasListed: rowId => !failed && listed.has(rowId),
          });
        return mutate({
          ...write,
          // Read before the answer is committed: a merged line counts as
          // already listed only when the list showed it beforehand.
          update: (cache, result) => {
            answer = result.data;
            listed = new Set(
              answeredRowIds(result.data).filter(rowId =>
                isListedToBuy(cache, listId, rowId),
              ),
            );
            write.update(cache, result);
          },
        }).then(
          result => {
            report(settledStatus(result) === 'failed');
            return result;
          },
          (error: unknown) => {
            report(true);
            throw error;
          },
        );
      },
      { write: addItemToShoppingListWrite, fallback },
    );

  return {
    addRow,
    addRows,
    /** A batch is on its way to the server. */
    adding,
  };
}
