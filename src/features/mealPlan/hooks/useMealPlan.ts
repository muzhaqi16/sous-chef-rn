import { useApolloClient, useFragment, useQuery } from '@apollo/client/react';
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

  // Subscribe to the MealPlan entity so cache.modify writes from item
  // mutations (e.g. createMealPlanItem appending to MealPlan.mealPlanItems)
  // re-render this hook. Under `dataMasking: true` the parent useQuery's
  // `data.mealPlan` is a masked ref whose identity is stable when only
  // deeply-nested fragment-spread fields change, so a cache.modify on
  // mealPlanItems alone does not trigger a useQuery re-emit. useFragment is
  // the lightweight live binding documented for this case in
  // CLAUDE.md (Apollo: Fragment composition + useFragment convention) and
  // docs/apollo-client-patterns.md (AC 4.x: `useFragment` adopted). The
  // result here is only used as a reactivity dependency — we still read
  // through cache.readFragment below to get the Unmasked screen-level shape
  // (cache.readFragment returns `Unmasked<TData>`; useFragment returns
  // `MaybeMasked<TData>`, which would force the screen to drill into
  // `$fragmentRefs` to read item.id/date/etc.).
  useFragment({
    fragment: MealPlanMain_MealPlanFragmentDoc,
    fragmentName: 'MealPlanMain_mealPlan',
    from: id ? { __typename: 'MealPlan', id } : null,
  });

  // Materialize the unmasked MealPlanMain_mealPlan shape. Cache-key `from`
  // form — the masked-ref form silently returns partial/null data under
  // dataMasking. The settings sheet does its own useFragment on the ref
  // passed down to it.
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
