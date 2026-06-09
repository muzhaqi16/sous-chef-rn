/**
 * useOpenPantryItemBatch - Mutation hook for marking a batch as opened
 * (local-first).
 *
 * Writes `isOpened`/`openedAt` to the cached batch PERMANENTLY before firing so
 * the opened state shows instantly and survives an offline/queued open. The
 * open is naturally idempotent (re-opening is a no-op), and the queue replays it
 * via `syncOpenPantryItemBatch` keyed by a client-minted `operationId`. A real
 * rejection restores the pre-open snapshot.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { OpenPantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { handleMutationError } from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';

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
  const client = useApolloClient();
  const [openMutation, { loading }] = useMutation(OpenPantryItemBatchDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Open Batch' });
    },
  });

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
    executeCacheUpdate(
      () => writeOpened(true, now),
      'Open Pantry Item Batch (optimistic)',
    );

    const operationId = generateEntityId();
    const result = await openMutation({
      variables: { input: { batchId } },
      context: { localFirst: true, operationId },
    });

    const outcome = classifyCreateResult(
      result,
      'openPantryItemBatch',
      'OpenPantryItemBatchPayload',
    );

    if (outcome === 'rejected') {
      executeCacheUpdate(
        () =>
          writeOpened(snapshot?.isOpened ?? false, snapshot?.openedAt ?? null),
        'Revert rejected batch open',
      );
      clearPersistence();
      // onError covers transport errors; a non-success union payload has none.
      alertRejectedMutation(result, 'Could not open this batch.');
      return false;
    }

    // created (response normalized the authoritative batch) or queued (replays
    // via syncOpenPantryItemBatch).
    if (outcome === 'created') {
      clearPersistence();
    }
    onSuccess?.();
    return true;
  };

  return { openBatch, loading };
}
