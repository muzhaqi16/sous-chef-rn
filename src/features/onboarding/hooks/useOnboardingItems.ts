import { skipToken, useQuery } from '@apollo/client/react';
import { ItemLevel, ItemType } from '#/graphql/generated/schemaTypes';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useSelectedHomeId, useUser } from '#store/useAppStore';
import { GetOnboardingItemsDocument } from './useOnboardingItems.generated';

/**
 * The catalog foods the kitchen step offers, curated and ranked by how many
 * recipes call for them, never a branded product. A food with any alert for
 * the user's own answers is left out, a trace or a diet included: the API
 * raises a meat department as MAY_CONTAIN for a diet. The curated path applies
 * only `types` and `level`; any other filter is a VALIDATION_FAILED.
 * `hasLoaded` sits beside `loading` because `cache-and-network` reports
 * loading on every mount whatever the cache holds.
 */
export function useOnboardingItems({ first = 50 }: { first?: number } = {}) {
  const homeId = useSelectedHomeId();
  const userId = useUser()?.id;
  const { data, loading, error, refetch, variables } = useQuery(
    GetOnboardingItemsDocument,
    homeId
      ? {
          variables: {
            filters: {
              curation: { showInOnboarding: true },
              level: ItemLevel.Concept,
              types: [ItemType.Food, ItemType.Foundation],
            },
            // No orderBy: the API answers in the staples' curated order.
            first,
            homeId,
          },
        }
      : skipToken,
  );
  useApolloErrorLogger(GetOnboardingItemsDocument, error);

  // `skipToken` keeps the last run's data: it may be another home's.
  const read = homeId && variables.homeId === homeId ? data : undefined;
  const items = (read?.items.edges ?? [])
    .map(edge => edge.node)
    .filter(
      node =>
        !node.dietaryAlerts.some(alert => alert.membership.userId === userId),
    );

  return {
    items,
    loading,
    hasLoaded: read !== undefined,
    failed: !!error,
    refetch: () => {
      void refetch();
    },
  };
}
