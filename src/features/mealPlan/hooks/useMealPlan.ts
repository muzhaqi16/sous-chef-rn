import { useQuery } from '@apollo/client/react';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

export function useMealPlan(id: string | null) {
  const { data, loading, error, refetch } = useQuery(GetMealPlanDocument, {
    variables: { id: id! },
    skip: !id,
  });

  useApolloErrorLogger('GetMealPlan', error);

  const mealPlan = data?.mealPlan ?? null;

  const items = mealPlan?.mealPlanItems ?? [];

  return {
    mealPlan,
    items,
    nutritionSummary: mealPlan?.nutritionSummary ?? null,
    loading,
    error,
    refetch,
  };
}
