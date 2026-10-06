import { useApolloClient, useMutation } from '@apollo/client/react';
import { RestockPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { addToPantryItemsCache } from '#features/pantry/cache/items';
import { bumpStock, inTrackingUnit } from '#features/pantry/cache/stock';
import { readStackUnit } from '#features/pantry/utils/pantryCacheReaders';
import { boughtAmountOf } from '#domain/stockAmount';
import {
  settleMutation,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import { useTranslation } from '#/i18n';
import type {
  PackageSizeInput,
  RestockPantryItemInput,
  StockAmountInput,
} from '#/graphql/generated/schemaTypes';

/**
 * A restock's variables. `input.today` dates its default expiry; the key
 * dedupes the restock ledger row on replay.
 */
function restockVariables(
  input: Omit<RestockPantryItemInput, 'today' | 'idempotencyKey'>,
) {
  const today = todayKey();
  return {
    today,
    input: { ...input, today, idempotencyKey: generateEntityId() },
  };
}

export type PantryRestockOutcome =
  | { status: 'restocked' }
  | { status: 'rejected' };

type RestockDetails = Pick<
  RestockPantryItemInput,
  'costPerUnit' | 'totalCost' | 'storeId' | 'expiresOn' | 'notes'
>;

/**
 * What went in: an amount as stated, or a count of the product bought with no
 * unit, which the stack's own unit decides (`boughtAmountOf`).
 */
type Stated =
  | { amount: StockAmountInput; bought?: never }
  | {
      bought: { count: number; packageSize?: PackageSizeInput | null };
      amount?: never;
    };

type PantryRestockOptions = RestockDetails &
  Stated & {
    /** `'none'` leaves telling the user about a refusal to the caller. */
    present: 'alert' | 'none';
    fallback?: string;
    on?: SettleOptions['on'];
  };

/**
 * The one restock of a stack the pantry already holds. The row moves at once
 * for an amount it can count in its own unit, offline included; packages wait
 * for the server to size them.
 */
export function usePantryRestock(pantryId: string | undefined) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [restockPantryItem] = useMutation(RestockPantryItemDocument, {
    context: { localFirst: true },
    update: (cache, { data }) => {
      const payload = appliedPayload(data);
      if (!payload || !pantryId) return;
      const pantryItem = payload.pantryItemUsage.pantryItem;
      if (!pantryItem) return;
      // Forces the connection to broadcast: the row already exists, so the
      // re-add returns the connection unchanged, but `cache.modify` still makes
      // query watchers re-emit.
      addToPantryItemsCache(cache, pantryId, pantryItem);
    },
  });

  const moveBatchCount = (pantryItemId: string, by: 1 | -1) => {
    const id = client.cache.identify({
      __typename: 'PantryItem',
      id: pantryItemId,
    });
    if (!id) return;
    client.cache.modify({
      id,
      fields: {
        activeBatchCount: (existing: number = 0) => Math.max(0, existing + by),
      },
    });
  };

  const restock = async (
    pantryItemId: string,
    {
      amount: stated,
      bought,
      present,
      fallback,
      on,
      ...details
    }: PantryRestockOptions,
  ): Promise<PantryRestockOutcome> => {
    const amount =
      stated ??
      boughtAmountOf(bought.count, {
        heldUnit: readStackUnit(client.cache, pantryItemId),
        packageSize: bought.packageSize,
      });
    const added = amount.measured
      ? inTrackingUnit(
          client.cache,
          pantryItemId,
          amount.measured.quantity,
          amount.measured.unitId,
        )
      : null;
    const undoStock =
      added === null ? () => {} : bumpStock(client.cache, pantryItemId, added);
    // Every restock is a batch of its own.
    moveBatchCount(pantryItemId, 1);

    const settled = await settleMutation(
      () =>
        restockPantryItem({
          variables: restockVariables({
            id: pantryItemId,
            amount,
            ...details,
          }),
        }),
      {
        document: RestockPantryItemDocument,
        fallback: fallback ?? t('errors.restockFailedRetry'),
        onFailed: () => {
          undoStock();
          moveBatchCount(pantryItemId, -1);
        },
        on,
        present,
      },
    );
    if (settled.status === 'failed') return { status: 'rejected' };

    // The new batch row is the server's to build, so drop the connection and
    // let the screen refetch it — but only once the server answered. A queued
    // write has no response, and nothing would refill it.
    if (settled.status === 'applied') {
      client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'pantryItemBatchesConnection',
        args: { pantryItemId },
      });
    }
    return { status: 'restocked' };
  };

  return { restock };
}
