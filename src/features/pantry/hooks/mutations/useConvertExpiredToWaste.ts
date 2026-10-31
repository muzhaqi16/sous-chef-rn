/**
 * One WASTE record for a stack's expired stock: a batchless stack shows wasted
 * whole (SPOILED, `quantity` 0) until the server answers, a batched one on the
 * server's recompute. `idempotencyKey` stops a replay double-counting.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { ConvertExpiredToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import type { DiscardExpiredInputs } from '#features/pantry/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useTranslation } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';

interface UseConvertExpiredToWasteOptions {
  onSuccess?: (wasted: { hasBatches: boolean }) => void;
}

export function useConvertExpiredToWaste({
  onSuccess,
}: UseConvertExpiredToWasteOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [convertMutation] = useMutation(ConvertExpiredToWasteDocument, {
    context: { localFirst: true },
  });

  const convertExpiredToWaste = async (
    pantryItemId: string,
    { hasBatches }: { hasBatches: boolean },
  ): Promise<boolean> => {
    // Captured at the tap, so a replay judges the day the user saw.
    const today = todayKey();
    const inputs: DiscardExpiredInputs = {
      whole: !hasBatches,
      now: new Date().toISOString(),
    };
    const settled = await pendingWritesOf(client.cache).send(
      ConvertExpiredToWasteDocument,
      {
        today,
        input: { pantryItemId, idempotencyKey: generateEntityId(), today },
      },
      write =>
        settleMutation(() => convertMutation(write), {
          document: ConvertExpiredToWasteDocument,
          fallback: t('errors.discardExpiredFailed'),
        }),
      inputs,
    );
    if (settled.status === 'failed') return false;
    onSuccess?.({ hasBatches });
    return true;
  };

  return { convertExpiredToWaste };
}
