import { useApolloClient, useMutation } from '@apollo/client/react';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import type { ScanAmount, ScannedItem } from '#features/barcode/types';
import {
  AcquisitionMethod,
  type StockAmountInput,
} from '#/graphql/generated/schemaTypes';
import { createShoppingListRow } from '#features/shoppingList/cache/createShoppingListRow';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { refByIdOrName } from '#/utils/refInput';
import { stockAmountOf } from '#domain/stockAmount';
import { useTranslation } from '#/i18n';

/** A list line from a scan is one container: the per-container weight is separate. */
const SCANNED_QUANTITY = 1;

/**
 * A scan names the scanned barcode's product record when the lookup found one,
 * so the add stores that pack's size, brand and barcode; else the item.
 */
const scannedPantrySource = (item: ScannedItem) =>
  item.variationId ? { variation: item.variationId } : { id: item.id };
const scannedListItemRef = (item: ScannedItem) =>
  item.variationId ? { variation: item.variationId } : { itemId: item.id };

/** The unit an add naming none counts in; the default unit on a fresh item. */
const scannedUnitId = (item: ScannedItem) =>
  item.trackingUnit?.id ?? item.unitId;

/**
 * Packages always name their COUNT unit: left to the API, they land in the
 * item's tracking unit, which can be a measure, and a can becomes 3.4 cup.
 */
const scannedAmountOf = (amount: ScanAmount): StockAmountInput =>
  amount.packaged
    ? stockAmountOf(amount.count, {
        asPackages: true,
        packageSize: amount.size,
        unitId: amount.unitId,
      })
    : stockAmountOf(amount.quantity, { unitId: amount.unitId });

/** Whether the shopping-list row survived the create, and its id if it did. */
export type ScannedListOutcome =
  | { outcome: 'kept'; rowId: string }
  | { outcome: 'reverted'; rowId: null };

interface UseAddScannedItemArgs {
  pantryId: string | undefined;
  shoppingListId: string | undefined;
}

/**
 * Puts a scanned product into the pantry or onto a shopping list. Every write
 * lands in the cache before its mutation fires, so the row is there when the
 * destination comes into view and survives a create that queues offline.
 */
export function useAddScannedItem({
  pantryId,
  shoppingListId,
}: UseAddScannedItemArgs) {
  const client = useApolloClient();
  const { t } = useTranslation();
  const { addItem } = usePantryIntake(pantryId);

  const [addToShoppingListMutation] = useMutation(
    BarcodeAddItemToShoppingListDocument,
    { context: { localFirst: true } },
  );

  // A size goes only when the user gave one: one sent is kept as the user's,
  // not the record's. A refusal is the caller's to show, on the field it names.
  const addToPantry = (item: ScannedItem, amount: ScanAmount) =>
    addItem(
      item.name,
      {
        item: scannedPantrySource(item),
        amount: scannedAmountOf(amount),
        ...(amount.consumeUnitId && {
          consumeUnit: { id: amount.consumeUnitId },
        }),
      },
      {
        local: {
          itemId: item.id,
          unitId: amount.unitId,
          acquisitionMethod: AcquisitionMethod.BarcodeScan,
        },
        present: 'none',
      },
    );

  const addToShoppingList = async (
    item: ScannedItem,
  ): Promise<ScannedListOutcome> => {
    if (!shoppingListId) return { outcome: 'reverted', rowId: null };
    const { id, outcome } = await createShoppingListRow(client.cache, {
      listId: shoppingListId,
      row: {
        itemName: item.name,
        quantity: SCANNED_QUANTITY,
        itemId: item.id,
        unitId: scannedUnitId(item),
        unitName: item.trackingUnit?.symbol,
      },
      line: {
        item: scannedListItemRef(item),
        quantity: SCANNED_QUANTITY,
        // A record brings its own brand; one sent here would replace it.
        brand: item.variationId
          ? undefined
          : refByIdOrName(item.brandId, item.brandName),
      },
      send: addToShoppingListMutation,
      document: BarcodeAddItemToShoppingListDocument,
      fallback: t('errors.addItemFailed'),
    });
    return outcome === 'kept'
      ? { outcome, rowId: id }
      : { outcome, rowId: null };
  };

  return {
    addToPantry,
    addToShoppingList,
  };
}
