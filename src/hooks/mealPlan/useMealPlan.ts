import { useMemo } from 'react';
import { useGetMealPlanQuery } from '#generated';

export function useMealPlan(id: string | null) {
  const { data, loading, error, refetch } = useGetMealPlanQuery({
    variables: { id: id! },
    skip: !id,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
  });

  const mealPlan = data?.mealPlan ?? null;

  const items = useMemo(() => {
    return mealPlan?.mealPlanItems ?? [];
  }, [mealPlan?.mealPlanItems]);

  return {
    mealPlan,
    items,
    nutritionSummary: mealPlan?.nutritionSummary ?? null,
    loading,
    error,
    refetch,
  };
}
