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

/**
 * Complete a {@link readTemplateItem} snapshot into something the cache can be
 * given back, or null when there is nothing to restore.
 *
 * The snapshot is partial by contract — the editor's query does not select
 * `recipe`, so a row loaded there has no recipe in the cache to snapshot. The
 * absent keys become explicit nulls rather than being left undefined: the row
 * has to be a complete entity to go back into `items`, and null is the honest
 * value for a field the cache never held. The next fetch repairs it.
 *
 * Returns null when the snapshot carries no id, which is the one case where a
 * restore would write a row that identifies as nothing.
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
 * Read an item back, so a rejected update or remove can put it where it was.
 *
 * `returnPartialData` is load-bearing, not defensive. `MealTemplateItemFragment`
 * selects `recipe { … }` and the editor's own query, `GetMealTemplateForEdit`,
 * selects no `recipe` at all — and `readFragment` is all-or-nothing, so without
 * this it returned null for EVERY row the editor had loaded. That made the
 * local-first writes and their reverts silent no-ops: an offline edit reset the
 * form and left the old values on screen with no error, and a refused remove
 * left the row gone under a message saying it had failed.
 *
 * The result is therefore partial by contract. Callers must treat a missing key
 * as "the cache never knew this", not as "the value is empty".
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
