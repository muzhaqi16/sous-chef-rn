/**
 * Local-first: `isOpened`/`openedAt` show until the server answers.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { OpenPantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { useTranslation } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';

interface UseOpenPantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useOpenPantryItemBatch({
  onSuccess,
}: UseOpenPantryItemBatchOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [openMutation] = useMutation(OpenPantryItemBatchDocument, {
    context: { localFirst: true },
  });

  const openBatch = async (batchId: string): Promise<boolean> => {
    const settled = await sendFields(client.cache, {
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
      mutate: openMutation,
      settle: {
        document: OpenPantryItemBatchDocument,
        fallback: t('errors.openBatchFailed'),
      },
    });
    if (settled.status === 'failed') return false;
    onSuccess?.();
    return true;
  };

  return { openBatch };
}
