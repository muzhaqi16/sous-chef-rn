/**
 * A meal plan item's local-first cache writes: the complete optimistic item and
 * its place on the plan's `mealPlanItems`.
 */

import type { ApolloCache } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import { MealPlanItemActions_OptimisticFullItemFragmentDoc } from '#features/mealPlan/hooks/useMealPlanItemActions.generated';
import type { MealPlanItemCard_ItemFragment } from '#features/mealPlan/components/MealPlanItemCard.generated';
import type { CreateMealPlanItemInput } from '#/graphql/generated/schemaTypes';
import {
  createAddToParentArrayUpdater,
  createRemoveFromParentArrayUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { isHeld, writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import { errorService } from '#/services/errorService';
import {
  MealPlanItem_RowFragmentDoc,
  type MealPlanItem_RowFragment,
} from './mealPlanItem.generated';
import {
  NEUTRAL_LOCAL_MEAL_PLAN_ITEM,
  NEUTRAL_LOCAL_MEAL_PLAN_ITEM_BY_TYPE,
} from './mealPlanItemRowNeutral.generated';

export const addToMealPlanItems = createAddToParentArrayUpdater<{ id: string }>(
  'MealPlan',
  'mealPlanItems',
);
export const removeFromMealPlanItems = createRemoveFromParentArrayUpdater(
  'MealPlan',
  'mealPlanItems',
  'MealPlanItem',
);

/**
 * Settles a create the server answered with its row: a meal the plan already
 * held on that day, slot and recipe comes back under its own id, so the minted
 * row gives way to it. Idempotent.
 */
export function adoptServerMealPlanItem(
  cache: ApolloCache,
  mealPlanId: string,
  serverItemId: string,
  mintedId: string | null | undefined,
): void {
  if (mintedId && serverItemId !== mintedId) {
    removeFromMealPlanItems(cache, mealPlanId, mintedId, { evictItem: true });
  }
  const serverItem = { __typename: 'MealPlanItem', id: serverItemId };
  addToMealPlanItems(cache, mealPlanId, serverItem, { position: 'end' });
}

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
  recipe: Unmasked<MealPlanItem_RowFragment>['recipe'];
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
 * Writes a local-first meal complete for every query reading one. Its recipe is
 * named only when the cache holds it (the user just picked it); a miss is a
 * recipe-less card until the server answers.
 */
function writeMealPlanItemRow(
  cache: ApolloCache,
  id: string,
  input: CreateMealPlanItemInput,
): { __typename: 'MealPlanItem'; id: string } {
  const recipe = input.meal.recipeId
    ? { __typename: 'Recipe', id: input.meal.recipeId }
    : null;
  writeLocalEntity(cache, {
    fragment: MealPlanItem_RowFragmentDoc,
    fragmentName: 'mealPlanItem_row',
    neutral: NEUTRAL_LOCAL_MEAL_PLAN_ITEM,
    neutralByType: NEUTRAL_LOCAL_MEAL_PLAN_ITEM_BY_TYPE,
    known: {
      __typename: 'MealPlanItem',
      id,
      date: input.date,
      mealType: input.mealType,
      customMealName: input.meal.customMealName ?? null,
      servings: input.servings ?? null,
      calories: input.calories ?? null,
      notes: input.notes ?? null,
      recipe: recipe && isHeld(cache, recipe) ? recipe : null,
    },
  });
  return { __typename: 'MealPlanItem', id };
}

/**
 * Writes a local-first meal into the cache and onto its plan's list, and
 * returns the revert for a refusal. Only an input carrying its minted id is
 * written; without one there is nothing to revert.
 */
export function writeLocalMealPlanItem(
  cache: ApolloCache,
  input: CreateMealPlanItemInput,
): (() => void) | undefined {
  const { id, mealPlanId } = input;
  if (!id) return undefined;
  try {
    const item = writeMealPlanItemRow(cache, id, input);
    addToMealPlanItems(cache, mealPlanId, item, { position: 'end' });
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
