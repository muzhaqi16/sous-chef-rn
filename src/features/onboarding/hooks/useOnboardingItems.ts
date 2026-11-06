import { useQuery } from '@apollo/client/react';
import { GetOnboardingItemsDocument } from '#operations/item/item.generated';
import { ItemLevel, ItemType } from '#/graphql/generated/schemaTypes';

/**
 * The catalog foods the onboarding picker offers, curated and ranked by how
 * many recipes call for them, never a branded product — which items those are is onboarding's
 * decision. The API's curated path applies only `types` and `level`; any
 * other filter is a VALIDATION_FAILED. `hasLoaded` sits
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
          level: ItemLevel.Concept,
          types: [ItemType.Food, ItemType.Foundation],
        },
        // No orderBy: the API answers in the staples' curated order (the
        // foods most recipes call for first), an older API by popularity.
        first,
      },
    },
  );

  return {
    items: data?.items.edges.map(edge => edge.node) ?? [],
    loading,
    hasLoaded: !!data,
    failed: !!error,
    refetch: () => refetch(),
  };
}
