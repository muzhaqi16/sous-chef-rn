import type { ExternalSource } from '#/graphql/generated/schemaTypes';

/** `catalogRecipesByIngredients` refuses a request naming more. */
export const MAX_CATALOG_INGREDIENTS = 20;

/** `catalogRecipesByIngredients` refuses a request holding a longer name. */
export const MAX_CATALOG_INGREDIENT_LENGTH = 100;

/** `findRecipes` refuses a longer query, measured after it is normalised. */
export const MAX_RECIPE_QUERY_LENGTH = 200;

const normalized = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The ingredient names the API counts, in first-seen order: each name split at
 * its commas, normalised and deduplicated. A name it would refuse is left out.
 */
export function acceptedIngredientNames(names: readonly string[]): string[] {
  const accepted = new Set<string>();
  for (const name of names) {
    for (const part of name.split(',')) {
      const text = normalized(part);
      if (text !== '' && text.length <= MAX_CATALOG_INGREDIENT_LENGTH) {
        accepted.add(text);
      }
    }
  }
  return [...accepted];
}

/**
 * An ingredient list `catalogRecipesByIngredients` accepts. Sorted as the API
 * sorts it, so the variables, and the cache entry they key, do not follow the
 * order the names came in.
 */
export const catalogIngredientNames = (names: readonly string[]): string[] =>
  acceptedIngredientNames(names).slice(0, MAX_CATALOG_INGREDIENTS).sort();

/** A catalog recipe's list key, unique across providers. */
export const catalogKey = (hit: {
  provider: ExternalSource;
  providerRecipeId: string;
}): string => `catalog-${hit.provider}-${hit.providerRecipeId}`;
