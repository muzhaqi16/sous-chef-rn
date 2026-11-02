import { useApolloClient, useMutation } from '@apollo/client/react';
import { RestockPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { inTrackingUnit } from '#features/pantry/cache/stock';
import type { AddStockInputs } from '#features/pantry/offline/localWrites';
import { readStackUnit } from '#features/pantry/utils/pantryCacheReaders';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { boughtAmountOf } from '#domain/stockAmount';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import {
  settleMutation,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import { useTranslation } from '#/i18n';
import type {
  PackageSizeInput,
  PantryItemSourceInput,
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
  /** `sizeRefusal`: the copy when nothing sized the packages, for a form to ask. */
  | { status: 'rejected'; sizeRefusal: string | null };

type RestockDetails = Pick<
  RestockPantryItemInput,
  'costPerUnit' | 'totalCost' | 'storeId' | 'expiresOn' | 'notes'
>;

/** A count of the product bought, in the buyer's unit or else the stack's own. */
interface Bought {
  count: number;
  /** The COUNT unit the buyer counted in, when they named one. */
  unitId?: string;
  packageSize?: PackageSizeInput | null;
  /**
   * The product, for an add when nothing sizes the packages. `itemId` is the
   * catalog item's, for the row shown meanwhile when `source` names a variation.
   */
  item: { source: PantryItemSourceInput; name: string; itemId?: string };
}

/** What went in: an amount as stated, or a count bought (`boughtAmountOf`). */
type Stated =
  | (RestockDetails & { amount: StockAmountInput; bought?: never })
  | { bought: Bought; amount?: never };

type PantryRestockOptions = Stated & {
  /** `'none'` leaves telling the user about a refusal to the caller. */
  present: 'alert' | 'none';
  fallback?: string;
  on?: SettleOptions['on'];
};

/**
 * The one restock of a held stack: an amount countable in its own unit moves
 * the row at once, offline too; packages wait for the server to size them, and
 * it refuses them when nothing does. A count in a unit the stack is not counted
 * in goes as a `forceAdd` add.
 */
export function usePantryRestock(pantryId: string | undefined) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const intake = usePantryIntake(pantryId);

  const [restockPantryItem] = useMutation(RestockPantryItemDocument, {
    context: { localFirst: true },
  });

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
    const heldUnit = readStackUnit(client.cache, pantryItemId);
    const amount =
      stated ??
      boughtAmountOf(bought.count, {
        heldUnit,
        packageSize: bought.packageSize,
        unitId: bought.unitId,
      });
    const refusal = fallback ?? t('errors.restockFailedRetry');
    // A restock refuses a count in a unit the stack is not counted in. An add
    // with `forceAdd` takes it, but names no stack: the server joins it to one
    // its unit restates into, else makes a stack of its own.
    const { packages } = amount;
    const inOtherUnit =
      packages?.unitId != null && packages.unitId !== heldUnit?.id;
    if (bought && packages && inOtherUnit) {
      const { itemId } = bought.item;
      const outcome = await intake.addItem(
        bought.item.name,
        { item: bought.item.source, amount, forceAdd: true },
        {
          present,
          fallback: refusal,
          ...(itemId ? { local: { itemId, unitId: bought.unitId } } : {}),
        },
      );
      return outcome.status === 'added'
        ? { status: 'restocked' }
        : { status: 'rejected', sizeRefusal: null };
    }
    const added = amount.measured
      ? inTrackingUnit(
          client.cache,
          pantryItemId,
          amount.measured.quantity,
          amount.measured.unitId,
        )
      : null;
    const inputs: AddStockInputs = {
      delta: added,
      now: new Date().toISOString(),
      pantryId,
    };

    const settled = await pendingWritesOf(client.cache).send(
      RestockPantryItemDocument,
      restockVariables({ id: pantryItemId, amount, ...details }),
      write =>
        settleMutation(() => restockPantryItem(write), {
          document: RestockPantryItemDocument,
          fallback: refusal,
          on,
          present,
        }),
      inputs,
    );
    if (settled.status === 'failed') {
      // `amount.packages.size` is the input's one field named `size`.
      const { failure } = settled;
      return {
        status: 'rejected',
        sizeRefusal: failure?.field === 'size' ? failure.body : null,
      };
    }

    return { status: 'restocked' };
  };

  return { restock };
}
