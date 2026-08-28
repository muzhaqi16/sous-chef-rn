import { gql, type ApolloCache, type Reference } from '@apollo/client';
import {
  MealTemplateItemFragmentDoc,
  type MealTemplateItemFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import type { AddTemplateItemInput } from '#/graphql/generated/schemaTypes';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';

/**
 * Local-first writes for a meal template's items.
 *
 * `addTemplateItem` / `updateTemplateItem` / `removeTemplateItem` return the
 * whole `mealTemplate { items }` and rely on Apollo normalizing it — which
 * means offline, where no response arrives, nothing moves on screen. These
 * writers put the change in the cache before the mutation fires so the builder
 * works with no network; a refusal restores what they replaced.
 *
 * They live at module scope, not inside the hook, because their bodies are full
 * of `?.` / `??` value blocks and the React Compiler bails out of an entire
 * function when one appears inside a try/catch.
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

/** Read an item back, so a rejected remove can put it where it was. */
export function readTemplateItem(
  cache: ApolloCache,
  itemId: string,
): MealTemplateItemFragment | null {
  const cacheId = cache.identify({
    __typename: 'MealTemplateItem',
    id: itemId,
  });
  if (!cacheId) return null;
  return cache.readFragment<MealTemplateItemFragment>({
    id: cacheId,
    fragment: MealTemplateItemFragmentDoc,
    fragmentName: 'MealTemplateItemFragment',
  });
}
