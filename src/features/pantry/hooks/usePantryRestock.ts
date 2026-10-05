import { useApolloClient, useMutation } from '@apollo/client/react';
import { RestockPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { addToPantryItemsCache } from '#features/pantry/cache/items';
import { writeHeldStock } from '#features/pantry/cache/stock';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import { stockAmountOf } from '#domain/stockAmount';
import { useTranslation } from '#/i18n';
import type { RestockPantryItemInput } from '#/graphql/generated/schemaTypes';

/**
 * A restock's variables. `input.today` dates its default expiry; the key
 * dedupes the restock ledger row on replay.
 */
export function restockVariables(
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

interface PantryRestockOptions {
  /** How many of the stack's own unit go in. */
  quantity: number;
  /**
   * The row's count as cached, bumped now because offline the mutation's
   * `update` never runs; null leaves the count to the response.
   */
  cachedQuantity: number | null;
  /** `'none'` leaves telling the user about a refusal to the caller. */
  present: 'alert' | 'none';
}

/** Restocks a stack the pantry already holds, instead of adding a second one. */
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

  const restock = async (
    pantryItemId: string,
    { quantity, cachedQuantity, present }: PantryRestockOptions,
  ): Promise<PantryRestockOutcome> => {
    const entity =
      cachedQuantity === null
        ? undefined
        : { __typename: 'PantryItem', id: pantryItemId };
    writeEntityFields(client.cache, entity, {
      quantity: (cachedQuantity ?? 0) + quantity,
    });
    // The amount the screens show moves with the count.
    const undoHeld =
      cachedQuantity === null
        ? () => {}
        : writeHeldStock(client.cache, pantryItemId, held => held + quantity);

    const settled = await settleMutation(
      () =>
        restockPantryItem({
          variables: restockVariables({
            id: pantryItemId,
            amount: stockAmountOf(quantity),
          }),
        }),
      {
        document: RestockPantryItemDocument,
        fallback: t('errors.restockFailedRetry'),
        onFailed: () => {
          writeEntityFields(client.cache, entity, {
            quantity: cachedQuantity ?? undefined,
          });
          undoHeld();
        },
        present,
      },
    );
    return settled.status === 'failed'
      ? { status: 'rejected' }
      : { status: 'restocked' };
  };

  return { restock };
}
