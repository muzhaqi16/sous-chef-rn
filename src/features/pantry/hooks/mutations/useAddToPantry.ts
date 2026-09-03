import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
  GetPantryDocument,
  GetPantryItemSuggestionsDocument,
  type GetPantryQuery,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import type { StorageLocation } from '#/graphql/generated/schemaTypes';
import {
  addPantryItemLocally,
  addToPantryItemsCache,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { writePantryItemDetailStub } from '#features/pantry/hooks/writePantryItemDetailStub';
import { findCachedPantryItemDuplicate } from '#features/pantry/utils/pantryCacheReaders';
import { getPantryItemDuplicateFromResult } from '#/utils/errors/pantryItemDuplicate';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import { adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { extractNodes } from '#/utils/connectionUtils';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';

/** What became of an add. The caller owns the toast and the animation. */
export type AddPantryItemOutcome =
  | { status: 'added' }
  | { status: 'duplicate'; existingPantryItemId: string }
  | { status: 'rejected' };

export type RestockOutcome = { status: 'restocked' } | { status: 'rejected' };

interface UseAddToPantryArgs {
  pantryId: string | undefined;
  suggestionsLimit: number;
}

/**
 * Every cache write and mutation the add-to-pantry sheet performs. What the
 * sheet keeps is the toast, the exit animation and the in-flight set; the
 * local-first write, its revert and the duplicate/refusal reading live here so
 * the sheet's two entry points cannot drift apart.
 */
export function useAddToPantry({
  pantryId,
  suggestionsLimit,
}: UseAddToPantryArgs) {
  const client = useApolloClient();

  const [createPantryItem] = useMutation(CreatePantryItemDocument, {
    update: (cache, { data }, { variables }) => {
      const payload = data?.createPantryItem;
      if (payload?.__typename !== 'CreatePantryItemPayload' || !pantryId)
        return;
      const pantryItem = payload.pantryItem;
      // Read outside the try: `?.` is a value block, and one inside a try body
      // bails the React Compiler out of the whole function.
      const clientId = variables?.input?.id;

      try {
        // NOT the counting helper: the eager write already counted this row.
        // This re-add reconciles the server's entity into the same edge.
        addToPantryItemsCache(cache, pantryId, pantryItem);
        // The re-add dedupes BY ID, so a server-resolved id divergence would
        // leave the client cuid as a second, permanently unresolvable edge.
        adoptServerEntityId(cache, 'PantryItem', pantryItem.id, clientId);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for createPantryItem:',
        });
      }
    },
  });

  const [restockPantryItem] = useMutation(RestockPantryItemDocument, {
    update: (cache, { data }) => {
      const payload = data?.restockPantryItem;
      if (payload?.__typename !== 'RestockPantryItemPayload' || !pantryId) {
        return;
      }
      const pantryItem = payload.pantryItemUsage.pantryItem;
      if (!pantryItem) return;
      // Forces the connection to broadcast: the row already exists, so the
      // re-add returns the connection unchanged, but `cache.modify` still makes
      // query watchers re-emit.
      addToPantryItemsCache(cache, pantryId, pantryItem);
    },
  });

  /** Drop a suggestion from every list it appears in, synchronously. */
  const removeSuggestion = (itemId: string) => {
    if (!pantryId) return;
    client.cache.updateQuery<GetPantryItemSuggestionsQuery>(
      {
        query: GetPantryItemSuggestionsDocument,
        variables: { pantryId, limit: suggestionsLimit },
      },
      data => {
        if (!data?.pantry) return data;
        const pantry = data.pantry;
        const without = <T extends { itemId: string }>(list: readonly T[]) =>
          list.filter(s => s.itemId !== itemId);
        return {
          ...data,
          pantry: {
            ...pantry,
            lowStock: without(pantry.lowStock),
            expiringSoon: without(pantry.expiringSoon),
            recentlyDeleted: without(pantry.recentlyDeleted),
            frequentlyAdded: without(pantry.frequentlyAdded),
            popular: without(pantry.popular),
          },
        };
      },
    );
  };

  /** The pantry's storage locations, read once from cache with no watcher. */
  const readStorageLocations = (): StorageLocation[] => {
    const cached = client.readQuery<GetPantryQuery>({
      query: GetPantryDocument,
      variables: { id: pantryId ?? '' },
    });
    return extractNodes(
      cached?.pantry?.storageLocationsConnection,
    ) as StorageLocation[];
  };

  /** Does this pantry already stock the item, as far as the cache knows? */
  const findCachedDuplicate = (itemId: string) =>
    pantryId
      ? findCachedPantryItemDuplicate(client.cache, pantryId, { itemId })
      : null;

  /**
   * Bump the row's quantity locally, then restock it — offline the mutation's
   * `update` never runs. A null `cachedQuantity` skips the bump, for a
   * duplicate the server named: that reaches us only online.
   */
  const restockItem = async (
    pantryItemId: string,
    cachedQuantity: number | null,
  ): Promise<RestockOutcome> => {
    const optimistic = optimisticFieldUpdate(
      client.cache,
      client.cache.identify({ __typename: 'PantryItem', id: pantryItemId }),
      cachedQuantity === null ? null : { quantity: cachedQuantity },
      { quantity: (cachedQuantity ?? 0) + 1 },
      'Restock Pantry Item',
    );

    let result;
    let threw = false;
    try {
      result = await restockPantryItem({
        variables: {
          input: {
            id: pantryItemId,
            quantity: 1,
            // Dedupes the restock ledger row on replay.
            idempotencyKey: generateEntityId(),
          },
        },
        context: { localFirst: true },
      });
    } catch {
      threw = true;
    }

    // A refused mutation RESOLVES under `errorPolicy: 'all'`, so a refusal
    // arrives as a payload to classify rather than as a thrown error.
    if (threw || !result || classifyCreateResult(result) === 'rejected') {
      optimistic.revert();
      return { status: 'rejected' };
    }
    return { status: 'restocked' };
  };

  /**
   * Write the row, fire the create, and report what became of it. The row is
   * written PERMANENTLY before firing so it survives being queued offline; a
   * refusal withdraws it, count included.
   */
  const addItem = async (
    itemId: string,
    itemName: string,
  ): Promise<AddPantryItemOutcome> => {
    if (!pantryId) return { status: 'rejected' };

    const id = generateEntityId();
    // Publishing this id to `Pantry.itemsConnection` makes the row tappable,
    // and its detail/edit screens query by it. Hold those off until the server
    // has the row — see `unconfirmedCreates`.
    unconfirmedCreates.mark(id);

    try {
      // Publishes the row AND counts it, so the header cannot fall behind the
      // list offline, where no response arrives to correct it.
      addPantryItemLocally(
        client.cache,
        pantryId,
        buildOptimisticPantryItem(
          id,
          { pantryId, itemName, itemId },
          client.cache,
        ),
      );
      // Detail-shape the same row so tapping it renders from cache instead of
      // querying an id the server does not have yet.
      writePantryItemDetailStub(client.cache, id, { itemId, itemName });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Pantry Item (optimistic)',
      });
    }

    let result;
    let threw = false;
    try {
      result = await createPantryItem({
        variables: { input: { id, pantryId, itemId } },
        context: { localFirst: true },
      });
    } catch {
      threw = true;
    }

    // A duplicate arrives as a typed member in `data` OR as the legacy
    // top-level code; reading one alone lets it fall through as success and
    // strands the row.
    const duplicate = result
      ? getPantryItemDuplicateFromResult(
          result.data?.createPantryItem,
          result.error,
        )
      : null;

    let outcome: AddPantryItemOutcome = { status: 'added' };
    if (duplicate) {
      // The server writes nothing on a refusal, so withdraw what we published.
      revertOptimisticPantryItem(client.cache, pantryId, id);
      outcome = {
        status: 'duplicate',
        existingPantryItemId: duplicate.existingPantryItemId,
      };
    } else if (
      threw ||
      !result ||
      classifyCreateResult(result) === 'rejected'
    ) {
      // Every other business failure is a resolved union member carrying no
      // `error`, so classify the payload. That keeps the row for a queued
      // create and for IDEMPOTENT_REPLAY.
      revertOptimisticPantryItem(client.cache, pantryId, id);
      outcome = { status: 'rejected' };
    }

    // Released on every outcome; a queued create is tracked by the offline
    // queue's pending set from here on.
    unconfirmedCreates.confirm(id);
    return outcome;
  };

  return {
    addItem,
    restockItem,
    removeSuggestion,
    readStorageLocations,
    findCachedDuplicate,
  };
}
