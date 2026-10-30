import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { MealPlanType, MealType } from '#/graphql/generated/schemaTypes';
import type { PlanSource } from '#features/mealPlan/cache/derivationSources';
import {
  UseDuplicateMealPlan_MealPlanFragmentDoc,
  type UseDuplicateMealPlan_MealPlanFragment,
} from '#features/mealPlan/hooks/useDuplicateMealPlan.generated';
import { typedConnectionOf } from './connectionOf';

type PlanMeal = PlanSource['mealPlanItems'][number];

/** A recipe dinner on the plan's first day. */
export const recipeDinner = (overrides: Partial<PlanMeal> = {}): PlanMeal => ({
  __typename: 'MealPlanItem',
  version: 1,
  id: 'mpi-1',
  date: '2026-01-05',
  mealType: MealType.Dinner,
  servings: 2,
  notes: null,
  customMealName: null,
  recipe: { __typename: 'Recipe', version: 1, id: 'recipe-1' },
  ...overrides,
});

/** A meal named by itself, with no recipe or servings, on the plan's third day. */
export const leftoversLunch = (
  overrides: Partial<PlanMeal> = {},
): PlanMeal => ({
  __typename: 'MealPlanItem',
  version: 1,
  id: 'mpi-2',
  date: '2026-01-07',
  mealType: MealType.Lunch,
  servings: null,
  notes: null,
  customMealName: 'Leftovers',
  recipe: null,
  ...overrides,
});

/** A week's plan with every meal, as a copy, template cut or derive reads it. */
export const planSource = (
  overrides: Partial<PlanSource> = {},
): PlanSource => ({
  __typename: 'MealPlan',
  version: 1,
  id: 'plan-1',
  description: 'A week of food',
  planType: MealPlanType.Weekly,
  servings: 4,
  budgetAmount: 90,
  homeId: 'home-1',
  startDate: '2026-01-05',
  endDate: '2026-01-11',
  mealPlanItems: [recipeDinner(), leftoversLunch()],
  ...overrides,
});

/** `plan` as `GetMealPlan` caches it, every meal an edge of one list. */
export const seedPlanSource = (
  plan: PlanSource = planSource(),
  { hasNextPage = false }: { hasNextPage?: boolean } = {},
): InMemoryCache => {
  const { mealPlanItems, ...fields } = plan;
  const data: UseDuplicateMealPlan_MealPlanFragment = {
    ...fields,
    mealPlanItemsConnection: typedConnectionOf('MealPlanItem', mealPlanItems, {
      hasNextPage,
    }),
  };
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify(data),
    fragment: UseDuplicateMealPlan_MealPlanFragmentDoc,
    fragmentName: 'useDuplicateMealPlan_mealPlan',
    data,
  });
  return cache;
};
