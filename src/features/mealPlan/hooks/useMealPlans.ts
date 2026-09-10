import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import {
  SortOrder,
  type MealPlanFilters,
} from '#/graphql/generated/schemaTypes';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import {
  MealPlanDisplayFragmentDoc,
  type MealPlanDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';

export function useMealPlans(filters?: MealPlanFilters) {
  const isLoggedOut = useIsLoggedOut();
  const client = useApolloClient();

  const { data, loading, error, refetch, fetchMore } = useQuery(
    GetMealPlansDocument,
    {
      variables: {
        first: 20,
        filters: filters ?? undefined,
        orderBy: { startDate: SortOrder.Desc },
      },
      skip: isLoggedOut,
    },
  );

  useApolloErrorLogger('GetMealPlans', error);

  const connectionData = useConnectionData({
    data,
    selector: d => d.mealPlans,
    loading,
    fetchMore,
    refetch,
  });

  // Edges arrive as masked refs (`{ __typename: 'MealPlan' } & { $fragmentRefs }`).
  // Materialize via cache.readFragment so consumers see the full
  // MealPlanDisplayFragment shape (startDate, endDate, name, …) without
  // exposing raw refs. Use the cache-key form — the masked-ref `from` silently
  // returns partial/null data under dataMasking.
  const mealPlans = connectionData.items
    .map(ref =>
      client.cache.readFragment<MealPlanDisplayFragment>({
        fragment: MealPlanDisplayFragmentDoc,
        fragmentName: 'MealPlanDisplay',
        from: { __typename: 'MealPlan', id: ref.id },
      }),
    )
    .filter((p): p is MealPlanDisplayFragment => p !== null);

  // Find the current meal plan (active > nearest upcoming > most recent past)
  const now = new Date();

  // 1. Plan spanning today (active)
  const activePlan = mealPlans.find(plan => {
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    return start <= now && end >= now;
  });

  let currentPlan;
  if (activePlan) {
    currentPlan = activePlan;
  } else {
    // 2. Nearest upcoming plan
    const upcoming = mealPlans
      .filter(plan => new Date(plan.startDate) > now)
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
    if (upcoming.length > 0) {
      currentPlan = upcoming[0];
    } else {
      // 3. Most recent past plan (query already sorted by startDate DESC)
      currentPlan = mealPlans[0] ?? null;
    }
  }

  return {
    state: {
      mealPlans,
      currentPlan,
      loading,
      // True only while the very first response is in flight (nothing cached
      // yet). A `cache-and-network` refetch over existing data keeps this
      // false, so consumers can hold a skeleton on cold start without
      // flashing it over already-rendered content.
      initialLoading: loading && !data,
      error: error as Error | undefined,
      // `data !== undefined` — a response arrived, empty or not. Separates
      // "you have no plans" from "we never got an answer".
      hasResult: data !== undefined,
      // Signed out, so the query above was never sent. Reported so the screen
      // shows its empty state rather than accusing the network of a failure.
      skipped: isLoggedOut,
      totalCount: connectionData.totalCount,
      hasMore: connectionData.hasMore,
    },
    actions: {
      refetch,
      loadMore: connectionData.loadMore,
    },
  };
}
