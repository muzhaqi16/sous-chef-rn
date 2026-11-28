import { CreateOutcome } from '#graphql/generated/schemaTypes';
import { toastService } from '#services/toastService';
import { appliedPayload } from '#utils/errors/mutationPayload';
import {
  useAddShoppingRows,
  type AddedBatch,
} from '#features/shoppingList/hooks/useAddShoppingRows';
import { createLocalShoppingListItem } from '#entities/shoppingList/items';
import type { RecipeShoppingRow } from '#features/recipes/utils/recipeShoppingRows';

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
 * Counts a batch as it ends. A batch refused whole takes its rows back. A
 * MERGED line is an update only when the list already showed it: the server
 * also answers MERGED for a bought or removed line it reuses, which reappears.
 */
function tallyBatch(
  tally: AddTally,
  { sent, answer, failed, wasListed }: AddedBatch<{ id: string }>,
): void {
  if (failed) {
    for (const line of sent) tally.refused.add(line.id);
    return;
  }
  const lines = appliedPayload(answer)?.results ?? [];
  lines.forEach(line => {
    if (line.success === false || !line.item) {
      const refused = sent[line.index];
      if (refused) tally.refused.add(refused.id);
    } else if (
      line.outcome === CreateOutcome.Merged &&
      wasListed(line.item.id)
    ) {
      tally.updated += 1;
    }
  });
}

/**
 * The one door from a recipe to a list: a batch add whose rows the device
 * derives and mints, so it queues and replays. Resolves to what became of the
 * rows; a failure is shown.
 */
export function useAddRecipeRows() {
  const { addRows: sendRows } = useAddShoppingRows();

  /** Sends derived rows and resolves to what became of them, a failure shown. */
  const addRows = async (
    listId: string,
    rows: readonly RecipeShoppingRow[],
    fallback: string,
  ): Promise<AddOutcome> => {
    const tally: AddTally = { updated: 0, refused: new Set() };
    const displays = new Map(rows.map(row => [row.input.id, row.display]));
    const failure = await sendRows(
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
      fallback,
      batch => tallyBatch(tally, batch),
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
