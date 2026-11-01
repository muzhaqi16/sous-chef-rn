import type { ApolloClient } from '@apollo/client';
import { useStore } from '#store';
import { addDaysToKey, todayKey } from '#/utils/dateUtils';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { GetMealPlansDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { UNFILTERED_PLANS_VARIABLES } from '#features/mealPlan/hooks/useMealPlans';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { resolveCurrentMealPlan } from '#features/mealPlan/utils/mealPlanFilters';
import { warmRecipe } from '#features/recipes/hooks/useRecipeData';
import { GetMealPlanDocument } from './useMealPlan.generated';

/** How far ahead a planned recipe is worth holding, and how many a warm costs. */
const PLANNED_DAYS = 7;
const MAX_PLANNED_RECIPES = 14;

/** As `useMealPlan` reads a plan, or the warm holds a different entry. */
const planVariables = (id: string) => ({
  id,
  mealsFirst: MEALS_PAGE_SIZE,
  ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
});

/** The plan covering today and the next to start, of the plans the list holds. */
function upcomingPlanIds(client: ApolloClient, today: string): string[] {
  const held = client.cache.readQuery({
    query: GetMealPlansDocument,
    variables: UNFILTERED_PLANS_VARIABLES,
    optimistic: false,
  });
  const plans = held?.mealPlans.edges.map(edge => edge.node) ?? [];
  const current = resolveCurrentMealPlan(plans, today);
  const next = resolveCurrentMealPlan(
    plans.filter(plan => plan.startDate > today),
    today,
  );
  return [...new Set([current, next].flatMap(plan => plan?.id ?? []))];
}

/** The recipes those plans hold for the coming days, soonest first. */
function plannedRecipeIds(
  client: ApolloClient,
  planIds: string[],
  today: string,
): string[] {
  const lastDay = addDaysToKey(today, PLANNED_DAYS);
  const meals = planIds.flatMap(id => {
    const held = client.cache.readQuery({
      query: GetMealPlanDocument,
      variables: planVariables(id),
      optimistic: false,
    });
    return (
      held?.mealPlan?.mealPlanItemsConnection.edges.map(edge => edge.node) ?? []
    );
  });
  const coming = meals
    .filter(meal => meal.date >= today && meal.date < lastDay)
    .sort((a, b) => a.date.localeCompare(b.date));
  return [...new Set(coming.flatMap(meal => meal.recipe?.id ?? []))];
}

/**
 * The next plans and the recipes the coming week names, after the list has
 * landed. Recipes go one at a time, so a week of them never crowds out what is
 * on screen.
 */
export async function warmPlannedMeals(client: ApolloClient): Promise<void> {
  const today = todayKey();
  const planIds = upcomingPlanIds(client, today);
  await Promise.all(
    planIds.map(id =>
      client.query({
        query: GetMealPlanDocument,
        variables: planVariables(id),
        fetchPolicy: 'cache-first',
        errorPolicy: 'none',
      }),
    ),
  );
  const owner = useStore.getState().user?.id;
  const recipeIds = plannedRecipeIds(client, planIds, today);
  for (const id of recipeIds.slice(0, MAX_PLANNED_RECIPES)) {
    if (useStore.getState().user?.id !== owner) return;
    await warmRecipe(client, id);
  }
}
