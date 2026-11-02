/**
 * Local-first: the corrected count shows until the server answers. The server
 * writes an ADJUSTMENT ledger row per adjust, so `input.idempotencyKey` is what
 * keeps a queued replay from double-counting.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { AdjustPantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import type { SetStockInputs } from '#features/pantry/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import type { RecountUnits } from '#features/pantry/types';

interface UseAdjustPantryItemQuantityOptions {
  onSuccess?: () => void;
}

export function useAdjustPantryItemQuantity({
  onSuccess,
}: UseAdjustPantryItemQuantityOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [adjustMutation] = useMutation(AdjustPantryItemQuantityDocument, {
    context: { localFirst: true },
  });

  const adjustQuantity = async (
    pantryItemId: string,
    newQuantity: number,
    reason: string,
    version: number,
    remainingNetWeight?: number,
    units: RecountUnits = {},
  ): Promise<boolean> => {
    // A recount is absolute. A figure stated in another unit is not shown ahead:
    // only the server converts it.
    const statedInOwnUnit = !units.newQuantityUnitId;
    const weightInOwnUnit = !units.remainingNetWeightUnitId;
    const inputs: SetStockInputs = {
      now: new Date().toISOString(),
      ...(statedInOwnUnit && { held: newQuantity }),
      ...(statedInOwnUnit &&
        weightInOwnUnit &&
        remainingNetWeight != null && { remainingNetWeight }),
    };

    // idempotencyKey dedups the ADJUSTMENT ledger entry on replay. `version` is
    // the optimistic-concurrency check the server requires.
    const settled = await pendingWritesOf(client.cache).send(
      AdjustPantryItemQuantityDocument,
      {
        today: todayKey(),
        input: {
          id: pantryItemId,
          newQuantity,
          reason,
          idempotencyKey: generateEntityId(),
          version,
          ...(remainingNetWeight != null ? { remainingNetWeight } : {}),
          ...units,
        },
      },
      write =>
        settleMutation(() => adjustMutation(write), {
          document: AdjustPantryItemQuantityDocument,
          fallback: t('errors.adjustQuantityFailed'),
        }),
      inputs,
    );
    if (settled.status === 'failed') return false;
    onSuccess?.();
    return true;
  };

  return { adjustQuantity };
}
