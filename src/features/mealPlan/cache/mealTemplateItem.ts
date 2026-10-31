import type { ApolloCache } from '@apollo/client';
import type { MealTemplateItemFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import type { MealTemplateItemInput } from '#/graphql/generated/schemaTypes';
import {
  hideEntity,
  isHeld,
  writeLocalEntity,
} from '#/apollo/utils/writeLocalEntity';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import {
  MealTemplateItem_RecipeRefFragmentDoc,
  MealTemplateItem_RowFragmentDoc,
} from './mealTemplateItem.generated';
import {
  NEUTRAL_LOCAL_MEAL_TEMPLATE_ITEM,
  NEUTRAL_LOCAL_MEAL_TEMPLATE_ITEM_BY_TYPE,
} from './mealTemplateItemRowNeutral.generated';

/**
 * Local-first writes for a template's items. An item mutation never returns the
 * template's `itemsConnection`, so the edge is written here. Module scope: a
 * value block in a try bails the hook out of the React Compiler.
 */

/** The template field its meals hang off. */
const TEMPLATE_ITEMS_FIELD = 'itemsConnection';

const addToTemplateItems = createAddToParentConnectionUpdater(
  'MealTemplate',
  TEMPLATE_ITEMS_FIELD,
  'MealTemplateItem',
);
const removeFromTemplateItems = createRemoveFromParentConnectionUpdater(
  'MealTemplate',
  TEMPLATE_ITEMS_FIELD,
  'MealTemplateItem',
);

export function readRecipeRef(
  cache: ApolloCache,
  recipeId: string | null | undefined,
): MealTemplateItemFragment['recipe'] {
  if (!recipeId) return null;
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return null;
  const recipe = cache.readFragment({
    id: cacheId,
    fragment: MealTemplateItem_RecipeRefFragmentDoc,
    optimistic: true,
  });
  // A recipe the cache has never seen still has to render as SOMETHING, or the
  // whole items read goes incomplete and the builder blanks. Neutral defaults
  // are replaced by the server entity on response/replay.
  return (
    recipe ?? {
      __typename: 'Recipe',
      id: recipeId,
      version: 0,
      name: '',
      imageUrl: null,
      servings: 0,
      totalTimeMinutes: null,
    }
  );
}

/** A template item as a create states it, for `writeLocalEntity` to complete. */
export type LocalTemplateItem = Record<string, unknown> & {
  __typename: 'MealTemplateItem';
  id: string;
};

/**
 * What a create knows about an item: its recipe named only when the cache
 * holds it, as an item a plan or template was copied from does.
 */
export function localTemplateItem(
  cache: ApolloCache,
  id: string,
  input: Omit<MealTemplateItemInput, 'id'>,
): LocalTemplateItem {
  const recipe = input.meal.recipeId
    ? { __typename: 'Recipe', id: input.meal.recipeId }
    : null;
  return {
    __typename: 'MealTemplateItem',
    id,
    dayOffset: input.dayOffset,
    mealType: input.mealType,
    customMealName: input.meal.customMealName ?? null,
    servings: input.servings ?? null,
    notes: input.notes ?? null,
    recipe: recipe && isHeld(cache, recipe) ? recipe : null,
  };
}

/**
 * Writes an item complete for every query reading one — what it states, else
 * what the cache holds, else the neutral value — and appends its edge to the
 * template's meals.
 */
export function addTemplateItemToCache(
  cache: ApolloCache,
  templateId: string,
  item: LocalTemplateItem,
): void {
  const parent = cache.identify({
    __typename: 'MealTemplate',
    id: templateId,
  });
  if (!parent) return;

  writeLocalEntity(cache, {
    fragment: MealTemplateItem_RowFragmentDoc,
    fragmentName: 'mealTemplateItem_row',
    neutral: NEUTRAL_LOCAL_MEAL_TEMPLATE_ITEM,
    neutralByType: NEUTRAL_LOCAL_MEAL_TEMPLATE_ITEM_BY_TYPE,
    known: item,
  });

  // Guards against a second edge: the response normalizes the same id.
  addToTemplateItems(cache, templateId, item, { position: 'end' });
}

/** Drop an item's edge from its template and evict the entity. */
export function removeTemplateItemFromCache(
  cache: ApolloCache,
  templateId: string,
  itemId: string,
): void {
  removeFromTemplateItems(cache, templateId, itemId, { evictItem: true });
}

/** Takes an item out from a layer; one already hidden changes nothing. */
export function hideTemplateItem(
  cache: ApolloCache,
  templateId: string,
  itemId: string,
): void {
  const item = { __typename: 'MealTemplateItem', id: itemId };
  if (!isHeld(cache, item)) return;
  removeFromTemplateItems(cache, templateId, itemId);
  hideEntity(cache, item);
}
