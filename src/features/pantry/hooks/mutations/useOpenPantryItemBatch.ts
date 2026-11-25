/**
 * Local-first: `isOpened`/`openedAt` show until the server answers.
 */

import { OpenPantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#i18n';
import { generateEntityId } from '#utils/generateEntityId';
import { todayKey } from '#utils/dateUtils';

interface UseOpenPantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useOpenPantryItemBatch({
  onSuccess,
}: UseOpenPantryItemBatchOptions = {}) {
  const { t } = useTranslation();
  const markOpened = useLocalWrite(OpenPantryItemBatchDocument, {
    fallback: t('errors.openBatchFailed'),
  });

  const openBatch = async (batchId: string): Promise<boolean> => {
    const settled = await markOpened.sendFields({
      entity: { __typename: 'PantryItemBatch', id: batchId },
      fields: { isOpened: true, openedAt: new Date().toISOString() },
      variables: {
        today: todayKey(),
        input: {
          batchId,
          today: todayKey(),
          idempotencyKey: generateEntityId(),
        },
      },
    });
    if (settled.status === 'failed') return false;
    onSuccess?.();
    return true;
  };

  return { openBatch };
}
