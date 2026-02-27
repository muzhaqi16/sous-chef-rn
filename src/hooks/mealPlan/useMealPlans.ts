

import { useGetMealPlansQuery, SortOrder, type MealPlanFilters } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

export function useMealPlans(filters?: MealPlanFilters) {
  const { isLoggedOut } = useAuth();

  const { data, loading, error, refetch, fetchMore } = useGetMealPlansQuery({
    variables: {
      first: 20,
      filters: filters ?? undefined,
      orderBy: { startDate: SortOrder.Desc },
    },
    skip: isLoggedOut,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
  });

  const mealPlans = !data?.mealPlans?.edges ? [] : data.mealPlans.edges.map(edge => edge.node);

  const totalCount = data?.mealPlans?.totalCount ?? 0;
  const hasMore = data?.mealPlans?.pageInfo?.hasNextPage ?? false;

  useApolloErrorLogger('GetMealPlans', error);

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
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    if (upcoming.length > 0) {
      currentPlan = upcoming[0];
    } else {
      // 3. Most recent past plan (query already sorted by startDate DESC)
      currentPlan = mealPlans[0] ?? null;
    }
  }

  const loadMore = () => {
    if (!hasMore || loading) return;
    const endCursor = data?.mealPlans?.pageInfo?.endCursor;
    if (endCursor) {
      fetchMore({ variables: { after: endCursor } });
    }
  };

  return {
    mealPlans,
    currentPlan,
    loading,
    error,
    totalCount,
    hasMore,
    refetch,
    loadMore,
  };
}
