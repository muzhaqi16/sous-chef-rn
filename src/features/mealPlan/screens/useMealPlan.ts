import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import {
  CurrentMealPlanDocument,
  GetMealPlanDocument,
} from './useMealPlan.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  heldFetchPolicy,
  type StandDownOptions,
} from '#hooks/apollo/standDownOptions';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import { useLoadRemainingPages } from '#hooks/utils/useLoadRemainingPages';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { useToday } from '#hooks/app/useToday';
import type { CurrentPlanAnswer } from '#features/mealPlan/types';
import {
  MealPlanMain_ItemFragmentDoc,
  MealPlanMain_MealPlanFragmentDoc,
  type MealPlanMain_ItemFragment,
} from './MealPlanMain.generated';

export function useMealPlan(
  id: string | null,
  { skip = false, fetchPolicy }: StandDownOptions = {},
) {
  // `createMealPlan` writes the plan under a minted id, so before the ack a
  // server read returns null, which `planNotFound` would take for "deleted".
  // Skipping makes the ack the fetch trigger.
  const isUnconfirmed = useIsCreateUnconfirmed(id);

  const { data, loading, error, refetch, observable } = useQuery(
    GetMealPlanDocument,
    !id || isUnconfirmed || skip
      ? skipToken
      : {
          variables: {
            id,
            mealsFirst: MEALS_PAGE_SIZE,
            ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
          },
          ...heldFetchPolicy(fetchPolicy),
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
    observable,
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

/**
 * The plan covering today, with what the plan screens read, in one request.
 * A failed read is not waiting: the caller falls back to finding it itself.
 */
export function useCurrentMealPlan({
  skip = false,
  fetchPolicy,
}: StandDownOptions = {}): CurrentPlanAnswer {
  const today = useToday();
  const result = useQuery(
    CurrentMealPlanDocument,
    skip
      ? skipToken
      : {
          variables: {
            today,
            mealsFirst: MEALS_PAGE_SIZE,
            ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
          },
          ...heldFetchPolicy(fetchPolicy),
        },
  );
  // `skipToken` keeps the last run's answer, which may be another day's.
  const forToday = result.variables.today === today;
  return {
    waiting: !skip && result.loading && !result.data,
    planId: forToday ? result.data?.currentMealPlan?.id ?? null : null,
  };
}
