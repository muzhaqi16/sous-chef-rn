import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import { GetMealPlanDocument } from './useMealPlan.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useLoadRemainingPages } from '#hooks/utils/useLoadRemainingPages';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import {
  MealPlanMain_ItemFragmentDoc,
  MealPlanMain_MealPlanFragmentDoc,
  type MealPlanMain_ItemFragment,
} from './MealPlanMain.generated';

export function useMealPlan(id: string | null) {
  // `createMealPlan` writes the plan under a minted id, so before the ack a
  // server read returns null, which `planNotFound` would take for "deleted".
  // Skipping makes the ack the fetch trigger.
  const isUnconfirmed = useIsCreateUnconfirmed(id);

  const { data, loading, error, refetch, fetchMore } = useQuery(
    GetMealPlanDocument,
    !id || isUnconfirmed
      ? skipToken
      : {
          variables: {
            id,
            mealsFirst: MEALS_PAGE_SIZE,
            ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
          },
        },
  );

  useApolloErrorLogger(GetMealPlanDocument, error);

  // Keyed by ENTITY, not read off the query result: a locally created plan is
  // in the cache while its query is skipped. Each item is a masked ref its own
  // readers resolve; the screen's handlers read `MealPlanMain_item`.
  const liveMealPlan = useFragment({
    fragment: MealPlanMain_MealPlanFragmentDoc,
    fragmentName: 'MealPlanMain_mealPlan',
    from: id ? { __typename: 'MealPlan', id } : null,
  });
  const mealPlan = id && liveMealPlan.complete ? liveMealPlan.data : null;
  // The meals are one cached list however many pages filled it; a plan past
  // the first page reads the rest before the screen treats it as whole.
  const meals = useConnectionData({
    data: mealPlan ?? undefined,
    selector: plan => plan.mealPlanItemsConnection,
    key: id ?? '',
    loading,
    fetchMore,
    cursorVariableName: 'mealsAfter',
    refetch,
  });
  const { incomplete: mealsIncomplete, retry: retryRemainingMeals } =
    useLoadRemainingPages(!!mealPlan, loading, meals, id ?? '');
  const itemDetails = useFragmentList({
    fragment: MealPlanMain_ItemFragmentDoc,
    fragmentName: 'MealPlanMain_item',
    from: meals.items,
  }).filter((item): item is MealPlanMain_ItemFragment => item !== null);

  // An explicit null: a by-id query reports a miss as null data, not an error
  // (only a mutation raises RESOURCE_NOT_FOUND). Settled reads only, and never
  // a skipped one, which an unacknowledged create is.
  const planNotFound = !loading && !error && !!data && data.mealPlan === null;

  return {
    mealPlan,
    items: meals.items,
    itemDetails,
    nutritionSummary: mealPlan?.nutritionSummary ?? null,
    mealPlanRef: data?.mealPlan ?? null,
    /** Pages of meals remain that could not be read: the plan is partial. */
    mealsIncomplete,
    retryRemainingMeals,
    planNotFound,
    loading,
    error,
    refetch,
  };
}
