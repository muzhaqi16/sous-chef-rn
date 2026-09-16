/**
 * Local-first: `isOpened`/`openedAt` are written to the cached batch PERMANENTLY
 * before firing, so the state survives an offline/queued open (an
 * `optimisticResponse` would roll back on the queue's null result). A real
 * rejection restores the pre-open snapshot.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { OpenPantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';

interface UseOpenPantryItemBatchOptions {
  onSuccess?: () => void;
}

const BATCH_OPEN_STATE_FRAGMENT = gql`
  fragment useOpenPantryItemBatch_state on PantryItemBatch {
    id
    isOpened
    openedAt
  }
`;

export function useOpenPantryItemBatch({
  onSuccess,
}: UseOpenPantryItemBatchOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [openMutation] = useMutation(OpenPantryItemBatchDocument);

  const openBatch = async (batchId: string): Promise<boolean> => {
    const now = new Date().toISOString();
    const batchCacheId = client.cache.identify({
      __typename: 'PantryItemBatch',
      id: batchId,
    });
    const snapshot = client.cache.readFragment<{
      isOpened: boolean;
      openedAt: string | null;
    }>({
      id: batchCacheId,
      fragment: BATCH_OPEN_STATE_FRAGMENT,
      fragmentName: 'useOpenPantryItemBatch_state',
    });

    const writeOpened = (isOpened: boolean, openedAt: string | null) =>
      client.cache.modify({
        id: batchCacheId,
        fields: {
          isOpened: () => isOpened,
          openedAt: () => openedAt,
        },
      });

    // Permanent optimistic write before firing — survives an offline/queued open.
    const clearPersistence = optimisticDataPersistence.track(
      'PantryItemBatch',
      batchId,
      'isOpened',
      true,
    );
    try {
      writeOpened(true, now);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Open Pantry Item Batch (optimistic)',
      });
    }

    const revert = () => {
      // Resolved before the try — a `??` inside a try body makes the React
      // Compiler bail out of this hook.
      const revertedIsOpened = snapshot?.isOpened ?? false;
      const revertedOpenedAt = snapshot?.openedAt ?? null;
      try {
        writeOpened(revertedIsOpened, revertedOpenedAt);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected batch open',
        });
      }
      clearPersistence();
    };

    const settled = await settleMutation(
      () =>
        openMutation({
          variables: { input: { batchId, idempotencyKey: generateEntityId() } },
          context: { localFirst: true },
        }),
      {
        document: OpenPantryItemBatchDocument,
        fallback: t('errors.openBatchFailed'),
        onFailed: revert,
      },
    );
    if (settled.status === 'failed') return false;

    // Applied: the response normalized the authoritative batch. Queued: the
    // persisted value stands until the replay lands.
    if (settled.status === 'applied') {
      clearPersistence();
    }
    onSuccess?.();
    return true;
  };

  return { openBatch };
}
