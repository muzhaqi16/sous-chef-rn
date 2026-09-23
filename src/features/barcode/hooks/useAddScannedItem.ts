import { gql } from '@apollo/client';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  BarcodeAddItemToShoppingListDocument,
  BarcodeCreatePantryItemDocument,
  BarcodeRestockPantryItemDocument,
} from '#features/barcode/hooks/useAddScannedItem.generated';
import {
  SearchResults_PantryItemFragmentDoc,
  type SearchResults_PantryItemFragment,
} from '#features/barcode/components/SearchResults.generated';
import type { ScannedItem } from '#features/barcode/store/barcodeScannerStore';
import {
  AcquisitionMethod,
  type CreatePantryItemInput,
} from '#/graphql/generated/schemaTypes';
import {
  createAddToParentConnectionUpdater,
  adoptServerEntityId,
} from '#/apollo/utils/cacheUpdaters';
import {
  addOptimisticShoppingListItem,
  reconcileShoppingItemCreateUpdate,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
} from '#features/shoppingList/cache/items';
import {
  addPantryItemLocally,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { writePantryItemDetailStub } from '#features/pantry/hooks/writePantryItemDetailStub';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { getPantryItemDuplicateFromResult } from '#domain/pantryItemDuplicate';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { generateEntityId } from '#/utils/generateEntityId';
import { toDateKey } from '#/utils/dateUtils';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

// Only reads `{ id }` from the new item, so the local SearchResults_pantryItem
// fragment is sufficient.
const addToPantryItemsConnection =
  createAddToParentConnectionUpdater<SearchResults_PantryItemFragment>(
    'Pantry',
    'itemsConnection',
    'PantryItem',
  );

/** A scanned item is always one container: the per-container weight is separate. */
const SCANNED_QUANTITY = 1;

const RESTOCKED_QUANTITY = gql`
  fragment _ScannedRestockQuantity on PantryItem {
    id
    quantity
    heldQuantity
  }
`;

/** Whether the shopping-list row survived the create. */
export type ScannedListOutcome = 'kept' | 'reverted';

export type ScannedPantryOutcome =
  | { status: 'added' }
  | { status: 'duplicate'; existingPantryItemId: string }
  | { status: 'rejected' };

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
  const { t } = useTranslation();
  const client = useApolloClient();

  const [addToPantryMutation] = useMutation(BarcodeCreatePantryItemDocument, {
    update: (cache, { data }, { variables }) => {
      const payload = appliedPayload(data);
      if (!payload || !pantryId) return;
      const maskedPantryItem = payload.pantryItem;
      // Materialize the masked fragment ref so the updater can read `id`. Use
      // the cache-key form — passing the masked ref returns partial or null
      // data under `dataMasking`.
      const pantryItem = cache.readFragment<SearchResults_PantryItemFragment>({
        fragment: SearchResults_PantryItemFragmentDoc,
        fragmentName: 'SearchResults_pantryItem',
        from: { __typename: 'PantryItem', id: maskedPantryItem.id },
      });
      if (pantryItem) {
        addToPantryItemsConnection(cache, pantryId, pantryItem);
      }
      // The connection add dedupes BY ID, so a server-resolved id divergence
      // would leave the client cuid as a second, permanently unresolvable edge.
      adoptServerEntityId(
        cache,
        'PantryItem',
        maskedPantryItem.id,
        variables?.input.id,
      );
    },
  });

  const [restockPantryItem] = useMutation(BarcodeRestockPantryItemDocument, {});

  const [addToShoppingListMutation] = useMutation(
    BarcodeAddItemToShoppingListDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = appliedPayload(data);
        if (!payload || !shoppingListId || !variables) {
          return;
        }
        // Single add via the batch mutation — the created/merged row is the one
        // entry in `results`. Null when that item failed.
        const maskedItem = payload.results[0]?.item;
        if (!maskedItem) return;
        // Catalog-merge: the withdrawal takes `totalItems` back with the row
        // the server folded away, and the add is counted once.
        reconcileShoppingItemCreateUpdate(
          cache,
          shoppingListId,
          maskedItem,
          variables.input.items[0]?.id,
        );
      },
    },
  );

  const addToPantry = async (
    item: ScannedItem,
  ): Promise<ScannedPantryOutcome> => {
    if (!pantryId) return { status: 'rejected' };

    // Minted here so a create that gets queued (an API blip after the barcode
    // lookup) replays idempotently, keyed by this id. Publishing it to
    // `Pantry.itemsConnection` makes the row tappable into a detail screen that
    // queries by it — see `unconfirmedCreates`.
    const id = generateEntityId();
    unconfirmedCreates.mark(id);

    const input: CreatePantryItemInput = {
      id,
      pantryId,
      itemId: item.id,
      quantity: SCANNED_QUANTITY,
      today: toDateKey(new Date()),
      ...(item.netWeight != null && item.displayUnit?.id
        ? {
            netWeight: {
              netWeight: item.netWeight,
              netWeightUnitId: item.displayUnit.id,
            },
          }
        : {}),
    };

    // Built before the try: `?.`/`??` are value blocks, and one inside a try
    // body bails the React Compiler out of the whole function.
    const optimisticPantryItem = buildOptimisticPantryItem(
      id,
      {
        pantryId,
        itemName: item.name,
        itemId: item.id,
        quantity: SCANNED_QUANTITY,
        unitId: item.displayUnit?.id ?? item.unitId,
      },
      client.cache,
    );

    // Publishing and withdrawing the row are a pair; named so the halves
    // cannot drift.
    const apply = () => {
      try {
        // Publishes the row AND counts it: the header's "N items" reads
        // `Pantry.stats.totalItems`, which the mutation's `update` never
        // touches when the create is queued offline.
        addPantryItemLocally(client.cache, pantryId, optimisticPantryItem);
        // Detail-shape the same row so tapping it renders from cache instead of
        // querying an id the server does not have yet. A scanned add always
        // carries a catalog item, so `item` resolves to the real entity.
        writePantryItemDetailStub(client.cache, id, {
          itemId: item.id,
          itemName: item.name,
          acquisitionMethod: AcquisitionMethod.BarcodeScan,
          quantity: SCANNED_QUANTITY,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Add Pantry Item (optimistic)',
        });
      }
    };
    const revert = () => revertOptimisticPantryItem(client.cache, pantryId, id);

    apply();

    // `confirm` must run on every outcome, throws included, or the id stays
    // unconfirmed and suppresses the detail query for a visible row. The helper
    // is how a finalizer is written here: a bare `try/finally` bails the
    // React Compiler out of the whole function.
    let result: Awaited<ReturnType<typeof addToPantryMutation>> | undefined;
    let thrown: unknown;
    await executeAsyncWithCleanup(
      async () => {
        result = await addToPantryMutation({
          variables: { input },
          context: { localFirst: true },
        });
      },
      () => unconfirmedCreates.confirm(id),
      error => {
        thrown = error;
      },
    );

    // A duplicate arrives as a typed member in `data` OR as the legacy
    // top-level code; the shared helper checks both.
    const answered = result;
    const duplicateInfo = answered
      ? getPantryItemDuplicateFromResult(
          answered.data?.createPantryItem,
          answered.error,
        )
      : null;
    if (duplicateInfo) {
      // The server REFUSES the create and writes nothing, so withdraw the row
      // we published — count included.
      revert();
      return {
        status: 'duplicate',
        existingPantryItemId: duplicateInfo.existingPantryItemId,
      };
    }

    // Applied or queued keeps the row; a queued create replays later.
    const settled = await settleMutation(
      () => (answered ? Promise.resolve(answered) : Promise.reject(thrown)),
      {
        document: BarcodeCreatePantryItemDocument,
        fallback: t('errors.addItemFailedRetry'),
        onFailed: revert,
      },
    );
    return settled.status === 'failed'
      ? { status: 'rejected' }
      : { status: 'added' };
  };

  /**
   * Bump the row the duplicate check named instead of creating a second one.
   * Resolves whether the restock stands, having told the user when it does not.
   */
  const restockDuplicate = async (
    existingPantryItemId: string,
  ): Promise<boolean> => {
    // Offline no payload arrives, so the row keeps its old count until the
    // replay unless it is bumped here.
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: existingPantryItemId,
    });
    const cached = cacheId
      ? client.cache.readFragment<{ quantity: number; heldQuantity: number }>({
          id: cacheId,
          fragment: RESTOCKED_QUANTITY,
        })
      : null;
    const optimistic = optimisticFieldUpdate(
      client.cache,
      cacheId,
      cached
        ? { quantity: cached.quantity, heldQuantity: cached.heldQuantity }
        : null,
      {
        quantity: (cached?.quantity ?? 0) + SCANNED_QUANTITY,
        heldQuantity: (cached?.heldQuantity ?? 0) + SCANNED_QUANTITY,
      },
      'Restock scanned Pantry Item',
    );

    const settled = await settleMutation(
      () =>
        restockPantryItem({
          variables: {
            input: {
              id: existingPantryItemId,
              quantity: SCANNED_QUANTITY,
              // Dedupes the restock ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
          // Local-first: queued offline, replayed as the canonical mutation.
          context: { localFirst: true },
        }),
      {
        document: BarcodeRestockPantryItemDocument,
        fallback: t('errors.restockFailedRetry'),
        onFailed: optimistic.revert,
      },
    );
    return settled.status !== 'failed';
  };

  const addToShoppingList = async (
    item: ScannedItem,
  ): Promise<ScannedListOutcome> => {
    if (!shoppingListId) return 'reverted';
    const id = generateEntityId();

    // Built before the try, for the same compiler reason as above.
    const optimisticListItem = createOptimisticShoppingListItem(id, {
      shoppingListId,
      itemName: item.name,
      quantity: SCANNED_QUANTITY,
      itemId: item.id,
      unitId: item.displayUnit?.id ?? item.unitId,
      unitName: item.displayUnit?.name,
    });
    try {
      addOptimisticShoppingListItem(
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
            item: { itemId: item.id },
            quantity: SCANNED_QUANTITY,
            unit: {
              unitId: item.displayUnit?.id ?? item.unitId,
              unitName: item.displayUnit?.name,
            },
            brand:
              item.brandId || item.brandName
                ? { brandId: item.brandId, brandName: item.brandName }
                : undefined,
            netWeight: item.netWeight
              ? {
                  netWeight: item.netWeight,
                  netWeightUnitId: item.displayUnit?.id,
                }
              : undefined,
          },
        ],
      },
    };

    const result = await addToShoppingListMutation({
      variables,
      context: { localFirst: true },
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
