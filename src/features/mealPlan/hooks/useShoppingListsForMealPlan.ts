import { useQuery } from '@apollo/client/react';
import { GetShoppingListsLiteForMealPlanDocument } from '#features/mealPlan/components/GenerateShoppingListSheet.generated';

/** The lists a generated plan can be written into. */
export function useShoppingListsForMealPlan(skip: boolean) {
  const { data } = useQuery(GetShoppingListsLiteForMealPlanDocument, {
    variables: { first: 20 },
    skip,
  });

  return { shoppingLists: data?.shoppingLists?.edges?.map(e => e.node) ?? [] };
}
