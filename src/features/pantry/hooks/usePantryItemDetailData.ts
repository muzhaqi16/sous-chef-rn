import { useApolloClient, useFragment, useQuery } from '@apollo/client/react';
import {
  GetPantryItemDocument,
  GetPantryItemBatchesDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemBatchFragmentDoc,
  type PantryItemBatchFragment,
} from '#features/pantry/graphql/pantryFragments.generated';
import {
  PantryItemDetail_PantryItemFragmentDoc,
  type PantryItemDetail_PantryItemFragment,
} from '#features/pantry/screens/PantryItemDetail.generated';
import { summarizeBatchPricing } from '#features/pantry/utils/summarizeBatchPricing';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';
import { isResourceNotFoundError } from '#/utils/errors/notFound';

/** The detail screen's item, its batches, and what the server says about both. */
export function usePantryItemDetailData(itemId: string) {
  const client = useApolloClient();

  // A locally-created item owns its id before the server does, so a fetch before
  // the create is acknowledged can only return RESOURCE_NOT_FOUND — and that
  // error state never retries itself. Skipping makes the acknowledgement the
  // fetch trigger; the optimistic entity renders the screen meanwhile.
  const isUnconfirmed = useIsCreateUnconfirmed(itemId);

  // `data` is deliberately unused: this query exists to FETCH and reconcile into
  // the normalized entity the render path below reads.
  const {
    refetch,
    loading: itemLoading,
    error: itemError,
  } = useQuery(GetPantryItemDocument, {
    variables: { id: itemId },
    skip: isUnconfirmed,
  });

  // No status filter: the derived costs and the expired-batch check both read
  // the whole active set from this one fetch, while the section shows a few.
  const { data: batchesData, refetch: refetchBatches } = useQuery(
    GetPantryItemBatchesDocument,
    {
      variables: { pantryItemId: itemId },
      fetchPolicy: 'cache-and-network',
      // Resolves the pantry item first, so it 404s on an unconfirmed id too.
      skip: isUnconfirmed,
    },
  );

  // Keyed by ENTITY, not by the query result: that is what lets a locally-created
  // item render with no API at all, since `data` is undefined while the query is
  // skipped. It is also the only reactivity signal available — under
  // `dataMasking` the query's `data.pantryItem` is a masked ref whose identity is
  // stable across field changes.
  const livePantryItem = useFragment({
    fragment: PantryItemDetail_PantryItemFragmentDoc,
    fragmentName: 'PantryItemDetail_pantryItem',
    from: { __typename: 'PantryItem', id: itemId },
  });

  // Materializes the masked ref into the unmasked entity. `readFragment` reads
  // the mutable cache during render, so the compiler memoizes it against the
  // reactive values named here — the `livePantryItem.data` guard is load-bearing:
  // gating on the masked ref instead would pin this to a stale snapshot until a
  // refetch, hiding in-place edits.
  const item =
    livePantryItem.complete && livePantryItem.data
      ? client.cache.readFragment<PantryItemDetail_PantryItemFragment>({
          fragment: PantryItemDetail_PantryItemFragmentDoc,
          fragmentName: 'PantryItemDetail_pantryItem',
          from: { __typename: 'PantryItem', id: itemId },
        }) ?? null
      : null;

  // The pantry resolver throws rather than returning null, so a row deleted on
  // another device arrives as RESOURCE_NOT_FOUND. Only trust it once the create
  // is acknowledged — the identical error means "not told yet" while unconfirmed.
  const deletedOnServer = !isUnconfirmed && isResourceNotFoundError(itemError);

  // Edges arrive masked; materialize each so status/expiresAt reads and
  // BatchSection's sort/filter work directly.
  const batches: PantryItemBatchFragment[] =
    batchesData?.pantryItemBatchesConnection?.edges
      ?.map(edge =>
        client.cache.readFragment<PantryItemBatchFragment>({
          fragment: PantryItemBatchFragmentDoc,
          fragmentName: 'PantryItemBatchFragment',
          from: edge.node,
        }),
      )
      .filter((b): b is PantryItemBatchFragment => b != null) ?? [];

  // Batches are a separate query, so pull-to-refresh must refetch both.
  const refreshAll = () => Promise.all([refetch(), refetchBatches()]);

  return {
    item,
    batches,
    // Only how to LABEL the item's own money fields — the server derives their
    // values from these same batches.
    batchPricing: summarizeBatchPricing(batches),
    batchTotalCount:
      batchesData?.pantryItemBatchesConnection?.totalCount ?? undefined,
    deletedOnServer,
    itemLoading,
    itemError,
    isUnconfirmed,
    refreshAll,
  };
}
