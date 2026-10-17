import { useApolloClient, useMutation } from '@apollo/client/react';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import type { ScannedItem } from '#features/barcode/types';
import {
  AcquisitionMethod,
  type PackageSizeInput,
} from '#/graphql/generated/schemaTypes';
import { buildAddItemsReconcileUpdate } from '#features/shoppingList/cache/items';
import { createShoppingListRow } from '#features/shoppingList/cache/createShoppingListRow';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { usePantryRestock } from '#features/pantry/hooks/usePantryRestock';
import { refByIdOrName } from '#/utils/refInput';
import { useTranslation } from '#/i18n';

/** A scanned item is always one container: the per-container weight is separate. */
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

/** Whether the shopping-list row survived the create. */
export type ScannedListOutcome = 'kept' | 'reverted';

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
  const { restock } = usePantryRestock(pantryId);

  const [addToShoppingListMutation] = useMutation(
    BarcodeAddItemToShoppingListDocument,
    {
      context: { localFirst: true },
      update: buildAddItemsReconcileUpdate({ listId: shoppingListId }),
    },
  );

  // No `unit`, and `netWeight` only when the record states no pack size and the
  // user entered one: the scan's own figure is the record's to store, and one
  // sent here is kept as the user's. A refusal of an add carrying that size is
  // left to the caller, whose prompt can show it on the size.
  const addToPantry = (item: ScannedItem, packageSize?: PackageSizeInput) =>
    addItem(
      item.name,
      {
        item: scannedPantrySource(item),
        quantity: SCANNED_QUANTITY,
        ...(packageSize && { netWeight: packageSize }),
      },
      {
        local: {
          itemId: item.id,
          unitId: scannedUnitId(item),
          acquisitionMethod: AcquisitionMethod.BarcodeScan,
        },
        present: packageSize ? 'none' : 'alert',
      },
    );

  /**
   * Restock the row the duplicate check named by one container, of the size
   * the user entered when the record states none; with no size at all it goes
   * as a forced add (`usePantryRestock`). Resolves whether it stands, having
   * told the user when it does not.
   */
  const restockDuplicate = async (
    item: ScannedItem,
    existingPantryItemId: string,
    packageSize?: PackageSizeInput,
  ): Promise<boolean> => {
    const outcome = await restock(existingPantryItemId, {
      bought: {
        count: SCANNED_QUANTITY,
        packageSize,
        item: {
          source: scannedPantrySource(item),
          name: item.name,
          itemId: item.id,
        },
      },
      present: 'alert',
    });
    return outcome.status === 'restocked';
  };

  const addToShoppingList = async (
    item: ScannedItem,
  ): Promise<ScannedListOutcome> => {
    if (!shoppingListId) return 'reverted';
    const { outcome } = await createShoppingListRow(client.cache, {
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
    return outcome;
  };

  return {
    addToPantry,
    restockDuplicate,
    addToShoppingList,
  };
}
