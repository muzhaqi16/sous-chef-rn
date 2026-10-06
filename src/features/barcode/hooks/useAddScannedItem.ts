import { useApolloClient, useMutation } from '@apollo/client/react';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import type { ScannedItem } from '#features/barcode/types';
import {
  AcquisitionMethod,
  type PackageSizeInput,
} from '#/graphql/generated/schemaTypes';
import {
  addLocalShoppingListItem,
  buildAddItemsReconcileUpdate,
  createLocalShoppingListItem,
  reconcileShoppingCreate,
} from '#features/shoppingList/cache/items';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { usePantryRestock } from '#features/pantry/hooks/usePantryRestock';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import { refByIdOrName } from '#/utils/refInput';

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
   * the user entered when the record states none. Resolves whether the restock
   * stands, having told the user when it does not.
   */
  const restockDuplicate = async (
    existingPantryItemId: string,
    packageSize?: PackageSizeInput,
  ): Promise<boolean> => {
    const outcome = await restock(existingPantryItemId, {
      bought: { count: SCANNED_QUANTITY, packageSize },
      present: 'alert',
    });
    return outcome.status === 'restocked';
  };

  const addToShoppingList = async (
    item: ScannedItem,
  ): Promise<ScannedListOutcome> => {
    if (!shoppingListId) return 'reverted';
    const id = generateEntityId();

    // Built before the try: `?.`/`??` are value blocks, and one inside a try
    // body bails the React Compiler out of the whole function.
    const optimisticListItem = createLocalShoppingListItem(id, {
      shoppingListId,
      itemName: item.name,
      quantity: SCANNED_QUANTITY,
      itemId: item.id,
      unitId: scannedUnitId(item),
      unitName: item.trackingUnit?.symbol,
    });
    try {
      addLocalShoppingListItem(
        client.cache,
        shoppingListId,
        optimisticListItem,
      );
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Shopping List Item (optimistic)',
      });
    }

    const variables = {
      input: {
        shoppingListId,
        items: [
          {
            id,
            item: scannedListItemRef(item),
            quantity: SCANNED_QUANTITY,
            // A record brings its own brand; one sent here would replace it.
            brand: item.variationId
              ? undefined
              : refByIdOrName(item.brandId, item.brandName),
          },
        ],
      },
    };

    const result = await addToShoppingListMutation({
      variables,
    });

    // A queued create (offline / API down) resolves with no data and no error —
    // that is success, it replays. `errorPolicy: 'all'` delivers rejections to
    // the resolved result, so the reconciler classifies it (and fully reverts
    // the item — entity plus list-stat scalars) rather than relying on a throw.
    return reconcileShoppingCreate(client.cache, shoppingListId, id, result);
  };

  return {
    addToPantry,
    restockDuplicate,
    addToShoppingList,
  };
}
