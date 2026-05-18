import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  MealPlanFullFragmentDoc,
  type MealPlanFullFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';

export function useMealPlan(id: string | null) {
  const client = useApolloClient();

  const { data, loading, error, refetch } = useQuery(GetMealPlanDocument, {
    variables: { id: id! },
    skip: !id,
  });

  useApolloErrorLogger('GetMealPlan', error);

  // The query returns a masked ref — materialize via cache.readFragment so
  // downstream consumers (MealPlanMain, useMealPlanPermissions, settings sheet)
  // see the full MealPlanFullFragment shape rather than `$fragmentRefs`.
  const mealPlan = data?.mealPlan
    ? client.cache.readFragment<MealPlanFullFragment>({
        fragment: MealPlanFullFragmentDoc,
        fragmentName: 'MealPlanFull',
        from: data.mealPlan,
      }) ?? null
    : null;

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
