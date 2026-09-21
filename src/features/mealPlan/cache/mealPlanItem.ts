/**
 * A meal plan item's local-first cache writes: the complete optimistic item and
 * its place on the plan's `mealPlanItems`.
 */

import type { ApolloCache } from '@apollo/client';
import { MealPlanItemActions_OptimisticFullItemFragmentDoc } from '#features/mealPlan/hooks/useMealPlanItemActions.generated';
import type { MealPlanItemCard_ItemFragment } from '#features/mealPlan/components/MealPlanItemCard.generated';
import type { CreateMealPlanItemInput } from '#/graphql/generated/schemaTypes';
import {
  createAddToParentArrayUpdater,
  createRemoveFromParentArrayUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { errorService } from '#/services/errorService';
import {
  MealPlanItem_RecipeRefFragmentDoc,
  type MealPlanItem_RecipeRefFragment,
} from './mealPlanItem.generated';

export const addToMealPlanItems = createAddToParentArrayUpdater<{ id: string }>(
  'MealPlan',
  'mealPlanItems',
);
export const removeFromMealPlanItems = createRemoveFromParentArrayUpdater(
  'MealPlan',
  'mealPlanItems',
  'MealPlanItem',
);

/** The flat field union of the five item display fragments. */
export type OptimisticMealPlanItem = {
  __typename: 'MealPlanItem';
  id: string;
  date: string;
  mealType: CreateMealPlanItemInput['mealType'];
  customMealName: string | null;
  servings: number | null;
  calories: number | null;
  usedPantryItems: MealPlanItemCard_ItemFragment['usedPantryItems'];
  notes: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  recipe: MealPlanItem_RecipeRefFragment | null;
};

/** Writes a complete item under every display fragment that reads it. */
export const writeMealPlanItem = (
  cache: ApolloCache,
  data: OptimisticMealPlanItem,
) =>
  cache.writeFragment({
    id: cache.identify(data),
    fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
    fragmentName: 'MealPlanItemActions_optimisticFullItem',
    data,
  });

/**
 * Materialize a complete optimistic MealPlanItem for a local-first create.
 * The recipe ref resolves from the cache's canonical Recipe entity (the user
 * just picked it, so it's cached); a miss degrades to a recipe-less card that
 * the post-replay refetch heals.
 */
function buildOptimisticMealPlanItem(
  cache: ApolloCache,
  id: string,
  input: CreateMealPlanItemInput,
): OptimisticMealPlanItem {
  const recipeCacheId = input.meal.recipeId
    ? cache.identify({ __typename: 'Recipe', id: input.meal.recipeId })
    : undefined;
  const recipe = recipeCacheId
    ? cache.readFragment<MealPlanItem_RecipeRefFragment>({
        id: recipeCacheId,
        fragment: MealPlanItem_RecipeRefFragmentDoc,
        fragmentName: 'mealPlanItem_recipeRef',
      })
    : null;

  return {
    __typename: 'MealPlanItem',
    id,
    date: input.date,
    mealType: input.mealType,
    customMealName: input.meal.customMealName ?? null,
    servings: input.servings ?? null,
    calories: input.calories ?? null,
    usedPantryItems: [],
    notes: input.notes ?? null,
    isCompleted: false,
    completedAt: null,
    recipe,
  };
}

/**
 * Writes a local-first meal into the cache and onto its plan's list, and
 * returns the revert for a refusal. Only an input carrying its minted id is
 * written; without one there is nothing to revert.
 */
export function writeOptimisticMealPlanItem(
  cache: ApolloCache,
  input: CreateMealPlanItemInput,
): (() => void) | undefined {
  const { id, mealPlanId } = input;
  if (!id) return undefined;
  const optimisticItem = buildOptimisticMealPlanItem(cache, id, input);
  try {
    writeMealPlanItem(cache, optimisticItem);
    addToMealPlanItems(cache, mealPlanId, optimisticItem, { position: 'end' });
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: 'Add Meal (optimistic)',
    });
  }

  return () => {
    try {
      removeFromMealPlanItems(cache, mealPlanId, id, { evictItem: true });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Revert rejected Meal Plan Item',
      });
    }
  };
}
