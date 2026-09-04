import { useQuery } from '@apollo/client/react';
import { GetOnboardingItemsDocument } from '#operations/item/item.generated';
import { ItemType, SortOrder } from '#/graphql/generated/schemaTypes';

/**
 * The catalog items the onboarding picker offers, curated and most popular
 * first — which items those are is onboarding's decision. `hasLoaded` sits
 * beside `loading` because `cache-and-network` reports loading on EVERY mount
 * whatever the cache holds.
 */
export function useOnboardingItems({ first = 50 }: { first?: number } = {}) {
  const { data, loading, error, refetch } = useQuery(
    GetOnboardingItemsDocument,
    {
      variables: {
        filters: {
          curation: { showInOnboarding: true },
          types: [ItemType.Food, ItemType.Foundation],
        },
        orderBy: { popularity: SortOrder.Asc },
        first,
      },
    },
  );

  return {
    items: data?.items?.edges?.map(edge => edge.node) ?? [],
    loading,
    hasLoaded: !!data,
    failed: !!error,
    refetch: () => refetch(),
  };
}
