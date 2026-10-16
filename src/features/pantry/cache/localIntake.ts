import type { ApolloCache } from '@apollo/client';
import type { CreatePantryItemInput } from '#/graphql/generated/schemaTypes';
import { localQuantity } from '#domain/stockAmount';
import { errorService } from '#/services/errorService';
import { addPantryItemLocally } from './items';
import {
  writeLocalPantryItem,
  type LocalPantryItem,
} from './writeLocalPantryItem';

/** What an add states, as the row it shows before the server answers reads it. */
export type IntakeStatement = Pick<
  CreatePantryItemInput,
  'item' | 'quantity' | 'unit' | 'amount' | 'storage' | 'purchase'
>;

/**
 * The row an add shows before the server answers. An item typed inline is
 * named by its client-minted id, which the server creates it under or keeps as
 * the matched item's alias.
 */
export function localIntakeRow(
  pantryId: string,
  itemName: string,
  input: IntakeStatement,
  local?: Omit<LocalPantryItem, 'pantryId' | 'itemName'>,
): LocalPantryItem {
  return {
    pantryId,
    itemName,
    itemId: input.item.id ?? input.item.inline?.id ?? null,
    quantity:
      input.quantity ??
      (input.amount ? localQuantity(input.amount, {}) : undefined),
    unitId:
      input.unit?.id ??
      input.amount?.measured?.unitId ??
      input.amount?.packages?.unitId,
    storageState: input.storage?.storageState,
    acquisitionMethod: input.purchase?.acquisitionMethod,
    ...local,
  };
}

/**
 * An add's local side, written before it fires: the row is written, published
 * AND counted, so the header cannot fall behind the list offline, where no
 * response arrives to correct it. The caller claims the minted id
 * (`unconfirmedCreates.mark`) before calling.
 */
export function writeLocalIntake(
  cache: ApolloCache,
  id: string,
  row: LocalPantryItem,
): void {
  try {
    writeLocalPantryItem(cache, id, row);
    addPantryItemLocally(cache, row.pantryId, { __typename: 'PantryItem', id });
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: 'Add Pantry Item (optimistic)',
    });
  }
}
