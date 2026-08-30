import { gql, type ApolloCache, type Reference } from '@apollo/client';
import {
  MealTemplateItemFragmentDoc,
  type MealTemplateItemFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import type { AddTemplateItemInput } from '#/graphql/generated/schemaTypes';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';

/**
 * Local-first writes for a template's items: the item mutations return the whole
 * `mealTemplate { items }` and rely on normalization, so offline nothing moves.
 * Module scope, not inside the hook — a value block inside a try/catch bails
 * the whole function out of the React Compiler.
 */

/** Display fields the item's row shows for a recipe-backed meal. */
const TemplateItemRecipeFragment = gql`
  fragment _TemplateItemRecipe on Recipe {
    id
    name
    imageUrl
    servings
    totalTimeMinutes
  }
`;

export function readRecipeRef(
  cache: ApolloCache,
  recipeId: string | null | undefined,
): MealTemplateItemFragment['recipe'] {
  if (!recipeId) return null;
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return null;
  const recipe = cache.readFragment<MealTemplateItemFragment['recipe']>({
    id: cacheId,
    fragment: TemplateItemRecipeFragment,
    fragmentName: '_TemplateItemRecipe',
  });
  // A recipe the cache has never seen still has to render as SOMETHING, or the
  // whole items read goes incomplete and the builder blanks. Neutral defaults
  // are replaced by the server entity on response/replay.
  return (
    recipe ?? {
      __typename: 'Recipe',
      id: recipeId,
      name: '',
      imageUrl: null,
      servings: 0,
      totalTimeMinutes: null,
    }
  );
}

/** Build the complete `MealTemplateItem` the template's item list reads. */
export function buildOptimisticTemplateItem(
  cache: ApolloCache,
  id: string,
  input: AddTemplateItemInput,
): MealTemplateItemFragment {
  return createOptimisticEntity<MealTemplateItemFragment>(
    'MealTemplateItem',
    id,
    {
      dayOffset: input.dayOffset,
      mealType: input.mealType,
      customMealName: input.meal.customMealName ?? null,
      servings: input.servings ?? null,
      notes: input.notes ?? null,
      recipe: readRecipeRef(cache, input.meal.recipeId),
    },
  );
}

/** Append an item to the template's `items` list. */
export function addTemplateItemToCache(
  cache: ApolloCache,
  templateId: string,
  item: MealTemplateItemFragment,
): void {
  const parent = cache.identify({
    __typename: 'MealTemplate',
    id: templateId,
  });
  if (!parent) return;

  cache.writeFragment({
    id: cache.identify(item),
    fragment: MealTemplateItemFragmentDoc,
    fragmentName: 'MealTemplateItemFragment',
    data: item,
  });

  cache.modify({
    id: parent,
    fields: {
      items(existing: readonly Reference[] = [], { toReference, readField }) {
        const ref = toReference(item, true);
        if (!ref) return existing;
        // The response normalizes the same id, so guard against a second edge.
        const already = existing.some(
          edge => readField<string>('id', edge) === item.id,
        );
        return already ? existing : [...existing, ref];
      },
    },
  });
}

/** Drop an item from the template's `items` list and evict the entity. */
export function removeTemplateItemFromCache(
  cache: ApolloCache,
  templateId: string,
  itemId: string,
): void {
  const parent = cache.identify({
    __typename: 'MealTemplate',
    id: templateId,
  });
  if (parent) {
    cache.modify({
      id: parent,
      fields: {
        items(existing: readonly Reference[] = [], { readField }) {
          return existing.filter(
            edge => readField<string>('id', edge) !== itemId,
          );
        },
      },
    });
  }
  const cacheId = cache.identify({
    __typename: 'MealTemplateItem',
    id: itemId,
  });
  if (cacheId) cache.evict({ id: cacheId });
}

/**
 * Completes a partial {@link readTemplateItem} snapshot into a restorable
 * entity, or null when it carries no id. Absent keys become explicit nulls: the
 * row must be complete to go back into `items`, and null is the honest value
 * for a field the cache never held. The next fetch repairs it.
 */
export function toRestorableTemplateItem(
  snapshot: Partial<MealTemplateItemFragment> | null,
  itemId: string,
): MealTemplateItemFragment | null {
  if (!snapshot || (snapshot.id ?? itemId) !== itemId) return null;
  return {
    __typename: 'MealTemplateItem',
    id: itemId,
    dayOffset: snapshot.dayOffset ?? 0,
    mealType: snapshot.mealType as MealTemplateItemFragment['mealType'],
    customMealName: snapshot.customMealName ?? null,
    servings: snapshot.servings ?? null,
    notes: snapshot.notes ?? null,
    recipe: snapshot.recipe ?? null,
  };
}

/**
 * Reads an item back so a rejected update or remove can restore it.
 * `returnPartialData` is load-bearing: the fragment selects `recipe`, the
 * editor's query does not, and `readFragment` is all-or-nothing. The result is
 * partial BY CONTRACT — a missing key means the cache never knew the value.
 */
export function readTemplateItem(
  cache: ApolloCache,
  itemId: string,
): Partial<MealTemplateItemFragment> | null {
  const cacheId = cache.identify({
    __typename: 'MealTemplateItem',
    id: itemId,
  });
  if (!cacheId) return null;
  return cache.readFragment<Partial<MealTemplateItemFragment>>({
    id: cacheId,
    fragment: MealTemplateItemFragmentDoc,
    fragmentName: 'MealTemplateItemFragment',
    returnPartialData: true,
  });
}
