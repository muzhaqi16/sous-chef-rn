/**
 * No optimistic cache write: the conversion recomputes quantity across several
 * expired batches, so the parent item reconciles from the server response or the
 * pantry subscription. The server writes waste ledger rows, so
 * `input.idempotencyKey` is what keeps a queued replay from double-counting.
 */

import { useMutation } from '@apollo/client/react';
import { ConvertExpiredBatchesToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { handleMutationError } from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { t } from '#/i18n';

interface UseConvertExpiredBatchesToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredBatchesToWaste({
  onSuccess,
}: UseConvertExpiredBatchesToWasteOptions = {}) {
  const [convertMutation, { loading }] = useMutation(
    ConvertExpiredBatchesToWasteDocument,
    {
      onError: error => {
        handleMutationError(error, {
          operation: 'Convert Expired Batches To Waste',
        });
      },
    },
  );

  const convertExpiredBatches = async (
    pantryItemId: string,
  ): Promise<boolean> => {
    const result = await convertMutation({
      variables: {
        input: { pantryItemId, idempotencyKey: generateEntityId() },
      },
      context: { localFirst: true },
    });

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // onError covers transport errors; a non-success union payload has none.
      alertRejectedMutation(result, t('errors.discardExpiredFailed'));
      return false;
    }

    // created (response reconciles quantity / batch counts) or queued (replays
    // the canonical mutation, deduped by its idempotencyKey).
    onSuccess?.();
    return true;
  };

  return { convertExpiredBatches, loading };
}
