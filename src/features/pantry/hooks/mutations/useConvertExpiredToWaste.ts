/**
 * One WASTE record for a stack's expired stock: a batchless stack shows wasted
 * whole (SPOILED, `quantity` 0) until the server answers, a batched one on the
 * server's recompute. `idempotencyKey` stops a replay double-counting.
 */

import { ConvertExpiredToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import type { DiscardExpiredInputs } from '#features/pantry/offline/localWrites';
import { useLocalWrite } from '#/apollo/pendingWrites/useLocalWrite';
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
  const convert = useLocalWrite(ConvertExpiredToWasteDocument, {
    fallback: t('errors.discardExpiredFailed'),
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
    const settled = await convert.send(
      {
        today,
        input: { pantryItemId, idempotencyKey: generateEntityId(), today },
      },
      inputs,
    );
    if (settled.status === 'failed') return false;
    onSuccess?.({ hasBatches });
    return true;
  };

  return { convertExpiredToWaste };
}
