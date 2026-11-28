/**
 * Local-first: `isOpened`/`openedAt` show until the server answers.
 */

import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#i18n';
import { generateEntityId } from '#utils/generateEntityId';
import { todayKey } from '#utils/dateUtils';
import { openPantryItemBatchWrite } from '#features/pantry/offline/localWrites';

interface UseOpenPantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useOpenPantryItemBatch({
  onSuccess,
}: UseOpenPantryItemBatchOptions = {}) {
  const { t } = useTranslation();
  const markOpened = useLocalWrite(openPantryItemBatchWrite, {
    fallback: t('errors.openBatchFailed'),
  });

  const openBatch = async (batchId: string): Promise<boolean> => {
    const settled = await markOpened.send(
      {
        today: todayKey(),
        input: {
          batchId,
          today: todayKey(),
          idempotencyKey: generateEntityId(),
        },
      },
      {
        entity: { __typename: 'PantryItemBatch', id: batchId },
        fields: { isOpened: true, openedAt: new Date().toISOString() },
      },
    );
    if (settled.status === 'failed') return false;
    onSuccess?.();
    return true;
  };

  return { openBatch };
}
