import type { ApolloCache } from '@apollo/client';
import type { CreateMealPlanInput } from '#/graphql/generated/schemaTypes';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import {
  hideEntity,
  isHeld,
  writeLocalEntity,
} from '#/apollo/utils/writeLocalEntity';
import { MealPlan_RowFragmentDoc } from './mealPlan.generated';
import {
  NEUTRAL_LOCAL_MEAL_PLAN,
  NEUTRAL_LOCAL_MEAL_PLAN_BY_TYPE,
} from './mealPlanRowNeutral.generated';
import { removeFromMealPlans } from './removals';

export const addToMealPlans = createAddToQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);

/**
 * Writes a local-first plan complete for every query reading one, the list card
 * and the complete-gated detail screen alike. Its creator owns it; its home is
 * named only when the cache holds it.
 */
export function writeLocalMealPlan(
  cache: ApolloCache,
  id: string,
  input: CreateMealPlanInput,
  creatorId: string,
  now: string,
): { __typename: 'MealPlan'; id: string } {
  const creator = { __typename: 'User', id: creatorId };
  const home = input.homeId ? { __typename: 'Home', id: input.homeId } : null;
  writeLocalEntity(cache, {
    fragment: MealPlan_RowFragmentDoc,
    fragmentName: 'mealPlan_row',
    neutral: NEUTRAL_LOCAL_MEAL_PLAN,
    neutralByType: NEUTRAL_LOCAL_MEAL_PLAN_BY_TYPE,
    known: {
      __typename: 'MealPlan',
      id,
      name: input.name,
      description: input.description ?? null,
      planType: input.planType,
      startDate: input.startDate,
      endDate: input.endDate,
      servings: input.servings ?? 2,
      budgetAmount: input.budgetAmount ?? null,
      homeId: input.homeId ?? null,
      home: home && isHeld(cache, home) ? home : null,
      user: creator,
      createdBy: creator,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  });
  return { __typename: 'MealPlan', id };
}

/** Takes a plan out from a layer; a plan already hidden changes nothing. */
export function hideMealPlan(cache: ApolloCache, planId: string): void {
  const plan = { __typename: 'MealPlan', id: planId };
  if (!isHeld(cache, plan)) return;
  removeFromMealPlans(cache, planId);
  hideEntity(cache, plan);
}
