import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';
import {
  MealPlanMain_ItemFragmentDoc,
  MealPlanMain_MealPlanFragmentDoc,
  type MealPlanMain_ItemFragment,
} from '#features/mealPlan/screens/MealPlanMain.generated';

export function useMealPlan(id: string | null) {
  // `createMealPlan` mints the cuid and writes the plan locally, so until the
  // create is acknowledged a server read returns null however honestly it
  // answers — and `planNotFound` would read that null as "deleted". Skipping is
  // what keeps the distinction sound, and makes the ack the fetch trigger.
  const isUnconfirmed = useIsCreateUnconfirmed(id);

  const { data, loading, error, refetch } = useQuery(
    GetMealPlanDocument,
    !id || isUnconfirmed ? skipToken : { variables: { id } },
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
  const items = mealPlan?.mealPlanItems ?? [];
  const itemDetails = useFragmentList({
    fragment: MealPlanMain_ItemFragmentDoc,
    fragmentName: 'MealPlanMain_item',
    from: items,
  }).filter((item): item is MealPlanMain_ItemFragment => item !== null);

  // The server answered with an explicit null for this id: there is no such
  // row. A by-id query reports a miss as null data, not as an error — only a
  // mutation raises RESOURCE_NOT_FOUND for the same condition. Gated on
  // `!loading && !error` so a request still in flight can't read as missing,
  // and on `data` so a skipped (unacknowledged create) query never does either.
  const planNotFound = !loading && !error && !!data && data.mealPlan === null;

  return {
    mealPlan,
    items,
    itemDetails,
    nutritionSummary: mealPlan?.nutritionSummary ?? null,
    mealPlanRef: data?.mealPlan ?? null,
    planNotFound,
    loading,
    error,
    refetch,
  };
}
