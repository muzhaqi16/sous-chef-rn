/**
 * A meal plan item's local-first cache writes: the complete row and its edge on
 * the plan's `mealPlanItemsConnection`.
 */

import type { ApolloCache } from '@apollo/client';
import type { CreateMealPlanItemInput } from '#/graphql/generated/schemaTypes';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import {
  hideEntity,
  isHeld,
  writeLocalEntity,
} from '#/apollo/utils/writeLocalEntity';
import { MealPlanItem_RowFragmentDoc } from './mealPlanItem.generated';
import {
  NEUTRAL_LOCAL_MEAL_PLAN_ITEM,
  NEUTRAL_LOCAL_MEAL_PLAN_ITEM_BY_TYPE,
} from './mealPlanItemRowNeutral.generated';

/** The plan field its meals hang off; the pending-delete guard names it too. */
export const MEAL_PLAN_ITEMS_FIELD = 'mealPlanItemsConnection';

export const addToMealPlanItems = createAddToParentConnectionUpdater(
  'MealPlan',
  MEAL_PLAN_ITEMS_FIELD,
  'MealPlanItem',
);
export const removeFromMealPlanItems = createRemoveFromParentConnectionUpdater(
  'MealPlan',
  MEAL_PLAN_ITEMS_FIELD,
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
      // What the server gives a new row, so an edit queued behind this create
      // has a version to state.
      version: 1,
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
 * Shows a local-first meal on its plan. Only an input carrying its minted id is
 * written.
 */
export function showLocalMealPlanItem(
  cache: ApolloCache,
  input: CreateMealPlanItemInput,
): void {
  const { id, mealPlanId } = input;
  if (!id) return;
  const item = writeMealPlanItemRow(cache, id, input);
  addToMealPlanItems(cache, mealPlanId, item, { position: 'end' });
}

/** Takes a meal out from a layer; a meal already hidden changes nothing. */
export function hideMealPlanItem(
  cache: ApolloCache,
  mealPlanId: string,
  itemId: string,
): void {
  const item = { __typename: 'MealPlanItem', id: itemId };
  if (!isHeld(cache, item)) return;
  removeFromMealPlanItems(cache, mealPlanId, itemId);
  hideEntity(cache, item);
}
