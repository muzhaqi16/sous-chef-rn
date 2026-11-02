import type { FieldPolicy, StoreObject, TypePolicies } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  readByIdFromCache,
} from '#/apollo/cacheFieldPolicies';

/**
 * A catalog page: one answered without the catalog never replaces a complete
 * one, so a refresh during an outage keeps the list.
 */
const catalogPage: FieldPolicy<StoreObject> = {
  merge(existing, incoming, { readField }) {
    if (readField<boolean>('catalogAvailable', incoming) !== false) {
      return incoming;
    }
    return existing !== undefined &&
      readField<boolean>('catalogAvailable', existing) === true
      ? existing
      : incoming;
  },
};

/**
 * A recipe merges field-wise; `recipes` keys on the whole `filters` input.
 * Ingredients are ONE list whatever arguments read them: a paged selection and
 * a local writer naming none hold the same rows.
 */
export const recipesTypePolicies: TypePolicies = {
  Recipe: {
    merge: true, // Enable automatic field-level merging for partial data
    fields: {
      ingredientsConnection: mergeConnectionByNodeId(false),
    },
  },
  Query: {
    fields: {
      recipe: readByIdFromCache('Recipe'),
      recipes: {
        ...mergeConnectionByNodeId(),
        keyArgs: ['filters'],
      },
      // A ranking for one home: a new answer replaces the last, never merges,
      // and one home's never answers for another's. A screened ranking is its
      // own entry: an unscreened one must never answer for it. No `today`: a new
      // day keeps the last ranking until the server answers for it.
      recipeSuggestions: {
        keyArgs: ['homeId', 'excludeDietaryConflicts'],
        merge: (_existing: unknown, incoming: unknown) => incoming,
      },
      catalogRecipesByIngredients: catalogPage,
      randomCatalogRecipes: catalogPage,
    },
  },
};
