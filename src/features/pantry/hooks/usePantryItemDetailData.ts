import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import {
  GetPantryItemDocument,
  GetPantryItemBatchesDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemBatchFragmentDoc,
  type PantryItemBatchFragment,
} from '#features/pantry/graphql/pantryFragments.generated';
import { PantryItemDetail_PantryItemFragmentDoc } from '#features/pantry/screens/PantryItemDetail.generated';
import { summarizeBatchPricing } from '#features/pantry/utils/summarizeBatchPricing';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';
import { isResourceNotFoundError } from '#features/pantry/utils/notFound';

/** The detail screen's item, its batches, and what the server says about both. */
export function usePantryItemDetailData(itemId: string) {
  // A locally-created item owns its id before the server does, so a fetch before
  // the create is acknowledged can only answer that there is no such stack —
  // and that answer never retries itself. Skipping makes the acknowledgement
  // the fetch trigger; the optimistic entity renders the screen meanwhile.
  const isUnconfirmed = useIsCreateUnconfirmed(itemId);

  // This query exists to FETCH and reconcile into the normalized entity the
  // render path below reads; its own `data` is read only for a miss.
  const {
    data: itemData,
    refetch,
    loading: itemLoading,
    error: itemError,
  } = useQuery(
    GetPantryItemDocument,
    isUnconfirmed ? skipToken : { variables: { id: itemId } },
  );

  // No status filter: the derived costs and the expired-batch check both read
  // the whole active set from this one fetch, while the section shows a few.
  // Resolves the pantry item first, so it 404s on an unconfirmed id too.
  const { data: batchesData, refetch: refetchBatches } = useQuery(
    GetPantryItemBatchesDocument,
    isUnconfirmed ? skipToken : { variables: { pantryItemId: itemId } },
  );

  // Keyed by ENTITY, not by the query result: that is what lets a locally-created
  // item render with no API at all, since `data` is undefined while the query is
  // skipped.
  const livePantryItem = useFragment({
    fragment: PantryItemDetail_PantryItemFragmentDoc,
    fragmentName: 'PantryItemDetail_pantryItem',
    from: { __typename: 'PantryItem', id: itemId },
  });
  const item = livePantryItem.complete ? livePantryItem.data : null;

  // A stack removed on another device reads as an explicit null, as every by-id
  // query reports a miss (an API before that answered RESOURCE_NOT_FOUND, still
  // read). Trusted only once the create is acknowledged — the same answer means
  // "not told yet" while unconfirmed — and only from a settled read.
  const answeredNoSuchItem =
    !itemLoading && !itemError && !!itemData && itemData.pantryItem === null;
  const deletedOnServer =
    !isUnconfirmed &&
    (answeredNoSuchItem || isResourceNotFoundError(itemError));

  // Edges arrive masked, and a batch's own edit leaves the query result as it
  // was: each is read live so status/expiresOn reads and BatchSection's
  // sort/filter follow it.
  const batchEntries = useFragmentList({
    fragment: PantryItemBatchFragmentDoc,
    fragmentName: 'PantryItemBatchFragment',
    from:
      batchesData?.pantryItemBatchesConnection.edges.map(edge => edge.node) ??
      [],
  });
  const batches = batchEntries.filter(
    (b): b is PantryItemBatchFragment => b !== null,
  );

  // Batches are a separate query, so pull-to-refresh must refetch both.
  const refreshAll = async () => {
    if (isUnconfirmed) return;
    await Promise.all([refetch(), refetchBatches()]);
  };

  return {
    item,
    batches,
    // Only how to LABEL the item's own money fields — the server derives their
    // values from these same batches.
    batchPricing: summarizeBatchPricing(batches),
    batchTotalCount:
      batchesData?.pantryItemBatchesConnection.totalCount ?? undefined,
    deletedOnServer,
    itemLoading,
    itemError,
    isUnconfirmed,
    refreshAll,
  };
}
