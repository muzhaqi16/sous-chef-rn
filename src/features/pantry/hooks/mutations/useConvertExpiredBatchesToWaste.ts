/**
 * No optimistic cache write: the conversion recomputes quantity across several
 * expired batches, so the parent item reconciles from the server response or the
 * pantry subscription. The server writes waste ledger rows, so
 * `input.idempotencyKey` is what keeps a queued replay from double-counting.
 */

import { useMutation } from '@apollo/client/react';
import { ConvertExpiredBatchesToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useTranslation } from '#/i18n';

interface UseConvertExpiredBatchesToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredBatchesToWaste({
  onSuccess,
}: UseConvertExpiredBatchesToWasteOptions = {}) {
  const { t } = useTranslation();
  const [convertMutation] = useMutation(ConvertExpiredBatchesToWasteDocument);

  const convertExpiredBatches = async (
    pantryItemId: string,
  ): Promise<boolean> => {
    const settled = await settleMutation(
      () =>
        convertMutation({
          variables: {
            input: { pantryItemId, idempotencyKey: generateEntityId() },
          },
          context: { localFirst: true },
        }),
      {
        document: ConvertExpiredBatchesToWasteDocument,
        fallback: t('errors.discardExpiredFailed'),
      },
    );
    if (settled.status === 'failed') return false;

    // A queued conversion replays the canonical mutation, deduped by its key.
    onSuccess?.();
    return true;
  };

  return { convertExpiredBatches };
}
