import { useQuery } from '@apollo/client/react';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import {
  SortOrder,
  type MealPlanFilters,
} from '#/graphql/generated/schemaTypes';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useConnectionData } from '#hooks/utils/useConnectionData';

export function useMealPlans(filters?: MealPlanFilters) {
  const isLoggedOut = useIsLoggedOut();

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
  });

  const mealPlans = connectionData.items;

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
      error: error as Error | undefined,
      totalCount: connectionData.totalCount,
      hasMore: connectionData.hasMore,
    },
    actions: {
      refetch,
      loadMore: connectionData.loadMore,
    },
  };
}
