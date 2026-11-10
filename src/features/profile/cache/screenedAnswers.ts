import type { ApolloCache } from '@apollo/client';
import type { Query } from '#/graphql/generated/schemaTypes';

/** The root fields the server screens by every restriction the caller holds. */
const SCREENED_BY_HELD_RESTRICTIONS = [
  'recipeSuggestions',
  'catalogRecipesByIngredients',
] satisfies ReadonlyArray<keyof Query>;

/**
 * Drops them once a restriction the server holds has changed, so a screen
 * showing one asks again rather than keep a recipe the change rules out. No
 * gc: a recipe a screen reads by id may be reachable only through them.
 */
export function dropScreenedAnswers(cache: ApolloCache): void {
  for (const fieldName of SCREENED_BY_HELD_RESTRICTIONS) {
    cache.evict({ id: 'ROOT_QUERY', fieldName });
  }
}
