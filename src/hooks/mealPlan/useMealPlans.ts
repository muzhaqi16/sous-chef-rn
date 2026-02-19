import { useMemo } from 'react';
import { useGetMealPlansQuery, SortOrder, type MealPlanFilters } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';

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

  const mealPlans = useMemo(() => {
    if (!data?.mealPlans?.edges) return [];
    return data.mealPlans.edges.map(edge => edge.node);
  }, [data?.mealPlans]);

  const totalCount = data?.mealPlans?.totalCount ?? 0;
  const hasMore = data?.mealPlans?.pageInfo?.hasNextPage ?? false;

  // Find the current meal plan (one spanning today)
  const currentPlan = useMemo(() => {
    const now = new Date();
    return mealPlans.find(plan => {
      const start = new Date(plan.startDate);
      const end = new Date(plan.endDate);
      return start <= now && end >= now;
    }) ?? null;
  }, [mealPlans]);

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
