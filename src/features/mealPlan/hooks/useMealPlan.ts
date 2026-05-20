import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  MealPlanMain_MealPlanFragmentDoc,
  type MealPlanMain_MealPlanFragment,
} from '#features/mealPlan/screens/MealPlanMain.generated';

export function useMealPlan(id: string | null) {
  const client = useApolloClient();

  const { data, loading, error, refetch } = useQuery(GetMealPlanDocument, {
    variables: { id: id! },
    skip: !id,
  });

  useApolloErrorLogger('GetMealPlan', error);

  // The query returns a masked ref — materialize via cache.readFragment so
  // the screen sees the full MealPlanMain_mealPlan shape rather than
  // `$fragmentRefs`. Use the cache-key form — the masked-ref `from` silently
  // returns partial/null data under dataMasking. The settings sheet does its
  // own useFragment on the ref passed down to it.
  const mealPlan = data?.mealPlan
    ? client.cache.readFragment<MealPlanMain_MealPlanFragment>({
        fragment: MealPlanMain_MealPlanFragmentDoc,
        fragmentName: 'MealPlanMain_mealPlan',
        from: { __typename: 'MealPlan', id: data.mealPlan.id },
      }) ?? null
    : null;

  const items = mealPlan?.mealPlanItems ?? [];

  return {
    mealPlan,
    items,
    nutritionSummary: mealPlan?.nutritionSummary ?? null,
    mealPlanRef: data?.mealPlan ?? null,
    loading,
    error,
    refetch,
  };
}
